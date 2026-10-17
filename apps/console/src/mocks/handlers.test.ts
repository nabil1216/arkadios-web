import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { API_BASE, TENANT_API_BASE } from '@/lib/api'
import { DEMO_CODE, DEMO_PASSWORD, permissions, staff } from './db'
import { handlers } from './handlers'
import { resetMockBills } from './bills'
import { resetMockPlans } from './plans'
import { platformAuditLog, resetMockStaff } from './staff'
import { resetMockSupport } from './support'
import { resetMockTenants, setProvisionStepMs } from './tenantCreate'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const url = (path: string) => new URL(API_BASE + path, location.href).href

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

async function expectProblem(res: Response, status: number) {
  expect(res.status).toBe(status)
  expect(res.headers.get('Content-Type')).toContain('application/problem+json')
  const body = await res.json()
  expect(body).toMatchObject({ type: expect.any(String), title: expect.any(String), status, traceId: expect.any(String) })
  return body as { title: string; detail?: string; type: string; errors?: Record<string, string[]> }
}

describe('POST /auth/login', () => {
  it('asks every user for a code, auditor included', async () => {
    for (const user of staff.filter((u) => u.status === 'active')) {
      const res = await post('/auth/login', { email: user.email, password: DEMO_PASSWORD })
      expect(res.status, user.email).toBe(200)
      expect(await res.json()).toEqual({ challengeId: expect.any(String) })
    }
  })

  it('gives the same generic problem for a bad password, unknown email and invited account', async () => {
    const invited = staff.find((u) => u.status === 'invited')!
    const attempts = [
      { email: staff[0].email, password: 'wrong' },
      { email: 'nobody@platform.example', password: DEMO_PASSWORD },
      { email: invited.email, password: DEMO_PASSWORD },
    ]
    const bodies = []
    for (const attempt of attempts) {
      const { title, detail, type } = await expectProblem(await post('/auth/login', attempt), 401)
      bodies.push({ title, detail, type })
    }
    expect(bodies[1]).toEqual(bodies[0])
    expect(bodies[2]).toEqual(bodies[0])
  })

  it('returns field errors for missing input', async () => {
    const body = await expectProblem(await post('/auth/login', {}), 400)
    expect(body.errors).toEqual({ email: ['Email is required.'], password: ['Password is required.'] })
  })
})

describe('POST /auth/mfa', () => {
  it('rejects a wrong code with a problem', async () => {
    const res = await post('/auth/mfa', { challengeId: 'mock-challenge.u1', code: '000000' })
    expect((await expectProblem(res, 401)).detail).toBe('That code is not right.')
  })

  it('returns a session for the right code', async () => {
    const res = await post('/auth/mfa', { challengeId: 'mock-challenge.u1', code: DEMO_CODE })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ accessToken: expect.any(String), user: { id: 'u1', role: 'admin' } })
  })
})

describe('GET /permissions', () => {
  it('needs a bearer token', async () => {
    await expectProblem(await fetch(url('/permissions')), 401)
  })

  it('returns keys per role', async () => {
    const res = await fetch(url('/permissions'), { headers: { Authorization: 'Bearer mock-access.u1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ admin: expect.arrayContaining(['tenants.manage']) })
  })
})

const CSRF = { 'X-Requested-With': 'arkadios-web' }
const cookieOf = (res: Response) => /refresh_token=([^;]*)/.exec(res.headers.get('Set-Cookie') ?? '')?.[1]
const refresh = (cookie?: string, headers: Record<string, string> = CSRF) =>
  post('/auth/refresh', {}, { ...headers, ...(cookie ? { Cookie: `refresh_token=${cookie}` } : {}) })

describe('session response', () => {
  it('includes expiresIn in seconds and sets an httpOnly refresh cookie', async () => {
    const res = await post('/auth/mfa', { challengeId: 'mock-challenge.u2', code: DEMO_CODE })
    expect(await res.json()).toMatchObject({ expiresIn: 900 })
    expect(res.headers.get('Set-Cookie')).toMatch(/HttpOnly/)
  })
})

describe('refresh and logout CSRF header', () => {
  it('refuses refresh without X-Requested-With: arkadios-web', async () => {
    const login = await post('/auth/mfa', { challengeId: 'mock-challenge.u3', code: DEMO_CODE })
    const body = await expectProblem(await refresh(cookieOf(login), {}), 403)
    expect(body.type).toContain('csrf')
  })

  it('refuses a wrong header value', async () => {
    await expectProblem(await refresh('mock-refresh.u3.1', { 'X-Requested-With': 'something-else' }), 403)
  })

  it('refuses logout without the header and accepts it with the header', async () => {
    await expectProblem(await post('/auth/logout', {}), 403)
    const ok = await post('/auth/logout', {}, CSRF)
    expect(ok.status).toBe(204)
    expect(ok.headers.get('Set-Cookie')).toMatch(/Max-Age=0/)
  })
})

describe('POST /auth/refresh rotation', () => {
  it('rejects a request with no refresh cookie', async () => {
    await expectProblem(await refresh(undefined), 401)
  })

  it('issues the next cookie version on every refresh', async () => {
    const login = await post('/auth/mfa', { challengeId: 'mock-challenge.u3', code: DEMO_CODE })
    const first = cookieOf(login)!
    const res = await refresh(first)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ expiresIn: 900, user: { id: 'u3' } })
    const second = cookieOf(res)!
    expect(second).not.toBe(first)
    expect((await refresh(second)).status).toBe(200)
  })

  it('treats a replayed old cookie as theft and ends the whole session', async () => {
    const login = await post('/auth/mfa', { challengeId: 'mock-challenge.u2', code: DEMO_CODE })
    const v1 = cookieOf(login)!
    const v2 = cookieOf(await refresh(v1))!

    const replay = await refresh(v1)
    await expectProblem(replay, 401)
    expect(replay.headers.get('Set-Cookie')).toMatch(/Max-Age=0/)

    // the newest cookie is dead too
    await expectProblem(await refresh(v2), 401)
  })

  it('lets the user sign in again after a revoked session', async () => {
    const login = await post('/auth/mfa', { challengeId: 'mock-challenge.u2', code: DEMO_CODE })
    const v1 = cookieOf(login)!
    await refresh(v1)
    await refresh(v1) // replay: revoked
    const again = await post('/auth/mfa', { challengeId: 'mock-challenge.u2', code: DEMO_CODE })
    expect((await refresh(cookieOf(again))).status).toBe(200)
  })

  it('rejects a user who is no longer active', async () => {
    await expectProblem(await refresh('mock-refresh.u5.1'), 401)
  })
})

describe('POST /auth/forgot-password', () => {
  it('answers the same for an existing, unknown and invited account', async () => {
    const invited = staff.find((u) => u.status === 'invited')!
    for (const email of [staff[0].email, 'nobody@platform.example', invited.email]) {
      const res = await post('/auth/forgot-password', { email })
      expect(res.status, email).toBe(204)
      expect(await res.text()).toBe('')
    }
  })

  it('needs a well-formed email', async () => {
    const body = await expectProblem(await post('/auth/forgot-password', { email: 'nope' }), 400)
    expect(body.errors).toEqual({ email: ['Enter a valid email address.'] })
    await expectProblem(await post('/auth/forgot-password', {}), 400)
  })
})

describe('password reset', () => {
  const GOOD = 'correct horse battery'
  const admin = staff[0]
  const reset = (token: unknown, newPassword: unknown = GOOD) => post('/auth/reset-password', { token, newPassword })
  let info: MockInstance<typeof console.info>

  beforeEach(() => {
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => info.mockRestore())

  /** The "email": the mock prints the reset link. */
  async function requestToken(email = admin.email) {
    await post('/auth/forgot-password', { email })
    const line = info.mock.calls.map((c) => String(c[0])).findLast((l) => l.includes(email) && l.includes('#token='))
    return line ? decodeURIComponent(line.split('#token=')[1]) : undefined
  }

  it('emails a link with the token in the fragment, for active accounts only', async () => {
    const token = await requestToken()
    expect(token).toMatch(/^mock-reset\./)
    expect(info.mock.calls.flat().join(' ')).toContain('/reset-password#token=')
    info.mockClear()
    const invited = staff.find((u) => u.status === 'invited')!
    expect(await requestToken(invited.email)).toBeUndefined()
    expect(await requestToken('nobody@platform.example')).toBeUndefined()
  })

  it('answers 204 with no body and does not sign the user in', async () => {
    const token = await requestToken()
    const res = await reset(token)
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(res.headers.get('Set-Cookie')).toBeNull()
  })

  it('accepts a token once', async () => {
    const token = await requestToken()
    expect((await reset(token)).status).toBe(204)
    const again = await expectProblem(await reset(token), 400)
    expect(again.detail).toBe('This reset link is invalid or has expired.')
  })

  it('returns one generic problem for unknown, malformed, used and missing tokens', async () => {
    const used = await requestToken()
    await reset(used)
    const bodies = []
    for (const token of ['mock-reset.u1.1.nonsense-but-expired', 'garbage', used, undefined, 42, '']) {
      const { type, title, detail, errors } = await expectProblem(await reset(token), 400)
      bodies.push({ type, title, detail, errors })
    }
    for (const b of bodies) expect(b).toEqual(bodies[0])
    expect(bodies[0].errors).toBeUndefined()
  })

  it('rejects a token after 30 minutes', async () => {
    const token = await requestToken()
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + 31 * 60 * 1000)
      await expectProblem(await reset(token), 400)
    } finally {
      vi.useRealTimers()
    }
  })

  it('accepts a token just inside 30 minutes', async () => {
    const token = await requestToken()
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + 29 * 60 * 1000)
      expect((await reset(token)).status).toBe(204)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a new request invalidates earlier tokens', async () => {
    const first = await requestToken()
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + 1000)
      const second = await requestToken()
      await expectProblem(await reset(first), 400)
      expect((await reset(second)).status).toBe(204)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns errors.newPassword for a short password, and keeps the token usable', async () => {
    const token = await requestToken()
    const body = await expectProblem(await reset(token, 'short'), 400)
    expect(body.errors).toEqual({ newPassword: ['Use at least 12 characters.'] })
    expect((await reset(token)).status).toBe(204)
  })

  it('accepts exactly 12 characters', async () => {
    const token = await requestToken()
    expect((await reset(token, 'abcdefghijkl')).status).toBe(204)
  })

  it.each([
    ['a breached password', 'Password1234', 'This password has appeared in a data breach. Choose another.'],
    ['the account email', admin.email.toUpperCase(), 'Do not use your email address as your password.'],
    ['no password', null, 'Enter a new password.'],
  ])('returns errors.newPassword for %s', async (_name, password, message) => {
    const token = await requestToken()
    const body = await expectProblem(await reset(token, password), 400)
    expect(body.errors).toEqual({ newPassword: [message] })
  })

  it('does not apply composition rules', async () => {
    const token = await requestToken()
    expect((await reset(token, 'alllowercaseletters')).status).toBe(204)
  })

  it('checks the token before the password, so a bad link says nothing about the password', async () => {
    const body = await expectProblem(await reset('garbage', 'short'), 400)
    expect(body.errors).toBeUndefined()
    expect(body.detail).toBe('This reset link is invalid or has expired.')
  })

  it('revokes the refresh session of that user', async () => {
    const login = await post('/auth/mfa', { challengeId: 'mock-challenge.u1', code: DEMO_CODE })
    const cookie = cookieOf(login)!
    const token = await requestToken()
    expect((await reset(token)).status).toBe(204)
    await expectProblem(await refresh(cookie), 401)
  })
})

