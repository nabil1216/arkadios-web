import { delay, http, HttpResponse } from 'msw'
import type { SessionResponse } from '@/features/auth/types'
import { DEMO_CODE, DEMO_PASSWORD, homeByRole, IDLE_MINUTES, permissions, staff, type SeedStaff } from './db'

const ACCESS_PREFIX = 'mock-access.'
const REFRESH_COOKIE = 'refresh_token'
const REFRESH_PREFIX = 'mock-refresh.'
const CHALLENGE_PREFIX = 'mock-challenge.'

const unauthorized = (message: string) => HttpResponse.json({ message }, { status: 401 })

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
  http.post('/api/auth/login', async ({ request }) => {
    await delay(150)
    const { email, password } = (await request.json()) as { email?: string; password?: string }
    const user = staff.find((u) => u.email.toLowerCase() === email?.trim().toLowerCase())
    if (!user || user.status !== 'active' || password !== DEMO_PASSWORD) {
      return unauthorized('Incorrect email or password.')
    }
    if (user.mfa) return HttpResponse.json({ mfaRequired: true, challengeId: CHALLENGE_PREFIX + user.id })
    return sessionResponse(user)
  }),

  http.post('/api/auth/mfa', async ({ request }) => {
    await delay(150)
    const { challengeId, code } = (await request.json()) as { challengeId?: string; code?: string }
    const user = challengeId?.startsWith(CHALLENGE_PREFIX) ? findActive(challengeId.slice(CHALLENGE_PREFIX.length)) : undefined
    if (!user || code !== DEMO_CODE) return unauthorized('That code is not right.')
    return sessionResponse(user)
  }),

  // Restores the session after a page reload from the httpOnly cookie.
  http.post('/api/auth/refresh', async ({ cookies }) => {
    await delay(100)
    const token = cookies[REFRESH_COOKIE]
    const user = token?.startsWith(REFRESH_PREFIX) ? findActive(token.slice(REFRESH_PREFIX.length)) : undefined
    return user ? sessionResponse(user) : unauthorized('Session expired.')
  }),

  http.post('/api/auth/logout', () =>
    new HttpResponse(null, {
      status: 204,
      headers: { 'Set-Cookie': `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` },
    }),
  ),

  http.get('/api/permissions', async ({ request }) => {
    await delay(100)
    if (!bearerUser(request)) return unauthorized('Sign in required.')
    return HttpResponse.json(permissions)
  }),
]
