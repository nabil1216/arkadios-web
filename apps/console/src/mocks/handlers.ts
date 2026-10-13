import { delay, http, HttpResponse } from 'msw'
import type { SessionResponse } from '@/features/auth/api/types'
import { API_BASE, CSRF_HEADER } from '@/lib/api'
import { problem, sessionExpired, signInFailed, signInRequired, verificationFailed } from './problem'
import { ACCESS_TOKEN_SECONDS, DEMO_CODE, DEMO_PASSWORD, homeByRole, IDLE_MINUTES, permissions, staff, type SeedStaff } from './db'

const ACCESS_PREFIX = 'mock-access.'
const REFRESH_COOKIE = 'refresh_token'
const REFRESH_PREFIX = 'mock-refresh.' // cookie value: mock-refresh.<userId>.<version>
const CHALLENGE_PREFIX = 'mock-challenge.'

function findActive(id: string): SeedStaff | undefined {
  return staff.find((u) => u.id === id && u.status === 'active')
}

function sessionFor(user: SeedStaff): SessionResponse {
  return {
    accessToken: ACCESS_PREFIX + user.id,
    expiresIn: ACCESS_TOKEN_SECONDS,
    idleMinutes: IDLE_MINUTES,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, home: homeByRole[user.role] },
  }
}

// Refresh-token rotation, as the real server does it: every refresh issues the next
// version and invalidates the previous one. Replaying an old version revokes the session.
// State is in memory, so a page reload resets it; an unknown family accepts the cookie it is given.
const families = new Map<string, { current: number; revoked: boolean }>()

const refreshCookie = (userId: string, version: number) =>
  `${REFRESH_COOKIE}=${REFRESH_PREFIX}${userId}.${version}; Path=/; HttpOnly; SameSite=Strict`
const clearedRefreshCookie = `${REFRESH_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`

/** Mimics the real server: the refresh token travels only as an httpOnly cookie. */
function sessionResponse(user: SeedStaff, version: number) {
  return HttpResponse.json(sessionFor(user), { headers: { 'Set-Cookie': refreshCookie(user.id, version) } })
}

function hasCsrfHeader(request: Request) {
  return request.headers.get(CSRF_HEADER.name) === CSRF_HEADER.value
}

const csrfRejected = () =>
  problem(403, 'auth/csrf', 'Forbidden', { detail: `Missing or invalid ${CSRF_HEADER.name} header.` })

function parseRefreshCookie(value: string | undefined) {
  const match = /^mock-refresh\.([^.]+)\.(\d+)$/.exec(value ?? '')
  return match ? { userId: match[1], version: Number(match[2]) } : null
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
    families.set(user.id, { current: 1, revoked: false })
    return sessionResponse(user, 1)
  }),

  // Restores the session after a page reload, and renews the access token before it ends.
  http.post(`${API_BASE}/auth/refresh`, async ({ request, cookies }) => {
    await delay(100)
    if (!hasCsrfHeader(request)) return csrfRejected()
    const token = parseRefreshCookie(cookies[REFRESH_COOKIE])
    const user = token ? findActive(token.userId) : undefined
    if (!token || !user) return sessionExpired()

    const family = families.get(user.id) ?? { current: token.version, revoked: false }
    families.set(user.id, family)
    if (family.revoked) return sessionExpired()
    if (token.version !== family.current) {
      // An old cookie was replayed: assume theft and end the whole session.
      family.revoked = true
      const res = sessionExpired()
      res.headers.append('Set-Cookie', clearedRefreshCookie)
      return res
    }
    family.current += 1
    return sessionResponse(user, family.current)
  }),

  http.post(`${API_BASE}/auth/logout`, ({ request, cookies }) => {
    if (!hasCsrfHeader(request)) return csrfRejected()
    const token = parseRefreshCookie(cookies[REFRESH_COOKIE])
    if (token) families.delete(token.userId)
    return new HttpResponse(null, { status: 204, headers: { 'Set-Cookie': clearedRefreshCookie } })
  }),

  http.get(`${API_BASE}/permissions`, async ({ request }) => {
    await delay(100)
    if (!bearerUser(request)) return signInRequired()
    return HttpResponse.json(permissions)
  }),
]