describe('GET /tenants', () => {
  const as = (userId: string) => ({ Authorization: `Bearer mock-access.${userId}` })
  const get = (query = '', headers: Record<string, string> = as('u1')) => fetch(url('/tenants' + query), { headers })

  it('needs a bearer token', async () => {
    await expectProblem(await get('', {}), 401)
  })

  it('returns the list envelope with no-store caching', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()
    expect(body).toEqual({ items: expect.any(Array), total: 6, page: 1, pageSize: 25 })
    expect(body.items[0]).toMatchObject({ name: 'Arkadios Home Office', database: 'tenant_arkadios' })
  })

  it('is open to every role that holds tenants.view', async () => {
    for (const id of ['u1', 'u2', 'u3', 'u4']) expect((await get('', as(id))).status, id).toBe(200)
  })

  it('refuses a caller without tenants.view, as a problem', async () => {
    const original = permissions.support
    permissions.support = original.filter((k) => !k.startsWith('tenants.'))
    try {
      const body = await expectProblem(await get('', as('u2')), 403)
      expect(body.detail).toBe('Your role does not include Tenants.')
    } finally {
      permissions.support = original
    }
  })

  it('filters, sorts and pages from the query string', async () => {
    const body = await (await get('?status=active&sort=-usersUsed&page=2&pageSize=2')).json()
    expect(body).toMatchObject({ total: 4, page: 2, pageSize: 2 })
    expect(body.items.map((t: { usersUsed: number }) => t.usersUsed)).toEqual([64, 47])
  })

  it('url-decodes q', async () => {
    const body = await (await get('?q=' + encodeURIComponent('marlow & finch'))).json()
    expect(body.items.map((t: { name: string }) => t.name)).toEqual(['Marlow & Finch Partners'])
  })

  it('returns a validation problem with the error key per bad parameter', async () => {
    const body = await expectProblem(await get('?status=nope&sort=id&page=0&pageSize=500'), 400)
    expect(Object.keys(body.errors!).sort()).toEqual(['page', 'pageSize', 'sort', 'status'])
  })

  it('never exposes a connection string, only the database name', async () => {
    const text = await (await get()).text()
    expect(text).not.toMatch(/Server=|Password|connectionString/i)
    expect(text).toContain('tenant_northwind')
  })
})

