import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { API_BASE } from '@/lib/api'
import { DEMO_CODE, DEMO_PASSWORD, staff } from './db'
import { handlers } from './handlers'

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
