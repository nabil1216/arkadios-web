// Rules for the mocked Support access endpoints and the tenant-side handoff (docs/ARCHITECTURE.md, "Support access").
// Pure functions, like staff.ts; handlers.ts maps the results to HTTP. Times come from Date.now(), so tests can set the clock.
import {
  DURATIONS,
  REASON_RANGE,
  SESSION_STATUSES,
  SUPPORT_PROBLEM,
  type Duration,
  type Handoff,
  type SessionStatus,
  type SupportExchange,
  type SupportMode,
  type SupportSession,
  type SupportTenant,
  type SupportUser,
} from '@/features/support/api/types'
import { hasPermission } from '@/features/auth/hooks/permissions'
import { LIST_DEFAULTS, type ListResponse } from '@/lib/list'
import { resetAudit, writeAudit, type Actor } from './audit'
import { permissions, staff, type SeedStaff } from './db'
import { BASE_DOMAIN, tenantRecords } from './tenants'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
/** The handoff code lives this long (seconds on the wire). */
export const HANDOFF_SECONDS = 60
export const MAX_REISSUES = 3
export const STARTS_PER_HOUR = 10
const EXCHANGES_PER_MINUTE = 10

const SYSTEM: Actor = { id: 'system', name: 'System' }

export interface Failure {
  ok: false
  status: 400 | 403 | 404 | 409 | 429
  slug: string
  title: string
  detail?: string
  errors?: Record<string, string[]>
  /** Seconds, for a 429. */
  retryAfter?: number
}
export type Outcome<T> = { ok: true; value: T } | Failure

const failure = (f: Omit<Failure, 'ok'>): Failure => ({ ok: false, ...f })
const success = <T,>(value: T): Outcome<T> => ({ ok: true, value })
const invalid = (errors: Record<string, string[]>) =>
  failure({ status: 400, slug: 'validation', title: 'One or more validation errors occurred.', errors })
const notFound = (what: string) => failure({ status: 404, slug: 'not-found', title: 'Not found', detail: `No such ${what}.` })
const notActive = () => failure({ status: 409, slug: SUPPORT_PROBLEM.notActive, title: 'Conflict', detail: 'This support session is already over.' })

// --- tenant users (what the tenant database holds) -------------------------------------------------------------------

interface TenantUser {
  id: string
  name: string
  email: string
  status: 'active' | 'disabled'
  roleName: string
}

/** The demo's users per tenant, by subdomain (users in seedBase()). Ruth Calder is disabled, and Dana Whitfield is platform staff with a tenant login. */
const SEED_USERS: Record<string, Array<[string, string, TenantUser['status']?]>> = {
  arkadios: [['Priya Okafor', 'Advisor'], ['Mara Vance', 'Operations'], ['Alex Park', 'Administrator'], ['Dana Whitfield', 'Administrator']],
  northwind: [['Elena Marsh', 'Advisor'], ['Tom Hadley', 'Operations'], ['Ruth Calder', 'Advisor', 'disabled']],
  'cobalt-ridge': [['Jonas Weir', 'Advisor'], ['Aisha Rahman', 'Operations'], ['Cole Brandt', 'Administrator']],
  'marlow-finch': [['Helen Finch', 'Administrator'], ['Dev Anand', 'Advisor']],
  'sterling-hollow': [['Margot Hale', 'Administrator'], ['Ibrahim Sy', 'Advisor']],
  quillon: [['Sofia Lindqvist', 'Administrator'], ['Marek Novak', 'Advisor'], ['Anna Bell', 'Operations']],
}

function seedUsers(): Record<string, TenantUser[]> {
  const out: Record<string, TenantUser[]> = {}
  for (const [subdomain, list] of Object.entries(SEED_USERS)) {
    const tenant = tenantRecords.find((t) => t.domain === `${subdomain}.${BASE_DOMAIN}`)
    if (!tenant) continue
    const domain = tenant.domain
    out[tenant.id] = list.map(([name, roleName, status]) => ({
      id: crypto.randomUUID(),
      name,
      // Dana Whitfield's tenant login uses her platform address: that is how a staff member is recognised.
      email: name === 'Dana Whitfield' ? 'dana.whitfield@platform.example' : `${name.toLowerCase().replace(/ /g, '.')}@${domain}`,
      status: status ?? 'active',
      roleName,
    }))
  }
  return out
}