describe('creating a tenant', () => {
  const as = (userId: string) => ({ Authorization: `Bearer mock-access.${userId}` })
  const GOOD = {
    name: 'Harbor Lane Advisors',
    domain: 'harbor-lane-advisors',
    planId: 'enterprise',
    userLimit: 80,
    region: 'us-west',
    adminEmail: 'it@harborlane.example',
  }
  const create = (body: unknown = GOOD, headers: Record<string, string> = as('u1')) => post('/tenants', body, headers)
  const getJson = (path: string, headers: Record<string, string> = as('u1')) => fetch(url(path), { headers })

  beforeEach(() => {
    resetMockTenants()
    setProvisionStepMs(850)
  })
  afterEach(() => {
    resetMockTenants()
    setProvisionStepMs(850)
  })

  it('needs a token, and tenants.manage (view is not enough)', async () => {
    await expectProblem(await create(GOOD, {}), 401)
    for (const id of ['u2', 'u3', 'u4']) {
      const body = await expectProblem(await create(GOOD, as(id)), 403)
      expect(body.detail, id).toBe('Your role cannot change Tenants.')
    }
  })

  it('answers 202 with the new id and a Location for the provisioning', async () => {
    const res = await create()
    expect(res.status).toBe(202)
    const { id } = await res.json()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.headers.get('Location')).toBe(`/api/platform/v1/tenants/${id}/provisioning`)
  })

  it('answers 400 with errors per field, and 409 with errors.domain', async () => {
    const bad = await expectProblem(await create({ ...GOOD, domain: 'No', userLimit: 0 }), 400)
    expect(Object.keys(bad.errors!).sort()).toEqual(['domain', 'userLimit'])
    const taken = await expectProblem(await create({ ...GOOD, domain: 'quillon' }), 409)
    expect(taken.errors).toEqual({ domain: ['This domain is already taken.'] })
  })

  it('answers 400 for a body that is not JSON', async () => {
    const res = await fetch(url('/tenants'), { method: 'POST', headers: { ...as('u1'), 'Content-Type': 'application/json' }, body: 'not json' })
    await expectProblem(res, 400)
  })

  it('serves the options the form needs to a role that can create', async () => {
    const res = await getJson('/tenants/options')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      plans: [
        { id: 'essentials', name: 'Essentials', blurb: 'Directory and service history', trialDays: 14 },
        { id: 'professional', name: 'Professional', blurb: 'Adds workflows, reports, AI', trialDays: 30 },
        { id: 'enterprise', name: 'Enterprise', blurb: 'Adds integrations and audit', trialDays: 30 },
      ],
      regions: [
        { id: 'us-east', name: 'US East' },
        { id: 'us-west', name: 'US West' },
        { id: 'eu-frankfurt', name: 'EU Frankfurt' },
      ],
      baseDomain: 'platform.example',
    })
    await expectProblem(await getJson('/tenants/options', {}), 401)
    await expectProblem(await getJson('/tenants/options', as('u2')), 403)
  })

  it('reports provisioning progress, then the result, and then lists the tenant', async () => {
    setProvisionStepMs(40)
    const { id } = await (await create()).json()

    const first = await getJson(`/tenants/${id}/provisioning`)
    expect(first.headers.get('Cache-Control')).toBe('no-store')
    const running = await first.json()
    expect(running.status).toBe('running')
    expect(running.steps).toHaveLength(5)
    expect(running.result).toBeUndefined()

    await new Promise((r) => setTimeout(r, 260))
    const done = await (await getJson(`/tenants/${id}/provisioning`)).json()
    expect(done).toMatchObject({
      status: 'succeeded',
      result: { name: 'Harbor Lane Advisors', domain: 'harbor-lane-advisors.platform.example', adminEmail: 'it@harborlane.example', trialDays: 30 },
    })

    const list = await (await getJson('/tenants?q=harbor')).json()
    expect(list.items).toHaveLength(1)
    expect(list.items[0]).toMatchObject({ id, status: 'trial', usersUsed: 1, userLimit: 80, planName: 'Enterprise' })
    expect(list.total).toBe(1)
  })

  it('does not list the tenant while it is still provisioning', async () => {
    await create()
    expect((await (await getJson('/tenants')).json()).total).toBe(6)
  })

  it('protects and 404s the provisioning endpoint', async () => {
    const { id } = await (await create()).json()
    await expectProblem(await getJson(`/tenants/${id}/provisioning`, {}), 401)
    await expectProblem(await getJson(`/tenants/${id}/provisioning`, as('u2')), 403)
    await expectProblem(await getJson('/tenants/00000000-0000-4000-8000-000000000000/provisioning'), 404)
  })
})

