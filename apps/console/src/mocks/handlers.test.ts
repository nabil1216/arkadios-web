import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { API_BASE } from '@/lib/api'
import { DEMO_CODE, DEMO_PASSWORD, permissions, staff } from './db'
import { handlers } from './handlers'
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