/** Every tenant user the mock holds, eligible or not, so a test can aim at one the lists would never show. */
export const allTenantUsers = (tenantId: string): ReadonlyArray<Readonly<{ id: string; name: string; status: string }>> => tenantUsers[tenantId] ?? []

/** A tenant login that belongs to a platform staff member can never be targeted. */
const isPlatformStaff = (user: TenantUser) => staff.some((s) => s.email.toLowerCase() === user.email.toLowerCase())

// --- state -------------------------------------------------------------------------------------------------------------

interface SessionRecord {
  id: string
  staffId: string
  staffName: string
  tenantId: string
  tenantName: string
  tenantUserId: string
  tenantUserName: string
  reasonId: string
  reason: string
  mode: SupportMode
  durationMinutes: Duration
  startedAt: number
  expiresAt: number
  endedAt: number | null
  status: SessionStatus
  endedById: string | null
  endedByName: string | null
  reissues: number
  /** True once a code was exchanged for a token: no new code can be issued after that. */
  exchanged: boolean
}

type CodeState = 'valid' | 'used' | 'superseded'
interface CodeRecord {
  sessionId: string
  issuedAt: number
  state: CodeState
}

let tenantUsers = seedUsers()
let sessions: SessionRecord[] = []
let codes = new Map<string, CodeRecord>()
let startAttempts = new Map<string, number[]>()
let exchangeAttempts: number[] = []

function seedSessions(): SessionRecord[] {
  const now = Date.now()
  const past = (daysAgo: number, hoursAgo: number, lengthMin: number, subdomain: string, user: string, reason: string): SessionRecord => {
    const startedAt = now - daysAgo * 86_400_000 - hoursAgo * HOUR
    const tenant = tenantRecords.find((t) => t.domain === `${subdomain}.${BASE_DOMAIN}`)!
    const who = tenantUsers[tenant.id].find((u) => u.name === user)!
    return {
      id: crypto.randomUUID(),
      staffId: 'u2',
      staffName: 'Omar Haddad',
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantUserId: who.id,
      tenantUserName: who.name,
      reasonId: crypto.randomUUID(),
      reason,
      mode: 'read',
      durationMinutes: 30,
      startedAt,
      expiresAt: startedAt + 30 * MINUTE,
      endedAt: startedAt + lengthMin * MINUTE,
      status: 'ended',
      endedById: 'u2',
      endedByName: 'Omar Haddad',
      reissues: 0,
      exchanged: true,
    }
  }
  // The demo's two past sessions (s1 and s2 in seed()).
  return [
    past(2, 2, 30, 'arkadios', 'Priya Okafor', 'Checklist not creating tasks after a stage move'),
    past(9, 4, 24, 'northwind', 'Elena Marsh', 'Report export timed out for a large advisor list'),
  ]
}

/** Back to the demo's sessions and users, no codes, no rate limit history and an empty audit log (tests). */
export function resetMockSupport() {
  tenantUsers = seedUsers()
  sessions = seedSessions()
  codes = new Map()
  startAttempts = new Map()
  exchangeAttempts = []
  resetAudit()
}
resetMockSupport()

const iso = (ms: number) => new Date(ms).toISOString()

const toDto = (s: SessionRecord): SupportSession => ({
  id: s.id,
  staffId: s.staffId,
  staffName: s.staffName,
  tenantId: s.tenantId,
  tenantName: s.tenantName,
  tenantUserId: s.tenantUserId,
  tenantUserName: s.tenantUserName,
  reasonId: s.reasonId,
  reason: s.reason,
  mode: s.mode,
  durationMinutes: s.durationMinutes,
  startedAt: iso(s.startedAt),
  expiresAt: iso(s.expiresAt),
  endedAt: s.endedAt === null ? null : iso(s.endedAt),
  status: s.status,
  endedById: s.endedById,
  endedByName: s.endedByName,
})

/** Every audit entry for a session carries who, the tenant, the tenant user and the reason. */
function auditSession(actor: Actor, action: string, s: SessionRecord, changes: Array<{ field: string; old: unknown; new: unknown }>, extra: Record<string, unknown> = {}) {
  writeAudit(actor, action, 'SupportSession', s.id, `${s.tenantName} as ${s.tenantUserName}`, changes, {
    staffId: s.staffId,
    staffName: s.staffName,
    tenantId: s.tenantId,
    tenantName: s.tenantName,
    tenantUserId: s.tenantUserId,
    tenantUserName: s.tenantUserName,
    reasonId: s.reasonId,
    reason: s.reason,
    mode: s.mode,
    ...extra,
  })
}

