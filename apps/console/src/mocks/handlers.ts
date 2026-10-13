import { delay, http, HttpResponse } from 'msw'
import type { SessionResponse } from '@/features/auth/api/types'
import { API_BASE } from '@/lib/api'
import { problem, sessionExpired, signInFailed, signInRequired, verificationFailed } from './problem'
import { DEMO_CODE, DEMO_PASSWORD, homeByRole, IDLE_MINUTES, permissions, staff, type SeedStaff } from './db'

const ACCESS_PREFIX = 'mock-access.'
const REFRESH_COOKIE = 'refresh_token'
const REFRESH_PREFIX = 'mock-refresh.'
const CHALLENGE_PREFIX = 'mock-challenge.'

function findActive(id: string): SeedStaff | undefined {
  return staff.find((u) => u.id === id && u.status === 'active')
}

function sessionFor(user: SeedStaff): SessionResponse {
  return {
    accessToken: ACCESS_PREFIX + user.id,
    idleMinutes: IDLE_MINUTES,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, home: homeByRole[user.role] },
  }
}

/** Mimics the real server: the refresh token travels only as an httpOnly cookie. */
function sessionResponse(user: SeedStaff) {
  return HttpResponse.json(sessionFor(user), {
    headers: { 'Set-Cookie': `${REFRESH_COOKIE}=${REFRESH_PREFIX}${user.id}; Path=/; HttpOnly; SameSite=Strict` },
  })
}

function bearerUser(request: Request): SeedStaff | undefined {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '')
  return token?.startsWith(ACCESS_PREFIX) ? findActive(token.slice(ACCESS_PREFIX.length)) : undefined
}

export const handlers = [
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    await delay(150)
    const { email, password } = (await request.json()) as { email?: unknown; password?: unknown }
    const errors: Record<string, string[]> = {}
    if (typeof email !== 'string' || !email.trim()) errors.email = ['Email is required.']
    if (typeof password !== 'string' || !password) errors.password = ['Password is required.']
    if (Object.keys(errors).length) {
      return problem(400, 'validation', 'One or more validation errors occurred.', { errors })
    }
    const user = staff.find((u) => u.email.toLowerCase() === (email as string).trim().toLowerCase())
    if (!user || user.status !== 'active' || password !== DEMO_PASSWORD) return signInFailed()
    return HttpResponse.json({ challengeId: CHALLENGE_PREFIX + user.id })
  }),

  http.post(`${API_BASE}/auth/mfa`, async ({ request }) => {
    await delay(150)
    const { challengeId, code } = (await request.json()) as { challengeId?: string; code?: string }
    const user = challengeId?.startsWith(CHALLENGE_PREFIX) ? findActive(challengeId.slice(CHALLENGE_PREFIX.length)) : undefined
    if (!user || code !== DEMO_CODE) return verificationFailed()
    return sessionResponse(user)
  }),

  // Restores the session after a page reload from the httpOnly cookie.
  http.post(`${API_BASE}/auth/refresh`, async ({ cookies }) => {
    await delay(100)
    const token = cookies[REFRESH_COOKIE]
    const user = token?.startsWith(REFRESH_PREFIX) ? findActive(token.slice(REFRESH_PREFIX.length)) : undefined
    return user ? sessionResponse(user) : sessionExpired()
  }),

  http.post(`${API_BASE}/auth/logout`, () =>
    new HttpResponse(null, {
      status: 204,
      headers: { 'Set-Cookie': `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` },
    }),
  ),

  http.get(`${API_BASE}/permissions`, async ({ request }) => {
    await delay(100)
    if (!bearerUser(request)) return signInRequired()
    return HttpResponse.json(permissions)
  }),
]
