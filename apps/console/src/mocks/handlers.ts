import { delay, http, HttpResponse } from 'msw'
import type { SessionResponse } from '@/features/auth/api/types'
import { API_BASE, CSRF_HEADER, TENANT_API_BASE } from '@/lib/api'
import { hasPermission } from '@/features/auth/hooks/permissions'
import { problem, sessionExpired, signInFailed, signInRequired, verificationFailed } from './problem'
import { extendBill, invoiceOf, noticeOf, queryBills, summarizeBills } from './bills'
import { listPlans, updatePlan } from './plans'
import {
  activateInvited,
  inviteStaff,
  listRoles,
  listStaff,
  removeStaff,
  resendInvite,
  updateRole,
  updateStaff,
  type Failure,
  type Outcome,
} from './staff'
import {
  activeSessionOf,
  endSession,
  endSessionOfToken,
  exchangeHandoff,
  isSupportToken,
  listSessions,
  listSupportTenants,
  listSupportUsers,
  reissueHandoff,
  sessionOfToken,
  startSession,
  type Failure as SupportFailure,
  type Outcome as SupportOutcome,
} from './support'
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

const plansForbidden = (change = false) =>
  problem(403, 'auth/forbidden', 'Forbidden', {
    detail: change ? 'Your role cannot change plans.' : 'Your role does not include Plans and modules.',
  })

const billingForbidden = (change = false) =>
  problem(403, 'auth/forbidden', 'Forbidden', {
    detail: change ? 'Your role cannot change billing.' : 'Your role does not include Billing.',
  })

const accessForbidden = (change = false) =>
  problem(403, 'auth/forbidden', 'Forbidden', {
    detail: change ? 'Your role cannot change access control.' : 'Your role does not include Access control.',
  })

const asProblem = (f: Failure) => problem(f.status, f.slug, f.title, { detail: f.detail, errors: f.errors })

const supportForbidden = (change = false) =>
  problem(403, 'auth/forbidden', 'Forbidden', {
    detail: change ? 'Your role cannot start support sessions.' : 'Your role does not include Support access.',
  })

/** A support problem; a 429 says when to try again. */
function asSupportProblem(f: SupportFailure) {
  const res = problem(f.status, f.slug, f.title, { detail: f.detail, errors: f.errors })
  if (f.retryAfter) res.headers.set('Retry-After', String(f.retryAfter))
  return res
}

/** Runs a support rule for a signed-in person and maps the outcome to HTTP. */
function supportRun<T>(request: Request, need: 'support.view' | 'support.manage' | null, run: (actor: SeedStaff) => SupportOutcome<T>, ok: (value: T) => Response) {
  const user = bearerUser(request)
  if (!user) return signInRequired()
  if (need && !hasPermission(permissions, user.role, need)) return supportForbidden(need === 'support.manage')
  const result = run(user)
  return result.ok ? ok(result.value) : asSupportProblem(result)
}

const bearerToken = (request: Request) => request.headers.get('Authorization')?.replace(/^Bearer /, '')

const billNotFound = () => problem(404, 'not-found', 'Not found', { detail: 'No such bill.' })

function findActive(id: string): SeedStaff | undefined {
  return staff.find((u) => u.id === id && u.status === 'active')
}

/** A person who can still choose a password: active, or invited and not yet in. */
function findSettable(id: string): SeedStaff | undefined {
  return staff.find((u) => u.id === id && (u.status === 'active' || u.status === 'invited'))
}

/** The access token carries the user id and the security stamp; a bump of the stamp ends it. */
const accessToken = (user: SeedStaff) => ACCESS_PREFIX + user.id + (user.securityStamp ? `.${user.securityStamp}` : '')

