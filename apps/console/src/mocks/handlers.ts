import { delay, http, HttpResponse } from 'msw'
import type { SessionResponse } from '@/features/auth/api/types'
import { API_BASE, CSRF_HEADER } from '@/lib/api'
import { hasPermission } from '@/features/auth/hooks/permissions'
import { problem, sessionExpired, signInFailed, signInRequired, verificationFailed } from './problem'
import { createTenant, provisioningOf, settleProvisioning, tenantOptions } from './tenantCreate'
import { queryTenants } from './tenants'
import { ACCESS_TOKEN_SECONDS, DEMO_CODE, DEMO_PASSWORD, homeByRole, IDLE_MINUTES, permissions, staff, type SeedStaff } from './db'

const ACCESS_PREFIX = 'mock-access.'
const REFRESH_COOKIE = 'refresh_token'
const REFRESH_PREFIX = 'mock-refresh.' // cookie value: mock-refresh.<userId>.<version>
const CHALLENGE_PREFIX = 'mock-challenge.'

const tenantsForbidden = (change = false) =>
  problem(403, 'auth/forbidden', 'Forbidden', {
    detail: change ? 'Your role cannot change Tenants.' : 'Your role does not include Tenants.',
  })

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

// Password reset tokens (docs/ARCHITECTURE.md, Password reset): random, single-use, 30 minutes,
// and a new request invalidates earlier ones. A token is "mock-reset.<userId>.<issuedAtMs>.<nonce>" so
// a link stays valid after a page reload; the used and superseded lists are in memory and reset
// on reload, which only makes the mock more permissive.
const RESET_PREFIX = 'mock-reset.'
const RESET_TTL_MS = 30 * 60 * 1000
const latestResetIssuedAt = new Map<string, number>()
const usedResetTokens = new Set<string>()
const BREACHED_PASSWORDS = new Set(['password1234', 'qwertyuiop12', '123456789012', 'letmein123456'])

function issueResetToken(user: SeedStaff) {
  const issuedAt = Date.now()
  latestResetIssuedAt.set(user.id, issuedAt)
  return `${RESET_PREFIX}${user.id}.${issuedAt}.${crypto.randomUUID()}`
}

/** The user a reset token belongs to, or undefined when it is unknown, expired, used or superseded. */
function userForResetToken(token: unknown): SeedStaff | undefined {
  if (typeof token !== 'string' || usedResetTokens.has(token)) return undefined
  const match = /^mock-reset\.([^.]+)\.(\d+)\.[\w-]+$/.exec(token)
  if (!match) return undefined
  const issuedAt = Number(match[2])
  if (Date.now() - issuedAt > RESET_TTL_MS) return undefined
  if (issuedAt < (latestResetIssuedAt.get(match[1]) ?? 0)) return undefined
  return findActive(match[1])
}

const invalidResetLink = () =>
  problem(400, 'auth/invalid-reset-link', 'Invalid reset link', { detail: 'This reset link is invalid or has expired.' })

function weakPasswordReason(password: unknown, user: SeedStaff): string | undefined {
  if (typeof password !== 'string' || !password) return 'Enter a new password.'
  if (password.length < 12) return 'Use at least 12 characters.'
  if (password.toLowerCase() === user.email.toLowerCase()) return 'Do not use your email address as your password.'
  if (BREACHED_PASSWORDS.has(password.toLowerCase())) return 'This password has appeared in a data breach. Choose another.'
  return undefined
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

  // Same answer for known, unknown and disabled accounts: the response never says which.
  http.post(`${API_BASE}/auth/forgot-password`, async ({ request }) => {
    await delay(150)
    const { email } = (await request.json()) as { email?: unknown }
    if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return problem(400, 'validation', 'One or more validation errors occurred.', {
        errors: { email: ['Enter a valid email address.'] },
      })
    }
    // The real server sends the email from a job; the mock prints the link where the email would be.
    const user = staff.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (user?.status === 'active') {
      console.info(`[mock email] Password reset for ${user.email}: ${location.origin}/reset-password#token=${issueResetToken(user)}`)
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${API_BASE}/auth/reset-password`, async ({ request }) => {
    await delay(150)
    const { token, newPassword } = (await request.json()) as { token?: unknown; newPassword?: unknown }
    // Token first, so a bad link never reveals anything about the password or the account.
    const user = userForResetToken(token)
    if (!user) return invalidResetLink()
    const reason = weakPasswordReason(newPassword, user)
    if (reason) {
      return problem(400, 'validation', 'One or more validation errors occurred.', { errors: { newPassword: [reason] } })
    }
    usedResetTokens.add(token as string)
    // All refresh tokens for the user end; the user is not signed in and must pass MFA again.
    const family = families.get(user.id)
    if (family) family.revoked = true
    console.info(`[mock email] Your password was changed: ${user.email}`)
    return new HttpResponse(null, { status: 204 })
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

  http.get(`${API_BASE}/tenants`, async ({ request }) => {
    await delay(150)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    // The server is the authority: the UI hiding the menu is only cosmetic.
    if (!hasPermission(permissions, user.role, 'tenants.view')) return tenantsForbidden()
    settleProvisioning()
    const result = queryTenants(new URL(request.url).searchParams)
    if (!result.ok) {
      return problem(400, 'validation', 'One or more validation errors occurred.', { errors: result.errors })
    }
    return HttpResponse.json(result.body, { headers: { 'Cache-Control': 'no-store' } })
  }),

  // Options for the create form: plans, regions and the base domain, in one request.
  http.get(`${API_BASE}/tenants/options`, async ({ request }) => {
    await delay(100)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'tenants.manage')) return tenantsForbidden(true)
    return HttpResponse.json(tenantOptions())
  }),

  http.post(`${API_BASE}/tenants`, async ({ request }) => {
    await delay(200)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'tenants.manage')) return tenantsForbidden(true)
    const result = createTenant(await request.json().catch(() => null))
    if (!result.ok) {
      return result.status === 409
        ? problem(409, 'conflict', 'Conflict', { detail: 'A tenant already uses this domain.', errors: result.errors })
        : problem(400, 'validation', 'One or more validation errors occurred.', { errors: result.errors })
    }
    return HttpResponse.json({ id: result.id }, { status: 202, headers: { Location: `${API_BASE}/tenants/${result.id}/provisioning` } })
  }),

  // The create drawer polls this until the five steps are done.
  http.get(`${API_BASE}/tenants/:id/provisioning`, async ({ request, params }) => {
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'tenants.manage')) return tenantsForbidden(true)
    settleProvisioning()
    const job = provisioningOf(String(params.id))
    return job ? HttpResponse.json(job, { headers: { 'Cache-Control': 'no-store' } }) : problem(404, 'not-found', 'Not found', { detail: 'No such tenant.' })
  }),

  http.get(`${API_BASE}/permissions`, async ({ request }) => {
    await delay(100)
    if (!bearerUser(request)) return signInRequired()
    return HttpResponse.json(permissions)
  }),
]