describe('plans', () => {
  const as = (userId: string) => ({ Authorization: `Bearer mock-access.${userId}` })
  const getPlans = (headers: Record<string, string> = as('u1')) => fetch(url('/plans'), { headers })
  const put = (id: string, body: unknown, headers: Record<string, string> = as('u1')) =>
    fetch(url(`/plans/${id}`), { method: 'PUT', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  const current = async (id = 'professional') => ((await (await getPlans()).json()).plans as Array<Record<string, unknown>>).find((p) => p.id === id)!

  beforeEach(() => resetMockPlans())
  afterEach(() => resetMockPlans())

  it('lists plans and modules for every role that can view plans, with no-store caching', async () => {
    for (const id of ['u1', 'u2', 'u3', 'u4']) expect((await getPlans(as(id))).status, id).toBe(200)
    const res = await getPlans()
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()
    expect(body.modules).toHaveLength(11)
    expect(body.plans.map((p: { id: string }) => p.id)).toEqual(['essentials', 'professional', 'enterprise'])
    expect(body.plans[0]).toEqual({
      id: 'essentials',
      name: 'Essentials',
      blurb: 'Directory and service history',
      tenantCount: 1,
      trialDays: 14,
      modules: expect.objectContaining({ directory: true, lifetime: true, reports: false }),
      version: 1,
    })
  })

  it('needs a token and plans.view', async () => {
    await expectProblem(await getPlans({}), 401)
    const { permissions } = await import('./db')
    const original = permissions.support
    permissions.support = original.filter((k) => !k.startsWith('plans.'))
    try {
      const body = await expectProblem(await getPlans(as('u2')), 403)
      expect(body.detail).toBe('Your role does not include Plans and modules.')
    } finally {
      permissions.support = original
    }
  })

  it('saves a plan for a role with plans.manage and returns it', async () => {
    const before = await current()
    const res = await put('professional', { modules: { ...(before.modules as object), integrations: true }, trialDays: 21, version: before.version })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toMatchObject({ id: 'professional', trialDays: 21, version: 2, modules: expect.objectContaining({ integrations: true }) })
    expect(await current()).toMatchObject({ trialDays: 21, version: 2 })
  })

  it('refuses a save from a role that can only view', async () => {
    const before = await current()
    const body = { modules: before.modules, trialDays: 21, version: before.version }
    await expectProblem(await put('professional', body, {}), 401)
    for (const id of ['u2', 'u3', 'u4']) {
      expect((await expectProblem(await put('professional', body, as(id)), 403)).detail, id).toBe('Your role cannot change plans.')
    }
    expect(await current()).toMatchObject({ trialDays: 30, version: 1 })
  })

  it('answers 404 for an unknown plan', async () => {
    const before = await current()
    await expectProblem(await put('gold', { modules: before.modules, trialDays: 5, version: 1 }), 404)
  })

  it('answers 400 with an error per bad field', async () => {
    const before = await current()
    const body = await expectProblem(await put('professional', { modules: { ...(before.modules as object), ticketing: true }, trialDays: 500, version: before.version }), 400)
    expect(Object.keys(body.errors!).sort()).toEqual(['modules.ticketing', 'trialDays'])
  })

  it('answers 400 for a body that is not JSON', async () => {
    const res = await fetch(url('/plans/professional'), { method: 'PUT', headers: { ...as('u1'), 'Content-Type': 'application/json' }, body: 'not json' })
    await expectProblem(res, 400)
  })

  it('answers 409 for a stale version, and applies nothing', async () => {
    const before = await current()
    const body = { modules: before.modules, trialDays: 21, version: before.version }
    expect((await put('professional', body)).status).toBe(200)
    const stale = await expectProblem(await put('professional', { ...body, trialDays: 77 }), 409)
    expect(stale.errors).toEqual({ version: ['This plan was changed by someone else. Reload to see the latest.'] })
    expect(await current()).toMatchObject({ trialDays: 21, version: 2 })
  })

  it('counts a tenant that has just been created, without a reload', async () => {
    setProvisionStepMs(20)
    try {
      const create = await post('/tenants', {
        name: 'Harbor Lane Advisors', domain: 'harbor-lane-advisors', planId: 'essentials', userLimit: 5, region: 'us-east', adminEmail: 'it@harborlane.example',
      }, as('u1'))
      expect(create.status).toBe(202)
      await new Promise((r) => setTimeout(r, 150))
      expect((await current('essentials')).tenantCount).toBe(2)
    } finally {
      resetMockTenants()
      setProvisionStepMs(850)
    }
  })

  it('shows the saved trial length in the create form options', async () => {
    const before = await current('essentials')
    await put('essentials', { modules: before.modules, trialDays: 21, version: before.version })
    const options = await (await fetch(url('/tenants/options'), { headers: as('u1') })).json()
    expect(options.plans.find((p: { id: string }) => p.id === 'essentials').trialDays).toBe(21)
  })
})

describe('billing', () => {
  const as = (userId: string) => ({ Authorization: `Bearer mock-access.${userId}` })
  const get = (path: string, headers: Record<string, string> = as('u1')) => fetch(url(path), { headers })
  const extend = (id: string, body: unknown, headers: Record<string, string> = as('u1')) => post(`/bills/${id}/extend`, body, headers)
  interface BillJson {
    id: string
    tenantName: string
    month: string
    deadline: string
    status: string
    payable: { amountMinor: number; currency: string }
    [key: string]: unknown
  }
  const bills = async (query = '') => (await (await get('/bills?pageSize=100' + query)).json()).items as BillJson[]

  beforeEach(() => resetMockBills())
  afterEach(() => resetMockBills())

  it('needs a token and billing.view on every read, and billing.manage to extend', async () => {
    const { permissions } = await import('./db')
    const id = (await bills())[0].id
    for (const path of ['/bills', '/bills/summary', `/bills/${id}/notice`, `/bills/${id}/invoice`]) {
      await expectProblem(await get(path, {}), 401)
    }
    await expectProblem(await extend(id, { days: 7 }, {}), 401)

    const original = permissions.support
    permissions.support = original.filter((k) => !k.startsWith('billing.'))
    try {
      for (const path of ['/bills', '/bills/summary', `/bills/${id}/notice`, `/bills/${id}/invoice`]) {
        expect((await expectProblem(await get(path, as('u2')), 403)).detail, path).toBe('Your role does not include Billing.')
      }
    } finally {
      permissions.support = original
    }
    // roles with view can read; only roles with manage can extend
    for (const user of ['u1', 'u2', 'u3', 'u4']) expect((await get('/bills', as(user))).status, user).toBe(200)
    for (const user of ['u2', 'u4']) {
      expect((await expectProblem(await extend(id, { days: 7 }, as(user)), 403)).detail, user).toBe('Your role cannot change billing.')
    }
    for (const user of ['u1', 'u3']) expect((await extend(id, { days: 7 }, as(user))).status, user).toBe(200)
  })

  it('lists bills in the envelope with money as integer minor units and a currency code', async () => {
    const res = await get('/bills')
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()
    expect(body).toMatchObject({ total: 10, page: 1, pageSize: 25 })
    expect(body.items[0].status).toBe('overdue') // overdue first, as the demo
    for (const bill of body.items) {
      for (const key of ['unitPrice', 'subtotal', 'tax', 'payable']) {
        expect(Number.isInteger(bill[key].amountMinor), `${key} is an integer`).toBe(true)
        expect(bill[key].currency).toBe('USD')
      }
      expect(Object.keys(bill).sort()).toEqual(
        ['billedUsers', 'deadline', 'id', 'month', 'payable', 'planId', 'planName', 'status', 'subtotal', 'tax', 'taxRateBps', 'tenantId', 'tenantName', 'unitPrice'].sort(),
      )
    }
  })

  it('filters, sorts and pages from the query string, and says which parameter is wrong', async () => {
    const body = await (await get('/bills?status=paid&sort=-payable&page=2&pageSize=2')).json()
    expect(body).toMatchObject({ total: 4, page: 2, pageSize: 2 })
    expect(body.items.map((b: { tenantName: string }) => b.tenantName.split(' ')[0])).toEqual(['Arkadios', 'Cobalt'])
    const bad = await expectProblem(await get('/bills?status=late&month=2026-13&sort=id&page=0&pageSize=500'), 400)
    expect(Object.keys(bad.errors!).sort()).toEqual(['month', 'page', 'pageSize', 'sort', 'status'])
  })

  it('serves the totals per currency, following the search and the month', async () => {
    const res = await get('/bills/summary')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const { totals } = await res.json()
    expect(totals).toEqual([{ currency: 'USD', billable: 3351240, collected: 1589378, notYetPaid: 1675620, overdue: 86242 }])
    expect((await (await get('/bills/summary?q=sterling')).json()).totals[0]).toMatchObject({ billable: 172484, overdue: 86242 })
    expect((await (await get('/bills/summary?q=zzz')).json()).totals).toEqual([])
    const bad = await expectProblem(await get('/bills/summary?month=nope'), 400)
    expect(Object.keys(bad.errors!)).toEqual(['month'])
  })

  it('serves the notice the tenant sees, as plain text, for an unpaid bill', async () => {
    const bill = (await bills('&status=pending'))[0]
    const res = await get(`/bills/${bill.id}/notice`)
    expect(res.status).toBe(200)
    const notice = await res.json()
    expect(notice.message).toMatch(/^Your bill for \w+ \d{4} is ready\. Pay your bill before \w{3} \d{1,2}, \d{4}\.$/)
    expect(notice.amountDue).toEqual(bill.payable)
    expect(notice.paymentMethods).toEqual(['stripe', 'paypal'])
    const paid = (await bills('&status=paid'))[0]
    expect((await expectProblem(await get(`/bills/${paid.id}/notice`), 409)).detail).toBe('This bill is already paid.')
    await expectProblem(await get('/bills/00000000-0000-4000-8000-000000000000/notice'), 404)
  })

  it('serves the invoice of a paid bill as a download the server names', async () => {
    const paid = (await bills('&status=paid'))[0]
    const res = await get(`/bills/${paid.id}/invoice`)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(res.headers.get('Content-Disposition')).toBe(`attachment; filename="invoice-${paid.month}-${paid.id}.html"`)
    expect(res.headers.get('Access-Control-Expose-Headers')).toBe('Content-Disposition')
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.text()).toContain(paid.tenantName)
    const unpaid = (await bills('&status=pending'))[0]
    expect((await expectProblem(await get(`/bills/${unpaid.id}/invoice`), 409)).detail).toBe('Only a paid bill has an invoice.')
    await expectProblem(await get('/bills/00000000-0000-4000-8000-000000000000/invoice'), 404)
  })

  it('extends a deadline, returns the bill, and an overdue bill is pending again', async () => {
    const overdue = (await bills('&status=overdue'))[0]
    const before = Date.parse(overdue.deadline)
    const res = await extend(overdue.id, { days: 7 })
    expect(res.status).toBe(200)
    const updated = await res.json()
    expect(updated).toMatchObject({ id: overdue.id, status: 'pending' })
    expect(Date.parse(updated.deadline)).toBeGreaterThan(before)
    expect(Math.abs(Date.parse(updated.deadline) - (Date.now() + 7 * 864e5))).toBeLessThan(5000)
    expect((await bills('&status=overdue')).length).toBe(0)
  })

  it('answers 400 for other numbers of days and unknown fields, 409 for a paid bill, 404 for an unknown one', async () => {
    const pending = (await bills('&status=pending'))[0]
    const bad = await expectProblem(await extend(pending.id, { days: 5 }), 400)
    expect(bad.errors).toEqual({ days: ['Choose 7, 14 or 30 days.'] })
    expect((await expectProblem(await extend(pending.id, { days: 7, status: 'paid' }), 400)).errors).toEqual({ status: ['Unknown field.'] })
    const res = await fetch(url(`/bills/${pending.id}/extend`), { method: 'POST', headers: { ...as('u1'), 'Content-Type': 'application/json' }, body: 'not json' })
    await expectProblem(res, 400)
    const paid = (await bills('&status=paid'))[0]
    expect((await expectProblem(await extend(paid.id, { days: 7 }), 409)).detail).toBe('This bill is already paid.')
    await expectProblem(await extend('00000000-0000-4000-8000-000000000000', { days: 7 }), 404)
  })

  it('is not idempotent: extending twice moves the deadline twice', async () => {
    const pending = (await bills('&status=pending'))[0]
    const first = await (await extend(pending.id, { days: 7 })).json()
    const second = await (await extend(pending.id, { days: 7 })).json()
    expect(Date.parse(second.deadline) - Date.parse(first.deadline)).toBe(7 * 864e5)
  })
})

describe('Access control endpoints', () => {
  const as = (userId: string, stamp = 0) => ({ Authorization: `Bearer mock-access.${userId}${stamp ? `.${stamp}` : ''}` })
  const send = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
    fetch(url(path), {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  const list = async (headers = as('u1')) => ((await (await send('GET', '/staff', headers)).json()) as { items: Array<{ id: string; version: number; role: string; status: string }> }).items
  const versionOf = async (id: string) => (await list()).find((m) => m.id === id)!.version
  let info: MockInstance<typeof console.info>

  beforeEach(() => {
    resetMockStaff()
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    info.mockRestore()
    resetMockStaff()
  })

  describe('reading', () => {
    it('needs a token, and access.view', async () => {
      await expectProblem(await send('GET', '/staff', {}), 401)
      await expectProblem(await send('GET', '/roles', {}), 401)
      const body = await expectProblem(await send('GET', '/staff', as('u2')), 403) // Support lead has no access control
      expect(body.detail).toBe('Your role does not include Access control.')
      await expectProblem(await send('GET', '/roles', as('u3')), 403)
    })

    it('is open to a read-only role, with no-store caching and the { items } envelope', async () => {
      for (const path of ['/staff', '/roles']) {
        const res = await send('GET', path, as('u4'))
        expect(res.status, path).toBe(200)
        expect(res.headers.get('Cache-Control')).toBe('no-store')
        expect(Object.keys(await res.json())).toEqual(['items'])
      }
    })
  })

  describe('writing needs access.manage', () => {
    it('refuses a read-only role on every write, and changes nothing', async () => {
      const calls: Array<[string, string, unknown?]> = [
        ['POST', '/staff', { name: 'Test Person', email: 'test.person@platform.example', role: 'support' }],
        ['PATCH', '/staff/u2', { role: 'billing', version: 1 }],
        ['DELETE', '/staff/u2?version=1'],
        ['POST', '/staff/u5/resend-invite'],
        ['PUT', '/roles/auditor/permissions', { permissions: [], version: 1 }],
      ]
      for (const [method, path, body] of calls) {
        const res = await send(method, path, as('u4'), body)
        const problem = await expectProblem(res, 403)
        expect(problem.detail, path).toBe('Your role cannot change access control.')
      }
      expect(await list()).toHaveLength(5)
      expect((await list()).find((m) => m.id === 'u2')?.role).toBe('support')
    })

    it('needs a token', async () => {
      await expectProblem(await send('PATCH', '/staff/u2', {}, { role: 'billing', version: 1 }), 401)
    })
  })

  describe('invite', () => {
    const invite = { name: 'Test Person', email: 'test.person@platform.example', role: 'support' }

    it('answers 201 with the person and a Location, and sends a set-password link instead of a password', async () => {
      const res = await send('POST', '/staff', as('u1'), invite)
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body).toMatchObject({ ...invite, status: 'invited', mfaEnrolled: false, version: 1 })
      expect(JSON.stringify(body)).not.toMatch(/password/i)
      expect(res.headers.get('Location')).toBe(`${API_BASE}/staff/${body.id}`)
      const mail = info.mock.calls.map((c) => String(c[0])).find((l) => l.includes(invite.email))!
      expect(mail).toContain('/reset-password#token=')
      expect(mail).not.toMatch(/demo-1234/)
    })

    it('refuses a password in the body', async () => {
      const body = await expectProblem(await send('POST', '/staff', as('u1'), { ...invite, password: 'demo-1234' }), 400)
      expect(body.errors).toEqual({ password: ['Unknown field.'] })
    })

    it('lets the invited person set a password with that link, and then sign in with MFA', async () => {
      await send('POST', '/staff', as('u1'), invite)
      const mail = info.mock.calls.map((c) => String(c[0])).find((l) => l.includes(invite.email))!
      const token = decodeURIComponent(mail.split('#token=')[1])
      expect((await post('/auth/login', { email: invite.email, password: 'correct horse battery' })).status).toBe(401) // not yet
      expect((await post('/auth/reset-password', { token, newPassword: 'correct horse battery' })).status).toBe(204)
      const staffNow = await list()
      expect(staffNow.find((m) => m.status === 'invited' && m.id !== 'u5')).toBeUndefined()
      expect(platformAuditLog().map((e) => e.action)).toEqual(['staff.invited', 'staff.activated'])
    })

    it('resends a new link to an invited person, and 409s for an active one', async () => {
      expect((await send('POST', '/staff/u5/resend-invite', as('u1'))).status).toBe(204)
      expect(info.mock.calls.some((c) => String(c[0]).includes('sofia.reyes@platform.example') && String(c[0]).includes('#token='))).toBe(true)
      await expectProblem(await send('POST', '/staff/u2/resend-invite', as('u1')), 409)
      await expectProblem(await send('POST', '/staff/nobody/resend-invite', as('u1')), 404)
    })

    it('is a 409 conflict for a duplicate email, with errors.email', async () => {
      const body = await expectProblem(await send('POST', '/staff', as('u1'), { ...invite, email: 'liam.carter@platform.example' }), 409)
      expect(body.errors).toEqual({ email: ['This person already has access.'] })
    })
  })

  describe('a change takes effect immediately', () => {
    const sessionOf = async (userId: string) => cookieOf(await post('/auth/mfa', { challengeId: `mock-challenge.${userId}`, code: DEMO_CODE }))!

    it('a role change ends the person\'s refresh session and the access token they hold', async () => {
      const cookie = await sessionOf('u3')
      expect((await send('GET', '/permissions', as('u3'))).status).toBe(200)
      const res = await send('PATCH', '/staff/u3', as('u1'), { role: 'auditor', version: 1 })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ id: 'u3', role: 'auditor', version: 2 })
      await expectProblem(await send('GET', '/permissions', as('u3')), 401) // the old stamp
      await expectProblem(await refresh(cookie), 401) // the refresh token was revoked
    })

    it('after signing in again the person has the new role and its keys', async () => {
      await send('PATCH', '/staff/u3', as('u1'), { role: 'auditor', version: 1 })
      const res = await post('/auth/mfa', { challengeId: 'mock-challenge.u3', code: DEMO_CODE })
      const session = await res.json()
      expect(session.user.role).toBe('auditor')
      const read = await send('GET', '/staff', { Authorization: `Bearer ${session.accessToken}` })
      expect(read.status).toBe(200) // an auditor can read access control
      expect((await send('GET', '/tenants', { Authorization: `Bearer ${session.accessToken}` })).status).toBe(200)
    })

    it('disabling ends the session and blocks sign-in with the same generic failure as a bad password', async () => {
      const cookie = await sessionOf('u2')
      expect((await send('PATCH', '/staff/u2', as('u1'), { status: 'deactivated', version: 1 })).status).toBe(200)
      await expectProblem(await send('GET', '/permissions', as('u2')), 401)
      await expectProblem(await refresh(cookie), 401)
      const failed = await expectProblem(await post('/auth/login', { email: 'omar.haddad@platform.example', password: DEMO_PASSWORD }), 401)
      expect(failed.detail).toBe('Incorrect email or password.')
      const wrong = await expectProblem(await post('/auth/login', { email: 'omar.haddad@platform.example', password: 'wrong' }), 401)
      expect({ type: failed.type, title: failed.title, detail: failed.detail }).toEqual({ type: wrong.type, title: wrong.title, detail: wrong.detail })
    })

    it('removing ends the session and blocks sign-in', async () => {
      const cookie = await sessionOf('u3')
      expect((await send('DELETE', `/staff/u3?version=${await versionOf('u3')}`, as('u1'))).status).toBe(204)
      await expectProblem(await send('GET', '/permissions', as('u3')), 401)
      await expectProblem(await refresh(cookie), 401)
      await expectProblem(await post('/auth/login', { email: 'priya.nair@platform.example', password: DEMO_PASSWORD }), 401)
      expect((await list()).map((m) => m.id)).not.toContain('u3')
    })

    it('reactivating lets the person sign in again', async () => {
      await send('PATCH', '/staff/u2', as('u1'), { status: 'deactivated', version: 1 })
      await send('PATCH', '/staff/u2', as('u1'), { status: 'active', version: 2 })
      expect((await post('/auth/login', { email: 'omar.haddad@platform.example', password: DEMO_PASSWORD })).status).toBe(200)
    })

    it('a change to what a role can do applies to the next request, without signing anyone out', async () => {
      expect((await send('GET', '/plans', as('u4'))).status).toBe(200)
      const keys = (await (await send('GET', '/roles', as('u1'))).json()).items.find((r: { id: string }) => r.id === 'auditor')
      const res = await send('PUT', '/roles/auditor/permissions', as('u1'), {
        permissions: keys.permissions.filter((k: string) => k !== 'plans.view'),
        version: keys.version,
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ id: 'auditor', version: 2 })
      const body = await expectProblem(await send('GET', '/plans', as('u4')), 403) // same token, new keys
      expect(body.detail).toBe('Your role does not include Plans and modules.')
      expect((await send('GET', '/staff', as('u4'))).status).toBe(200) // and still signed in
    })
  })

  describe('the safety rules as problems', () => {
    it('names the problem type and says why, for a person changing their own access', async () => {
      const body = await expectProblem(await send('PATCH', '/staff/u1', as('u1'), { role: 'auditor', version: 1 }), 409)
      expect(body.type).toContain('access/self-lockout')
      expect(body.detail).toBe('You cannot remove your own access to Access control. Ask another Super admin to do it.')
      expect((await expectProblem(await send('DELETE', '/staff/u1?version=1', as('u1')), 409)).type).toContain('access/self-lockout')
    })

    it('names escalation when a manager grants a role they do not hold', async () => {
      const { permissions } = await import('./db')
      permissions.support = [...permissions.support, 'access.manage'] // resetMockStaff puts it back
      const body = await expectProblem(await send('PATCH', '/staff/u5', as('u2'), { role: 'admin', version: 1 }), 409) // Sofia is a Support lead
      expect(body.type).toContain('access/escalation')
      const grantsTenants = [...permissions.support, 'tenants.manage']
      const role = await expectProblem(await send('PUT', '/roles/support/permissions', as('u2'), { permissions: grantsTenants, version: 1 }), 409)
      expect(role.type).toContain('access/escalation')
      const invite = await expectProblem(await send('POST', '/staff', as('u2'), { name: 'Test Person', email: 'test.person@platform.example', role: 'admin' }), 409)
      expect(invite.type).toContain('access/escalation')
    })

    it('names outranked when a manager changes someone who can do more than they can', async () => {
      const { permissions } = await import('./db')
      permissions.support = [...permissions.support, 'access.manage']
      for (const [method, path, body] of [
        ['PATCH', '/staff/u1', { role: 'support', version: 1 }],
        ['PATCH', '/staff/u1', { status: 'deactivated', version: 1 }],
        ['DELETE', '/staff/u3?version=1', undefined],
      ] as const) {
        const problem = await expectProblem(await send(method, path, as('u2'), body), 409)
        expect(problem.type, path).toContain('access/outranked')
        expect(problem.detail).toContain('can do things you cannot')
      }
      expect((await list()).find((m) => m.id === 'u1')).toMatchObject({ role: 'admin', status: 'active' })
      expect(platformAuditLog()).toEqual([])
    })

    it('names outranked when a manager edits a role that holds more than they do', async () => {
      const { permissions } = await import('./db')
      permissions.support = [...permissions.support, 'access.manage']
      for (const role of ['billing', 'auditor']) {
        const problem = await expectProblem(await send('PUT', `/roles/${role}/permissions`, as('u2'), { permissions: ['tenants.view'], version: 1 }), 409)
        expect(problem.type, role).toContain('access/outranked')
        expect(problem.detail).toContain('role can do things you cannot')
      }
      expect(permissions.billing).toContain('billing.manage')
      expect(platformAuditLog()).toEqual([])
    })

    it('says the Super admin role is locked', async () => {
      const body = await expectProblem(await send('PUT', '/roles/admin/permissions', as('u1'), { permissions: [], version: 1 }), 409)
      expect(body.type).toContain('access/role-locked')
    })

    it('puts a stale version under errors.version for a person and for a role', async () => {
      await send('PATCH', '/staff/u2', as('u1'), { role: 'billing', version: 1 })
      const person = await expectProblem(await send('PATCH', '/staff/u2', as('u1'), { role: 'auditor', version: 1 }), 409)
      expect(person.errors?.version).toHaveLength(1)
      const role = await expectProblem(await send('PUT', '/roles/auditor/permissions', as('u1'), { permissions: [], version: 9 }), 409)
      expect(role.errors?.version).toHaveLength(1)
    })
  })

  it('writes an audit entry for every successful change, and none for a refused one', async () => {
    await send('PATCH', '/staff/u1', as('u1'), { role: 'auditor', version: 1 }) // refused
    expect(platformAuditLog()).toEqual([])
    await send('POST', '/staff', as('u1'), { name: 'Test Person', email: 'test.person@platform.example', role: 'support' })
    await send('PATCH', '/staff/u2', as('u1'), { role: 'billing', version: 1 })
    await send('PATCH', '/staff/u2', as('u1'), { status: 'deactivated', version: 2 })
    await send('DELETE', '/staff/u2?version=3', as('u1'))
    await send('PUT', '/roles/auditor/permissions', as('u1'), { permissions: ['tenants.view'], version: 1 })
    expect(platformAuditLog().map((e) => [e.actorName, e.action])).toEqual([
      ['Dana Whitfield', 'staff.invited'],
      ['Dana Whitfield', 'staff.role-changed'],
      ['Dana Whitfield', 'staff.deactivated'],
      ['Dana Whitfield', 'staff.removed'],
      ['Dana Whitfield', 'role.permissions-changed'],
    ])
  })
})

