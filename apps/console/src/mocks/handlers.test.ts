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