function sessionFor(user: SeedStaff): SessionResponse {
  return {
    accessToken: accessToken(user),
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
  return findSettable(match[1])
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
  const match = token ? /^mock-access\.([^.]+)(?:\.(\d+))?$/.exec(token) : null
  const user = match ? findActive(match[1]) : undefined
  // The role and permissions are resolved from the live data on every request, never from the token.
  return user && user.securityStamp === Number(match?.[2] ?? 0) ? user : undefined
}

/** Ends every refresh token of these people (the backend also bumps the stamp and evicts the permission cache). */
function revokeSessions(userIds: string[]) {
  for (const id of userIds) families.set(id, { current: families.get(id)?.current ?? 0, revoked: true })
}

/** Runs the access rules for a signed-in person with the needed key, and maps the outcome to HTTP. */
async function accessWrite<T>(request: Request, run: (actor: SeedStaff) => Outcome<T>, ok: (value: T) => Response) {
  const user = bearerUser(request)
  if (!user) return signInRequired()
  if (!hasPermission(permissions, user.role, 'access.manage')) return accessForbidden(true)
  const result = run(user)
  if (!result.ok) return asProblem(result)
  revokeSessions(result.revokedUserIds)
  return ok(result.value)
}

const noStore = { 'Cache-Control': 'no-store' }

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
    activateInvited(user) // an invited person choosing a password is accepting the invitation
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

  http.get(`${API_BASE}/plans`, async ({ request }) => {
    await delay(150)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'plans.view')) return plansForbidden()
    settleProvisioning() // tenant counts include tenants whose setup just finished
    return HttpResponse.json(listPlans(), { headers: { 'Cache-Control': 'no-store' } })
  }),

  http.put(`${API_BASE}/plans/:id`, async ({ request, params }) => {
    await delay(200)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'plans.manage')) return plansForbidden(true)
    const result = updatePlan(String(params.id), await request.json().catch(() => null))
    if (result.ok) return HttpResponse.json(result.plan, { headers: { 'Cache-Control': 'no-store' } })
    if (result.status === 404) return problem(404, 'not-found', 'Not found', { detail: 'No such plan.' })
    return result.status === 409
      ? problem(409, 'conflict', 'Conflict', { detail: 'This plan was changed by someone else.', errors: result.errors })
      : problem(400, 'validation', 'One or more validation errors occurred.', { errors: result.errors })
  }),

  http.get(`${API_BASE}/bills`, async ({ request }) => {
    await delay(150)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'billing.view')) return billingForbidden()
    const result = queryBills(new URL(request.url).searchParams)
    if (!result.ok) return problem(400, 'validation', 'One or more validation errors occurred.', { errors: result.errors })
    return HttpResponse.json(result.body, { headers: { 'Cache-Control': 'no-store' } })
  }),

  // Totals per currency for the bills in scope (q and month).
  http.get(`${API_BASE}/bills/summary`, async ({ request }) => {
    await delay(120)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'billing.view')) return billingForbidden()
    const result = summarizeBills(new URL(request.url).searchParams)
    if (!result.ok) return problem(400, 'validation', 'One or more validation errors occurred.', { errors: result.errors })
    return HttpResponse.json(result.body, { headers: { 'Cache-Control': 'no-store' } })
  }),

  http.get(`${API_BASE}/bills/:id/notice`, async ({ request, params }) => {
    await delay(100)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'billing.view')) return billingForbidden()
    const result = noticeOf(String(params.id))
    if (result.ok) return HttpResponse.json(result.notice, { headers: { 'Cache-Control': 'no-store' } })
    return result.status === 404 ? billNotFound() : problem(409, 'conflict', 'Conflict', { detail: 'This bill is already paid.' })
  }),

  http.get(`${API_BASE}/bills/:id/invoice`, async ({ request, params }) => {
    await delay(100)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'billing.view')) return billingForbidden()
    const result = invoiceOf(String(params.id))
    if (!result.ok) {
      return result.status === 404 ? billNotFound() : problem(409, 'conflict', 'Conflict', { detail: 'Only a paid bill has an invoice.' })
    }
    return new HttpResponse(result.html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // The file name is the server's, built from the bill id and month. A cross-origin client needs it exposed.
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
        'Cache-Control': 'private, no-store',
      },
    })
  }),

  http.post(`${API_BASE}/bills/:id/extend`, async ({ request, params }) => {
    await delay(200)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'billing.manage')) return billingForbidden(true)
    const result = extendBill(String(params.id), await request.json().catch(() => null))
    if (result.ok) return HttpResponse.json(result.bill, { headers: { 'Cache-Control': 'no-store' } })
    if (result.status === 404) return billNotFound()
    if (result.status === 409) return problem(409, 'conflict', 'Conflict', { detail: 'This bill is already paid.' })
    return problem(400, 'validation', 'One or more validation errors occurred.', { errors: result.errors })
  }),

  http.get(`${API_BASE}/staff`, async ({ request }) => {
    await delay(150)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'access.view')) return accessForbidden()
    return HttpResponse.json(listStaff(), { headers: noStore })
  }),

  http.get(`${API_BASE}/roles`, async ({ request }) => {
    await delay(150)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'access.view')) return accessForbidden()
    return HttpResponse.json(listRoles(), { headers: noStore })
  }),

  http.post(`${API_BASE}/staff`, async ({ request }) => {
    await delay(200)
    const body = await request.json().catch(() => null)
    return accessWrite(
      request,
      (actor) => inviteStaff(actor, body),
      (member) => {
        const person = staff.find((u) => u.id === member.id)!
        // The real server sends this from a job; the mock prints the link where the email would be.
        console.info(`[mock email] Set your password for ${person.email}: ${location.origin}/reset-password#token=${issueResetToken(person)}`)
        return HttpResponse.json(member, { status: 201, headers: { ...noStore, Location: `${API_BASE}/staff/${member.id}` } })
      },
    )
  }),

  http.post(`${API_BASE}/staff/:id/resend-invite`, async ({ request, params }) => {
    await delay(200)
    return accessWrite(
      request,
      (actor) => resendInvite(actor, String(params.id)),
      (member) => {
        const person = staff.find((u) => u.id === member.id)!
        console.info(`[mock email] Set your password for ${person.email}: ${location.origin}/reset-password#token=${issueResetToken(person)}`)
        return new HttpResponse(null, { status: 204 })
      },
    )
  }),

  http.patch(`${API_BASE}/staff/:id`, async ({ request, params }) => {
    await delay(200)
    const body = await request.json().catch(() => null)
    return accessWrite(
      request,
      (actor) => updateStaff(actor, String(params.id), body),
      (member) => HttpResponse.json(member, { headers: noStore }),
    )
  }),

  http.delete(`${API_BASE}/staff/:id`, async ({ request, params }) => {
    await delay(200)
    const version = new URL(request.url).searchParams.get('version')
    return accessWrite(
      request,
      (actor) => removeStaff(actor, String(params.id), version),
      () => new HttpResponse(null, { status: 204 }),
    )
  }),

  http.put(`${API_BASE}/roles/:role/permissions`, async ({ request, params }) => {
    await delay(200)
    const body = await request.json().catch(() => null)
    return accessWrite(
      request,
      (actor) => updateRole(actor, String(params.role), body),
      (role) => HttpResponse.json(role, { headers: noStore }),
    )
  }),

  http.get(`${API_BASE}/support/tenants`, async ({ request }) => {
    await delay(150)
    return supportRun(request, 'support.manage', () => listSupportTenants(new URL(request.url).searchParams), (list) => HttpResponse.json(list, { headers: noStore }))
  }),

  http.get(`${API_BASE}/tenants/:id/support-users`, async ({ request, params }) => {
    await delay(150)
    return supportRun(
      request,
      'support.manage',
      () => listSupportUsers(String(params.id), new URL(request.url).searchParams),
      (list) => HttpResponse.json(list, { headers: noStore }),
    )
  }),

  http.get(`${API_BASE}/support-sessions`, async ({ request }) => {
    await delay(150)
    return supportRun(request, 'support.view', () => listSessions(new URL(request.url).searchParams), (list) => HttpResponse.json(list, { headers: noStore }))
  }),

  // The signed-in person's own open session, for the console banner.
  http.get(`${API_BASE}/support-sessions/active`, async ({ request }) => {
    await delay(100)
    const user = bearerUser(request)
    if (!user) return signInRequired()
    if (!hasPermission(permissions, user.role, 'support.view')) return supportForbidden()
    return HttpResponse.json({ session: activeSessionOf(user.id) }, { headers: noStore })
  }),

  http.post(`${API_BASE}/support-sessions`, async ({ request }) => {
    await delay(200)
    // A token from a support session never starts another one: no chaining.
    if (isSupportToken(bearerToken(request))) {
      return problem(403, 'support/no-chaining', 'Not allowed', { detail: 'A support session cannot start another support session.' })
    }
    const body = await request.json().catch(() => null)
    return supportRun(
      request,
      'support.manage',
      (actor) => startSession(actor, body, location.origin),
      (started) => HttpResponse.json(started, { status: 201, headers: { ...noStore, Location: `${API_BASE}/support-sessions/${started.session.id}` } }),
    )
  }),

  http.post(`${API_BASE}/support-sessions/:id/end`, async ({ request, params }) => {
    await delay(200)
    // The owner may always end their own; anyone else needs support.manage, which endSession checks.
    return supportRun(request, null, (actor) => endSession(actor, String(params.id)), (session) => HttpResponse.json(session, { headers: noStore }))
  }),

  http.post(`${API_BASE}/support-sessions/:id/handoff`, async ({ request, params }) => {
    await delay(200)
    return supportRun(
      request,
      null,
      (actor) => reissueHandoff(actor, String(params.id), location.origin),
      (issued) => HttpResponse.json(issued, { headers: noStore }),
    )
  }),

  // --- the tenant API, as far as the handoff goes (the workspace itself comes later) ---

  http.post(`${TENANT_API_BASE}/auth/support-exchange`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => null)) as { code?: unknown } | null
    const result = exchangeHandoff(body?.code)
    if (result.kind === 'ok') return HttpResponse.json(result.exchange, { headers: noStore }) // no refresh token, no cookie
    if (result.kind === 'limited') {
      const res = problem(429, 'rate-limited', 'Too many requests', { detail: 'Too many attempts. Try again shortly.' })
      res.headers.set('Retry-After', String(result.retryAfter))
      return res
    }
    // One answer for a wrong, expired, replaced or reused code.
    return problem(400, 'auth/invalid-handoff', 'Invalid link', { detail: 'This support link is invalid or has expired.' })
  }),

  http.get(`${TENANT_API_BASE}/support/session`, async ({ request }) => {
    await delay(50)
    const session = sessionOfToken(bearerToken(request))
    if (!session) return problem(401, 'auth/support-session-over', 'Support session over', { detail: 'This support session has ended.' })
    return HttpResponse.json(session, { headers: noStore })
  }),

  http.post(`${TENANT_API_BASE}/support/session/end`, async ({ request }) => {
    await delay(100)
    const ended = endSessionOfToken(bearerToken(request))
    if (!ended) return problem(401, 'auth/support-session-over', 'Support session over', { detail: 'This support session has ended.' })
    return HttpResponse.json(ended, { headers: noStore })
  }),

  http.get(`${API_BASE}/permissions`, async ({ request }) => {
    await delay(100)
    if (!bearerUser(request)) return signInRequired()
    return HttpResponse.json(permissions)
  }),
]