describe('Support access endpoints', () => {
  const as = (userId: string) => ({ Authorization: `Bearer mock-access.${userId}` })
  const REASON = 'Checklist did not create tasks after a stage move'
  const tenantUrl = (path: string) => new URL(TENANT_API_BASE + path, location.href).href
  const send = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
    fetch(url(path), { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
  const json = async (res: Response) => (await res.json()) as any // eslint-disable-line @typescript-eslint/no-explicit-any

  async function target(tenantName = 'Northwind Advisory Group', userName = 'Elena Marsh') {
    const tenants = await json(await send('GET', '/support/tenants?pageSize=100', as('u2')))
    const tenantId = tenants.items.find((t: { name: string }) => t.name === tenantName).id
    const users = await json(await send('GET', `/tenants/${tenantId}/support-users?pageSize=100`, as('u2')))
    return { tenantId, tenantUserId: users.items.find((u: { name: string }) => u.name === userName).id }
  }
  const startBody = async (over: Record<string, unknown> = {}) => ({ ...(await target()), reason: REASON, durationMinutes: 30, mode: 'read', ...over })
  async function begin(userId = 'u2', over: Record<string, unknown> = {}) {
    const res = await send('POST', '/support-sessions', as(userId), await startBody(over))
    return { res, body: res.status === 201 ? await json(res.clone()) : null }
  }
  const exchange = (code: unknown) => fetch(tenantUrl('/auth/support-exchange'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
  let info: MockInstance<typeof console.info>

  beforeEach(() => {
    resetMockStaff()
    resetMockTenants()
    resetMockSupport()
    info = vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    info.mockRestore()
    resetMockStaff()
    resetMockTenants()
    resetMockSupport()
  })

  describe('who may read and who may start', () => {
    it('needs a token, and support.view to read the sessions', async () => {
      await expectProblem(await send('GET', '/support-sessions', {}), 401)
      const body = await expectProblem(await send('GET', '/support-sessions', as('u3')), 403) // Billing manager
      expect(body.detail).toBe('Your role does not include Support access.')
    })

    it('shows a read-only role the sessions, in the list envelope with no-store caching', async () => {
      const res = await send('GET', '/support-sessions', as('u4'))
      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(await res.json()).toMatchObject({ total: 2, page: 1, pageSize: 25, items: [expect.objectContaining({ status: 'ended', tenantName: 'Arkadios Home Office' }), expect.anything()] })
    })

    it('keeps a read-only role from starting a session or even listing who it could sign in as', async () => {
      const tenants = await expectProblem(await send('GET', '/support/tenants', as('u4')), 403)
      expect(tenants.detail).toBe('Your role cannot start support sessions.')
      const { tenantId } = await target()
      await expectProblem(await send('GET', `/tenants/${tenantId}/support-users`, as('u4')), 403)
      const start = await expectProblem(await send('POST', '/support-sessions', as('u4'), await startBody()), 403)
      expect(start.detail).toBe('Your role cannot start support sessions.')
    })

    it('refuses a bad status or page in the list, with every error at once', async () => {
      const body = await expectProblem(await send('GET', '/support-sessions?status=live&page=0&pageSize=500', as('u2')), 400)
      expect(Object.keys(body.errors!).sort()).toEqual(['page', 'pageSize', 'status'])
    })

    it('filters by status', async () => {
      await begin()
      const active = await json(await send('GET', '/support-sessions?status=active', as('u2')))
      expect(active).toMatchObject({ total: 1, items: [expect.objectContaining({ status: 'active', staffName: 'Omar Haddad' })] })
    })
  })

  describe('starting', () => {
    it('answers 201 with the session and a one-time code in the fragment, and never a tenant token', async () => {
      const { res, body } = await begin()
      expect(res.status).toBe(201)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(res.headers.get('Location')).toBe(`${API_BASE}/support-sessions/${body.session.id}`)
      expect(body.session).toMatchObject({ status: 'active', mode: 'read', durationMinutes: 30, reason: REASON })
      expect(body.handoff.expiresIn).toBe(60)
      const handoff = new URL(body.handoff.url)
      expect(handoff.hash).toBe(`#code=${body.handoff.code}`)
      expect(handoff.search).toBe('')
      expect(JSON.stringify(body)).not.toContain('mock-support.')
    })

    it('refuses a time that is not 15, 30 or 60, a short reason, and a field it does not know', async () => {
      const body = await expectProblem(await send('POST', '/support-sessions', as('u2'), await startBody({ durationMinutes: 45, reason: 'short', minutes: 45 })), 400)
      expect(Object.keys(body.errors!).sort()).toEqual(['durationMinutes', 'minutes', 'reason'])
    })

    it('names the rule when the tenant is not eligible', async () => {
      const tenants = await json(await send('GET', '/tenants?status=suspended', as('u2')))
      const body = await expectProblem(await send('POST', '/support-sessions', as('u2'), await startBody({ tenantId: tenants.items[0].id, tenantUserId: 'x' })), 409)
      expect(body.type).toContain('support/not-eligible')
      expect(body.detail).toContain('suspended')
    })

    it('asks to end the first session, naming it, before starting another', async () => {
      await begin()
      const body = await expectProblem((await begin()).res, 409)
      expect(body.type).toContain('support/session-active')
      expect(body.detail).toContain('Northwind Advisory Group')
    })

    it('never lets a support session start another one (no chaining), whatever its mode', async () => {
      const { body } = await begin('u2', { mode: 'edit' })
      const exchanged = await json(await exchange(body.handoff.code))
      const chained = await send('POST', '/support-sessions', { Authorization: `Bearer ${exchanged.accessToken}` }, await startBody())
      const problem = await expectProblem(chained, 403)
      expect(problem.type).toContain('support/no-chaining')
      expect((await send('GET', '/support-sessions', { Authorization: `Bearer ${exchanged.accessToken}` })).status).toBe(401) // the platform API does not know it
    })

    it('limits starts to 10 an hour per person, with Retry-After', async () => {
      const bad = await startBody({ reason: 'short' })
      const good = await startBody()
      for (let i = 0; i < 10; i += 1) await send('POST', '/support-sessions', as('u2'), bad)
      const res = await send('POST', '/support-sessions', as('u2'), good)
      await expectProblem(res, 429)
      expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
      expect((await send('POST', '/support-sessions', as('u1'), good)).status).toBe(201) // someone else is not held back
    })
  })

  describe('the tenant side of the handoff', () => {
    it('trades the code for a short token with no refresh token and no cookie', async () => {
      const { body } = await begin()
      const res = await exchange(body.handoff.code)
      expect(res.status).toBe(200)
      expect(res.headers.get('Cache-Control')).toBe('no-store')
      expect(res.headers.get('Set-Cookie')).toBeNull()
      const out = await res.json()
      expect(Object.keys(out).sort()).toEqual(['accessToken', 'expiresIn', 'session'])
      expect(out.expiresIn).toBeLessThanOrEqual(30 * 60)
      expect(out.session).toMatchObject({ actAs: { name: 'Omar Haddad' }, tenantUser: { name: 'Elena Marsh' }, reason: REASON, mode: 'read' })
    })

    it('works once: a wrong code and a reused code get the same generic 400', async () => {
      const { body } = await begin()
      const wrong = await expectProblem(await exchange('nope'), 400)
      expect((await exchange(body.handoff.code)).status).toBe(200)
      const reused = await expectProblem(await exchange(body.handoff.code), 400)
      expect({ type: reused.type, title: reused.title, detail: reused.detail }).toEqual({ type: wrong.type, title: wrong.title, detail: 'This support link is invalid or has expired.' })
      expect(wrong.detail).toBe('This support link is invalid or has expired.')
    })

    it('ends the session when a code is reused, and the token with it', async () => {
      const { body } = await begin()
      const { accessToken } = await json(await exchange(body.handoff.code))
      const tenantGet = () => fetch(tenantUrl('/support/session'), { headers: { Authorization: `Bearer ${accessToken}` } })
      expect((await tenantGet()).status).toBe(200)
      await exchange(body.handoff.code) // the second try
      expect((await tenantGet()).status).toBe(401)
      expect((await json(await send('GET', '/support-sessions?status=revoked', as('u2')))).total).toBe(1)
    })

    it('limits exchanges to 10 a minute', async () => {
      for (let i = 0; i < 10; i += 1) await exchange(`wrong-${i}`)
      const res = await exchange('wrong-11')
      await expectProblem(res, 429)
      expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    })

    it('stops the token the moment the session is ended from the console', async () => {
      const { body } = await begin()
      const { accessToken } = await json(await exchange(body.handoff.code))
      const tenantGet = () => fetch(tenantUrl('/support/session'), { headers: { Authorization: `Bearer ${accessToken}` } })
      expect((await tenantGet()).status).toBe(200)
      const ended = await send('POST', `/support-sessions/${body.session.id}/end`, as('u2'))
      expect(ended.status).toBe(200)
      expect(await json(ended)).toMatchObject({ status: 'ended', endedByName: 'Omar Haddad' })
      const after = await tenantGet()
      await expectProblem(after, 401)
    })

    it('ends from the workspace banner too', async () => {
      const { body } = await begin()
      const { accessToken } = await json(await exchange(body.handoff.code))
      const res = await fetch(tenantUrl('/support/session/end'), { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } })
      expect(await json(res)).toMatchObject({ status: 'ended', endedByName: 'Omar Haddad' })
      expect((await json(await send('GET', '/support-sessions/active', as('u2')))).session).toBeNull()
    })
  })

  describe('ending and revoking', () => {
    it('lets the owner end, and someone with support.manage revoke another\'s', async () => {
      const mine = (await begin('u2')).body
      const revoked = await send('POST', `/support-sessions/${mine.session.id}/end`, as('u1'))
      expect(await json(revoked)).toMatchObject({ status: 'revoked', endedByName: 'Dana Whitfield' })
      const hers = (await begin('u1')).body
      expect(await json(await send('POST', `/support-sessions/${hers.session.id}/end`, as('u1')))).toMatchObject({ status: 'ended' })
    })

    it('refuses anyone else', async () => {
      const mine = (await begin('u2')).body
      for (const user of ['u3', 'u4']) await expectProblem(await send('POST', `/support-sessions/${mine.session.id}/end`, as(user)), 403)
      await expectProblem(await send('POST', `/support-sessions/nope/end`, as('u2')), 404)
    })

    it('says a session is already over with 409', async () => {
      const mine = (await begin('u2')).body
      await send('POST', `/support-sessions/${mine.session.id}/end`, as('u2'))
      const body = await expectProblem(await send('POST', `/support-sessions/${mine.session.id}/end`, as('u2')), 409)
      expect(body.type).toContain('support/not-active')
    })

    it('does not end when the staff member signs out of the console', async () => {
      const login = await post('/auth/mfa', { challengeId: 'mock-challenge.u2', code: DEMO_CODE })
      const cookie = cookieOf(login)!
      await begin('u2')
      const out = await fetch(url('/auth/logout'), { method: 'POST', headers: { 'X-Requested-With': 'arkadios-web', Cookie: `refresh_token=${cookie}` } })
      expect(out.status).toBe(204)
      const active = await json(await send('GET', '/support-sessions/active', as('u2')))
      expect(active.session).toMatchObject({ status: 'active', tenantName: 'Northwind Advisory Group' })
    })

    it('ends when the staff member is disabled, as revoked', async () => {
      const mine = (await begin('u2')).body
      const res = await send('PATCH', '/staff/u2', as('u1'), { status: 'deactivated', version: 1 })
      expect(res.status).toBe(200)
      const list = await json(await send('GET', '/support-sessions?status=revoked', as('u1')))
      expect(list.items[0]).toMatchObject({ id: mine.session.id, endedByName: 'Dana Whitfield' })
    })
  })

  describe('a new link', () => {
    it('is for the owner, until the first exchange, and ends the previous code', async () => {
      const { body } = await begin()
      await expectProblem(await send('POST', `/support-sessions/${body.session.id}/handoff`, as('u1')), 403)
      const again = await json(await send('POST', `/support-sessions/${body.session.id}/handoff`, as('u2')))
      expect(again.handoff.code).not.toBe(body.handoff.code)
      await expectProblem(await exchange(body.handoff.code), 400)
      expect((await exchange(again.handoff.code)).status).toBe(200)
      const late = await expectProblem(await send('POST', `/support-sessions/${body.session.id}/handoff`, as('u2')), 409)
      expect(late.type).toContain('support/already-opened')
    })

    it('stops after 3', async () => {
      const { body } = await begin()
      for (let i = 0; i < 3; i += 1) expect((await send('POST', `/support-sessions/${body.session.id}/handoff`, as('u2'))).status).toBe(200)
      const limit = await expectProblem(await send('POST', `/support-sessions/${body.session.id}/handoff`, as('u2')), 409)
      expect(limit.type).toContain('support/reissue-limit')
    })
  })
})