/** A session whose time is up is expired: it stops working at once, and the audit entry is written when it is first seen. */
function settle(now = Date.now()) {
  for (const s of sessions) {
    if (s.status === 'active' && s.expiresAt <= now) {
      s.status = 'expired'
      s.endedAt = s.expiresAt
      auditSession(SYSTEM, 'support.expired', s, [{ field: 'status', old: 'active', new: 'expired' }])
    }
  }
}

function close(s: SessionRecord, status: 'ended' | 'revoked', by: Actor, action: string, extra: Record<string, unknown> = {}) {
  s.status = status
  s.endedAt = Date.now()
  s.endedById = by.id
  s.endedByName = by.name
  auditSession(by, action, s, [{ field: 'status', old: 'active', new: status }], extra)
}

// --- eligibility lists ------------------------------------------------------------------------------------------------

type ListQuery = { ok: true; q: string; page: number; pageSize: number } | { ok: false; errors: Record<string, string[]> }

function pageParams(query: URLSearchParams): ListQuery {
  const errors: Record<string, string[]> = {}
  const q = (query.get('q') ?? '').trim()
  if (q.length > LIST_DEFAULTS.maxQueryLength) errors.q = [`Use ${LIST_DEFAULTS.maxQueryLength} characters or fewer.`]
  const num = (key: string, fallback: number, min: number, max: number) => {
    const raw = query.get(key)
    if (raw === null || raw === '') return fallback
    const n = Number(raw)
    if (!/^\d+$/.test(raw) || n < min || n > max) {
      errors[key] = [`Enter a whole number from ${min} to ${max}.`]
      return fallback
    }
    return n
  }
  const page = num('page', LIST_DEFAULTS.page, 1, 1_000_000)
  const pageSize = num('pageSize', LIST_DEFAULTS.pageSize, 1, LIST_DEFAULTS.maxPageSize)
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, q, page, pageSize }
}

function paged<T>(items: T[], page: number, pageSize: number): ListResponse<T> {
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize }
}

const contains = (value: string, q: string) => value.toLowerCase().includes(q.toLowerCase())
const eligibleTenantStatus = (status: string) => status === 'active' || status === 'trial'

/** Tenants a session can target: active and trial only (a business rule to confirm with the client). */
export function listSupportTenants(query: URLSearchParams): Outcome<ListResponse<SupportTenant>> {
  const p = pageParams(query)
  if (!p.ok) return invalid(p.errors)
  const items = tenantRecords
    .filter((t) => eligibleTenantStatus(t.status) && (!p.q || contains(t.name, p.q) || contains(t.domain, p.q)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((t): SupportTenant => ({ id: t.id, name: t.name, domain: t.domain, status: t.status as 'active' | 'trial' }))
  return success(paged(items, p.page, p.pageSize))
}

const notEligibleTenant = (name: string, status: string) =>
  failure({
    status: 409,
    slug: SUPPORT_PROBLEM.notEligible,
    title: 'Not allowed',
    detail: `${name} is ${status}. Support sessions are only available for active and trial tenants.`,
  })

/** Active tenant users only, and never a platform staff member's login. */
export function listSupportUsers(tenantId: string, query: URLSearchParams): Outcome<ListResponse<SupportUser>> {
  const tenant = tenantRecords.find((t) => t.id === tenantId)
  if (!tenant) return notFound('tenant')
  if (!eligibleTenantStatus(tenant.status)) return notEligibleTenant(tenant.name, tenant.status)
  const p = pageParams(query)
  if (!p.ok) return invalid(p.errors)
  const items = (tenantUsers[tenantId] ?? [])
    .filter((u) => u.status === 'active' && !isPlatformStaff(u) && (!p.q || contains(u.name, p.q)))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((u): SupportUser => ({ id: u.id, name: u.name, roleName: u.roleName }))
  return success(paged(items, p.page, p.pageSize))
}

// --- sessions ---------------------------------------------------------------------------------------------------------

export function listSessions(query: URLSearchParams): Outcome<ListResponse<SupportSession>> {
  settle()
  const errors: Record<string, string[]> = {}
  const status = query.get('status') || undefined
  if (status && !(SESSION_STATUSES as readonly string[]).includes(status)) errors.status = [`Status must be one of: ${SESSION_STATUSES.join(', ')}.`]
  const p = pageParams(query)
  if (!p.ok) Object.assign(errors, p.errors)
  if (Object.keys(errors).length || !p.ok) return invalid(errors)
  const items = sessions
    .filter((s) => !status || s.status === status)
    .sort((a, b) => b.startedAt - a.startedAt || a.id.localeCompare(b.id))
    .map(toDto)
  return success(paged(items, p.page, p.pageSize))
}

/** The signed-in person's own open session, or null. */
export function activeSessionOf(staffId: string): SupportSession | null {
  settle()
  const s = sessions.find((x) => x.staffId === staffId && x.status === 'active')
  return s ? toDto(s) : null
}

const FIELDS = ['tenantId', 'tenantUserId', 'reason', 'durationMinutes', 'mode']
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/

function newCode(s: SessionRecord, origin: string): Handoff {
  // A new code ends the old one.
  for (const entry of codes.values()) if (entry.sessionId === s.id && entry.state === 'valid') entry.state = 'superseded'
  const code = `mock-handoff.${(crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')}`
  codes.set(code, { sessionId: s.id, issuedAt: Date.now(), state: 'valid' })
  // The real URL is https://<tenant domain>/support-handoff#code=...; in the mock the stand-in workspace page serves it.
  return { code, url: `${origin}/mock-workspace/support-handoff#code=${code}`, expiresIn: HANDOFF_SECONDS }
}

/**
 * POST /support-sessions. Order: rate limit (429), 400, an open session of your own (409), tenant (404, not-eligible 409),
 * user (404, not-eligible 409). Every request that gets this far counts against 10 starts per hour, whatever its outcome.
 */
export function startSession(actor: SeedStaff, body: unknown, origin: string): Outcome<{ session: SupportSession; handoff: Handoff }> {
  const now = Date.now()
  const recent = (startAttempts.get(actor.id) ?? []).filter((t) => now - t < HOUR)
  if (recent.length >= STARTS_PER_HOUR) {
    startAttempts.set(actor.id, recent)
    return failure({
      status: 429,
      slug: 'rate-limited',
      title: 'Too many requests',
      detail: 'You have started too many support sessions this hour. Try again later.',
      retryAfter: Math.max(1, Math.ceil((recent[0] + HOUR - now) / 1000)),
    })
  }
  startAttempts.set(actor.id, [...recent, now])

  const raw = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
  const errors: Record<string, string[]> = {}
  for (const key of Object.keys(raw)) if (!FIELDS.includes(key)) errors[key] = ['Unknown field.']
  if (typeof raw.tenantId !== 'string' || !raw.tenantId) errors.tenantId = ['Choose a tenant.']
  if (typeof raw.tenantUserId !== 'string' || !raw.tenantUserId) errors.tenantUserId = ['Choose a user.']
  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : ''
  if (reason.length < REASON_RANGE.min) errors.reason = [`Describe why you need access, in at least ${REASON_RANGE.min} characters.`]
  else if (reason.length > REASON_RANGE.max) errors.reason = [`Use ${REASON_RANGE.max} characters or fewer.`]
  else if (CONTROL_CHARS.test(reason)) errors.reason = ['Use plain text only.']
  if (!(DURATIONS as readonly unknown[]).includes(raw.durationMinutes)) errors.durationMinutes = ['Choose 15, 30 or 60 minutes.']
  if (raw.mode !== 'read' && raw.mode !== 'edit') errors.mode = ['Choose read only or edit.']
  if (Object.keys(errors).length) return invalid(errors)

  settle(now)
  const open = sessions.find((s) => s.staffId === actor.id && s.status === 'active')
  if (open) {
    return failure({
      status: 409,
      slug: SUPPORT_PROBLEM.sessionActive,
      title: 'Conflict',
      detail: `You already have a support session open on ${open.tenantName}. End it before starting another.`,
    })
  }

  const tenant = tenantRecords.find((t) => t.id === raw.tenantId)
  if (!tenant) return notFound('tenant')
  if (!eligibleTenantStatus(tenant.status)) return notEligibleTenant(tenant.name, tenant.status)
  const user = (tenantUsers[tenant.id] ?? []).find((u) => u.id === raw.tenantUserId)
  if (!user) return notFound('user')
  // A disabled user and a platform staff member's login look the same from here: neither can be signed in as.
  if (user.status !== 'active' || isPlatformStaff(user)) {
    return failure({ status: 409, slug: SUPPORT_PROBLEM.notEligible, title: 'Not allowed', detail: 'You cannot sign in as that user.' })
  }

  const duration = raw.durationMinutes as Duration
  const s: SessionRecord = {
    id: crypto.randomUUID(),
    staffId: actor.id,
    staffName: actor.name,
    tenantId: tenant.id,
    tenantName: tenant.name,
    tenantUserId: user.id,
    tenantUserName: user.name,
    reasonId: crypto.randomUUID(),
    reason,
    mode: raw.mode as SupportMode,
    durationMinutes: duration,
    startedAt: now,
    expiresAt: now + duration * MINUTE,
    endedAt: null,
    status: 'active',
    endedById: null,
    endedByName: null,
    reissues: 0,
    exchanged: false,
  }
  sessions.push(s)
  auditSession(actor, 'support.started', s, [{ field: 'status', old: null, new: 'active' }], { durationMinutes: duration })
  return success({ session: toDto(s), handoff: newCode(s, origin) })
}

/** POST /support-sessions/{id}/end: the owner always, anyone else only with support.manage (a revoke). */
export function endSession(actor: SeedStaff, id: string): Outcome<SupportSession> {
  settle()
  const s = sessions.find((x) => x.id === id)
  if (!s) return notFound('session')
  if (s.status !== 'active') return notActive()
  const owner = s.staffId === actor.id
  if (!owner && !hasPermission(permissions, actor.role, 'support.manage')) {
    return failure({
      status: 403,
      slug: 'auth/forbidden',
      title: 'Forbidden',
      detail: 'Only the person who started this session, or someone who can change support access, can end it.',
    })
  }
  if (owner) close(s, 'ended', actor, 'support.ended')
  else close(s, 'revoked', actor, 'support.revoked')
  return success(toDto(s))
}

/** A new link for the same session: owner only, only until the first exchange, at most 3 times, each one ends the last. */
export function reissueHandoff(actor: SeedStaff, id: string, origin: string): Outcome<{ handoff: Handoff }> {
  settle()
  const s = sessions.find((x) => x.id === id)
  if (!s) return notFound('session')
  if (s.staffId !== actor.id) {
    return failure({ status: 403, slug: 'auth/forbidden', title: 'Forbidden', detail: 'Only the person who started this session can ask for a new link.' })
  }
  if (s.status !== 'active') return notActive()
  if (s.exchanged) {
    return failure({ status: 409, slug: SUPPORT_PROBLEM.alreadyOpened, title: 'Conflict', detail: 'This session has already been opened in the workspace.' })
  }
  if (s.reissues >= MAX_REISSUES) {
    return failure({ status: 409, slug: SUPPORT_PROBLEM.reissueLimit, title: 'Conflict', detail: `A new link can be requested ${MAX_REISSUES} times. End this session and start a new one.` })
  }
  s.reissues += 1
  auditSession(actor, 'support.handoff-reissued', s, [{ field: 'reissues', old: s.reissues - 1, new: s.reissues }])
  return success({ handoff: newCode(s, origin) })
}

/** Ends every open session of a staff member as revoked: their access was removed, disabled, or lost support.manage. */
export function revokeSessionsOf(staffId: string, by: Actor, why: string): number {
  settle()
  let n = 0
  for (const s of sessions) {
    if (s.staffId === staffId && s.status === 'active') {
      close(s, 'revoked', by, 'support.revoked', { why })
      n += 1
    }
  }
  return n
}

// --- the tenant side (what the tenant API does with a code and a token) --------------------------------------------------

export type ExchangeResult = { kind: 'ok'; exchange: SupportExchange } | { kind: 'invalid' } | { kind: 'limited'; retryAfter: number }

/**
 * POST /api/v1/auth/support-exchange. Single use, 60 seconds, rate limited. Wrong, expired, replaced and reused codes all
 * give the same answer. A reused code also revokes its session, because only a copy of the code can explain a second try.
 */
export function exchangeHandoff(code: unknown): ExchangeResult {
  const now = Date.now()
  exchangeAttempts = exchangeAttempts.filter((t) => now - t < MINUTE)
  if (exchangeAttempts.length >= EXCHANGES_PER_MINUTE) {
    return { kind: 'limited', retryAfter: Math.max(1, Math.ceil((exchangeAttempts[0] + MINUTE - now) / 1000)) }
  }
  exchangeAttempts.push(now)

  settle(now)
  const entry = typeof code === 'string' ? codes.get(code) : undefined
  if (!entry) return { kind: 'invalid' }
  const s = sessions.find((x) => x.id === entry.sessionId)
  if (!s) return { kind: 'invalid' }
  if (entry.state === 'used') {
    if (s.status === 'active') {
      auditSession(SYSTEM, 'support.handoff-replayed', s, [])
      close(s, 'revoked', { id: SYSTEM.id, name: 'Handoff code reused' }, 'support.revoked', { why: 'handoff code reused' })
    }
    return { kind: 'invalid' }
  }
  if (entry.state !== 'valid' || now - entry.issuedAt > HANDOFF_SECONDS * 1000 || s.status !== 'active') return { kind: 'invalid' }

  entry.state = 'used'
  s.exchanged = true
  return {
    kind: 'ok',
    exchange: {
      accessToken: `mock-support.${s.id}`,
      // Short and not renewable: it ends with the session, and there is no refresh token to extend it.
      expiresIn: Math.max(1, Math.floor((s.expiresAt - now) / 1000)),
      session: {
        id: s.id,
        actAs: { id: s.staffId, name: s.staffName },
        tenantUser: { id: s.tenantUserId, name: s.tenantUserName },
        reason: s.reason,
        mode: s.mode,
        expiresAt: iso(s.expiresAt),
      },
    },
  }
}

const TOKEN = /^mock-support\.([\w-]+)$/

export const isSupportToken = (token: string | undefined) => !!token && TOKEN.test(token)

/** What the support token says (the claims a JWT would carry): who acts as whom, the session, the reason and the expiry. */
export function supportTokenClaims(token: string) {
  const s = sessions.find((x) => x.id === TOKEN.exec(token)?.[1])
  return s
    ? { sub: s.tenantUserId, act_as: s.staffId, sid: s.id, rid: s.reasonId, mode: s.mode, exp: Math.floor(s.expiresAt / 1000) }
    : null
}

/** The open session behind a token, or null when it ended, expired or never existed: the tenant API asks on every request. */
export function sessionOfToken(token: string | undefined): SupportSession | null {
  if (!token) return null
  settle()
  const s = sessions.find((x) => x.id === TOKEN.exec(token)?.[1])
  return s && s.status === 'active' ? toDto(s) : null
}

/** The banner's End session button in the workspace: the same as the owner ending it from the console. */
export function endSessionOfToken(token: string | undefined): SupportSession | null {
  const open = sessionOfToken(token)
  if (!open) return null
  const s = sessions.find((x) => x.id === open.id)!
  close(s, 'ended', { id: s.staffId, name: s.staffName }, 'support.ended')
  return toDto(s)
}

// --- what a support token may do in the tenant API --------------------------------------------------------------------

export type SupportAction =
  | 'read'
  | 'write'
  | 'change-password'
  | 'change-mfa'
  | 'manage-users'
  | 'manage-roles'
  | 'export'
  | 'delete'
  | 'approve'
  | 'sign'
  | 'billing-settings'
  | 'integration-settings'
  | 'start-support-session'

const ALWAYS_REFUSED: SupportAction[] = [
  'change-password',
  'change-mfa',
  'manage-users',
  'manage-roles',
  'export',
  'delete',
  'approve',
  'sign',
  'billing-settings',
  'integration-settings',
  'start-support-session',
]

/** The rule the tenant API applies to a support token, written once so the contract and the tests can quote it. */
export function supportPolicy(mode: SupportMode, action: SupportAction): { allowed: true } | { allowed: false; problem: 'support/read-only' | 'support/restricted-action' } {
  if (action === 'read') return { allowed: true }
  if (ALWAYS_REFUSED.includes(action)) return { allowed: false, problem: 'support/restricted-action' }
  return mode === 'edit' ? { allowed: true } : { allowed: false, problem: 'support/read-only' }
}
