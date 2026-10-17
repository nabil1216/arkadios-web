import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_DURATION } from '@/features/support/api/types'
import { permissions, staff } from './db'
import { platformAuditLog } from './audit'
import { resetMockStaff, removeStaff, updateRole, updateStaff } from './staff'
import {
  activeSessionOf,
  allTenantUsers,
  endSession,
  endSessionOfToken,
  exchangeHandoff,
  HANDOFF_SECONDS,
  listSessions,
  listSupportTenants,
  listSupportUsers,
  MAX_REISSUES,
  reissueHandoff,
  resetMockSupport,
  sessionOfToken,
  startSession,
  STARTS_PER_HOUR,
  supportPolicy,
  supportTokenClaims,
  type Failure,
  type Outcome,
} from './support'
import { resetMockTenants } from './tenantCreate'
import { tenantRecords } from './tenants'

const ORIGIN = 'http://localhost:5174'
const REASON = 'Checklist did not create tasks after a stage move'
const q = (s = '') => new URLSearchParams(s)

const dana = () => staff.find((u) => u.id === 'u1')!
const omar = () => staff.find((u) => u.id === 'u2')!
const priya = () => staff.find((u) => u.id === 'u3')!
const liam = () => staff.find((u) => u.id === 'u4')!

function failed<T>(result: Outcome<T>): Failure {
  if (result.ok) throw new Error('expected a failure')
  return result
}
function succeeded<T>(result: Outcome<T>): T {
  if (!result.ok) throw new Error(`expected success, got ${result.status} ${result.slug}: ${result.detail} ${JSON.stringify(result.errors)}`)
  return result.value
}

const tenant = (name: string) => tenantRecords.find((t) => t.name === name)!
function userId(tenantName: string, userName: string) {
  const list = succeeded(listSupportUsers(tenant(tenantName).id, q('pageSize=100')))
  return list.items.find((u) => u.name === userName)!.id
}
const NORTHWIND = 'Northwind Advisory Group'
const input = (over: Record<string, unknown> = {}) => ({
  tenantId: tenant(NORTHWIND).id,
  tenantUserId: 'tenantUserId' in over ? over.tenantUserId : userId(NORTHWIND, 'Elena Marsh'),
  reason: REASON,
  durationMinutes: 30,
  mode: 'read',
  ...over,
})
const start = (actor = omar(), over: Record<string, unknown> = {}) => startSession(actor, input(over), ORIGIN)

/** Starts a session and takes the code out of its handoff. */
function started(actor = omar(), over: Record<string, unknown> = {}) {
  const { session, handoff } = succeeded(start(actor, over))
  return { session, handoff }
}
const exchanged = (code: string) => {
  const result = exchangeHandoff(code)
  if (result.kind !== 'ok') throw new Error(`exchange: ${result.kind}`)
  return result.exchange
}

const NOW = Date.parse('2026-10-14T12:00:00.000Z')
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
})
afterEach(() => {
  vi.useRealTimers()
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
})
const advance = (ms: number) => vi.setSystemTime(Date.now() + ms)

describe('who and what can be targeted', () => {
  it('offers active and trial tenants only', () => {
    const list = succeeded(listSupportTenants(q()))
    expect(list.items.map((t) => [t.name, t.status])).toEqual([
      ['Arkadios Home Office', 'active'],
      ['Cobalt Ridge Wealth', 'active'],
      ['Marlow & Finch Partners', 'trial'],
      ['Northwind Advisory Group', 'active'],
      ['Quillon Trust Company', 'active'],
    ])
    expect(list.items.every((t) => t.domain.endsWith('.platform.example'))).toBe(true)
  })

  it('searches tenants and pages them', () => {
    expect(succeeded(listSupportTenants(q('q=north'))).items.map((t) => t.name)).toEqual([NORTHWIND])
    expect(succeeded(listSupportTenants(q('pageSize=2&page=2')))).toMatchObject({ total: 5, page: 2, pageSize: 2 })
    expect(failed(listSupportTenants(q('pageSize=500'))).errors).toHaveProperty('pageSize')
  })

  it('offers active tenant users only, never a disabled one and never a platform staff member', () => {
    const northwind = succeeded(listSupportUsers(tenant(NORTHWIND).id, q()))
    expect(northwind.items.map((u) => u.name)).toEqual(['Elena Marsh', 'Tom Hadley']) // Ruth Calder is disabled
    const arkadios = succeeded(listSupportUsers(tenant('Arkadios Home Office').id, q()))
    expect(arkadios.items.map((u) => u.name)).toEqual(['Alex Park', 'Mara Vance', 'Priya Okafor']) // Dana Whitfield is platform staff
    expect(Object.keys(northwind.items[0]).sort()).toEqual(['id', 'name', 'roleName'])
  })

  it('refuses the users of a suspended tenant, and 404s an unknown one', () => {
    expect(failed(listSupportUsers(tenant('Sterling Hollow Family Office').id, q()))).toMatchObject({ status: 409, slug: 'support/not-eligible' })
    expect(failed(listSupportUsers('nope', q())).status).toBe(404)
  })

  it('starts on an active tenant and on a trial tenant', () => {
    started(omar())
    advance(1)
    const trial = tenant('Marlow & Finch Partners')
    expect(succeeded(startSession(dana(), input({ tenantId: trial.id, tenantUserId: userId(trial.name, 'Helen Finch') }), ORIGIN)).session.tenantName).toBe(trial.name)
  })

  it('refuses a suspended tenant and an offboarding tenant (support/not-eligible)', () => {
    const suspended = tenant('Sterling Hollow Family Office')
    const result = failed(startSession(omar(), input({ tenantId: suspended.id, tenantUserId: 'x' }), ORIGIN))
    expect(result).toMatchObject({ status: 409, slug: 'support/not-eligible' })
    expect(result.detail).toContain('suspended')
    const northwind = tenant(NORTHWIND)
    const user = userId(NORTHWIND, 'Elena Marsh')
    northwind.status = 'offboarding'
    try {
      expect(failed(startSession(omar(), input({ tenantUserId: user }), ORIGIN))).toMatchObject({ status: 409, slug: 'support/not-eligible' })
      expect(failed(listSupportUsers(northwind.id, q())).detail).toContain('offboarding')
      expect(succeeded(listSupportTenants(q())).items.map((t) => t.name)).not.toContain(NORTHWIND)
    } finally {
      northwind.status = 'active'
    }
    expect(activeSessionOf('u2')).toBeNull()
  })

  it('refuses a disabled user and a platform staff member the same way, so neither is confirmed', () => {
    const northwind = allTenantUsers(tenant(NORTHWIND).id)
    const ruth = northwind.find((u) => u.name === 'Ruth Calder')!
    expect(ruth.status).toBe('disabled')
    const arkadios = tenant('Arkadios Home Office')
    const dana_ = allTenantUsers(arkadios.id).find((u) => u.name === 'Dana Whitfield')!
    const disabled = failed(start(omar(), { tenantUserId: ruth.id }))
    const staffLogin = failed(startSession(omar(), input({ tenantId: arkadios.id, tenantUserId: dana_.id }), ORIGIN))
    expect(disabled).toMatchObject({ status: 409, slug: 'support/not-eligible', detail: 'You cannot sign in as that user.' })
    expect({ ...staffLogin }).toEqual({ ...disabled })
    expect(activeSessionOf('u2')).toBeNull()
    expect(platformAuditLog()).toEqual([])
  })

  it('never targets another platform staff member, even a Super admin, even for a Super admin', () => {
    const arkadios = tenant('Arkadios Home Office')
    const staffLogin = allTenantUsers(arkadios.id).find((u) => u.name === 'Dana Whitfield')!
    expect(failed(startSession(dana(), input({ tenantId: arkadios.id, tenantUserId: staffLogin.id }), ORIGIN)).slug).toBe('support/not-eligible')
  })

  it('never lets a user from another tenant through', () => {
    const wrong = userId('Cobalt Ridge Wealth', 'Jonas Weir')
    expect(failed(start(omar(), { tenantUserId: wrong })).status).toBe(404)
  })
})

describe('starting a session', () => {
  it('creates an active session that ends after the chosen time, and audits it', () => {
    const { session, handoff } = started()
    expect(session).toMatchObject({
      status: 'active',
      staffId: 'u2',
      staffName: 'Omar Haddad',
      tenantName: NORTHWIND,
      tenantUserName: 'Elena Marsh',
      reason: REASON,
      mode: 'read',
      durationMinutes: 30,
      startedAt: '2026-10-14T12:00:00.000Z',
      expiresAt: '2026-10-14T12:30:00.000Z',
      endedAt: null,
      endedByName: null,
    })
    expect(session.reasonId).toMatch(/^[0-9a-f-]{36}$/)
    expect(handoff.expiresIn).toBe(HANDOFF_SECONDS)
    expect(platformAuditLog()).toEqual([
      expect.objectContaining({
        actorName: 'Omar Haddad',
        action: 'support.started',
        entityType: 'SupportSession',
        entityId: session.id,
        isSecurity: true,
        details: expect.objectContaining({ tenantName: NORTHWIND, tenantUserName: 'Elena Marsh', reason: REASON, mode: 'read', staffName: 'Omar Haddad' }),
      }),
    ])
  })

  it('takes 15, 30 or 60 minutes and nothing else', () => {
    expect(DEFAULT_DURATION).toBe(30)
    for (const minutes of [15, 30, 60]) {
      resetMockSupport()
      expect(started(omar(), { durationMinutes: minutes }).session.durationMinutes).toBe(minutes)
    }
    for (const bad of [0, 10, 45, 90, 120, '30', null, 30.5]) {
      resetMockSupport()
      expect(failed(start(omar(), { durationMinutes: bad })).errors).toEqual({ durationMinutes: ['Choose 15, 30 or 60 minutes.'] })
    }
  })

  it('has no custom time: an extra field is refused', () => {
    const result = failed(startSession(omar(), { ...input(), minutes: 45, expiresAt: '2030-01-01T00:00:00Z' }, ORIGIN))
    expect(result.errors).toEqual({ minutes: ['Unknown field.'], expiresAt: ['Unknown field.'] })
  })

  it('needs a reason of 20 to 500 characters, trimmed, as plain text', () => {
    expect(failed(start(omar(), { reason: 'x'.repeat(19) })).errors).toEqual({ reason: ['Describe why you need access, in at least 20 characters.'] })
    expect(failed(start(omar(), { reason: '   ' + 'x'.repeat(19) + '   ' })).errors).toHaveProperty('reason') // spaces do not count
    expect(failed(start(omar(), { reason: 'x'.repeat(501) })).errors).toEqual({ reason: ['Use 500 characters or fewer.'] })
    expect(failed(start(omar(), { reason: `${REASON}\u0000` })).errors).toEqual({ reason: ['Use plain text only.'] })
    expect(failed(start(omar(), { reason: undefined })).errors).toHaveProperty('reason')
    resetMockSupport()
    expect(started(omar(), { reason: 'x'.repeat(20) }).session.reason).toHaveLength(20)
    resetMockSupport()
    expect(started(omar(), { reason: 'x'.repeat(500) }).session.reason).toHaveLength(500)
    resetMockSupport()
    expect(started(omar(), { reason: `  ${REASON}  ` }).session.reason).toBe(REASON)
  })

  it('stores the reason as text: markup is kept as typed, never interpreted', () => {
    const reason = 'The <b>report</b> page shows <script>alert(1)</script> for one user'
    expect(started(omar(), { reason }).session.reason).toBe(reason)
  })

  it('reports every bad field at once, and refuses a mode other than read or edit', () => {
    const result = failed(startSession(omar(), { tenantId: '', tenantUserId: '', reason: 'short', durationMinutes: 45, mode: 'admin' }, ORIGIN))
    expect(Object.keys(result.errors!).sort()).toEqual(['durationMinutes', 'mode', 'reason', 'tenantId', 'tenantUserId'])
    expect(result.status).toBe(400)
  })

  it('starts in read mode or edit mode, as asked', () => {
    expect(started(omar(), { mode: 'edit' }).session.mode).toBe('edit')
    resetMockSupport()
    expect(started(omar(), { mode: 'read' }).session.mode).toBe('read')
  })

  it('hands out a code in the fragment of the workspace address, never in a path or query string', () => {
    const { handoff } = started()
    const url = new URL(handoff.url)
    expect(url.hash).toBe(`#code=${handoff.code}`)
    expect(url.search).toBe('')
    expect(url.pathname).not.toContain(handoff.code)
    expect(url.pathname).toBe('/mock-workspace/support-handoff')
  })

  it('does not put a tenant token anywhere in the start response', () => {
    const result = started()
    expect(JSON.stringify(result)).not.toContain('mock-support.')
  })
})

describe('one session at a time', () => {
  it('refuses a second one while the first is open, naming the tenant', () => {
    started()
    const result = failed(start(omar()))
    expect(result).toMatchObject({ status: 409, slug: 'support/session-active' })
    expect(result.detail).toContain(NORTHWIND)
  })

  it('lets someone else start their own', () => {
    started(omar())
    expect(succeeded(startSession(dana(), input(), ORIGIN)).session.staffName).toBe('Dana Whitfield')
  })

  it('lets the same person start again once the first has ended or expired', () => {
    const first = started().session
    succeeded(endSession(omar(), first.id))
    expect(started().session.id).not.toBe(first.id)
    advance(31 * 60_000) // the second one runs out
    expect(started().session.status).toBe('active')
  })

  it('finds the caller\'s own open session', () => {
    expect(activeSessionOf('u2')).toBeNull()
    const { session } = started()
    expect(activeSessionOf('u2')?.id).toBe(session.id)
    expect(activeSessionOf('u1')).toBeNull()
  })
})

describe('rate limit on starts', () => {
  it('allows 10 an hour and refuses the 11th with when to try again', () => {
    expect(STARTS_PER_HOUR).toBe(10)
    for (let i = 0; i < 10; i += 1) failed(start(omar(), { reason: 'short' })) // failed attempts count too
    const result = failed(start(omar()))
    expect(result).toMatchObject({ status: 429, slug: 'rate-limited', retryAfter: 3600 })
  })

  it('counts each person on their own', () => {
    for (let i = 0; i < 10; i += 1) failed(start(omar(), { reason: 'short' }))
    expect(failed(start(omar())).status).toBe(429)
    expect(succeeded(startSession(dana(), input(), ORIGIN)).session.staffName).toBe('Dana Whitfield')
  })

  it('slides: after an hour the oldest attempt no longer counts', () => {
    for (let i = 0; i < 10; i += 1) {
      failed(start(omar(), { reason: 'short' }))
      advance(60_000)
    }
    const wait = failed(start(omar())).retryAfter!
    expect(wait).toBeGreaterThan(0)
    expect(wait).toBeLessThanOrEqual(3600)
    advance(wait * 1000)
    expect(started().session.status).toBe('active')
  })
})

describe('ending a session', () => {
  it('lets the owner end their own, and audits it', () => {
    const { session } = started()
    advance(5 * 60_000)
    const ended = succeeded(endSession(omar(), session.id))
    expect(ended).toMatchObject({ status: 'ended', endedById: 'u2', endedByName: 'Omar Haddad', endedAt: '2026-10-14T12:05:00.000Z' })
    expect(platformAuditLog().map((e) => e.action)).toEqual(['support.started', 'support.ended'])
    expect(platformAuditLog()[1]).toMatchObject({ actorName: 'Omar Haddad', changes: [{ field: 'status', old: 'active', new: 'ended' }], details: expect.objectContaining({ tenantName: NORTHWIND, tenantUserName: 'Elena Marsh', reason: REASON }) })
  })

  it('lets someone with support.manage end another person\'s (a revoke), and says who did', () => {
    const { session } = started(omar())
    const revoked = succeeded(endSession(dana(), session.id))
    expect(revoked).toMatchObject({ status: 'revoked', endedById: 'u1', endedByName: 'Dana Whitfield' })
    expect(platformAuditLog().map((e) => e.action)).toEqual(['support.started', 'support.revoked'])
    expect(platformAuditLog()[1].actorName).toBe('Dana Whitfield')
  })

  it('does not let someone without support.manage end another person\'s', () => {
    const { session } = started(omar())
    expect(failed(endSession(priya(), session.id)).status).toBe(403)
    expect(failed(endSession(liam(), session.id)).status).toBe(403) // read only
    expect(activeSessionOf('u2')?.id).toBe(session.id)
  })

  it('lets an owner end their own even if they lost support.manage meanwhile', () => {
    const { session } = started(omar())
    permissions.support = permissions.support.filter((k) => k !== 'support.manage')
    expect(succeeded(endSession(omar(), session.id)).status).toBe('ended')
  })

  it('answers 409 for a session that is already over, 404 for an unknown one', () => {
    const { session } = started()
    succeeded(endSession(omar(), session.id))
    expect(failed(endSession(omar(), session.id))).toMatchObject({ status: 409, slug: 'support/not-active' })
    expect(failed(endSession(omar(), 'nope')).status).toBe(404)
  })

  it('cannot be extended: there is no way to add time, a new session needs a new reason', () => {
    const { session } = started()
    expect(session.expiresAt).toBe('2026-10-14T12:30:00.000Z')
    advance(10 * 60_000)
    expect(activeSessionOf('u2')?.expiresAt).toBe('2026-10-14T12:30:00.000Z') // nothing moves it
    expect(failed(startSession(omar(), input(), ORIGIN)).slug).toBe('support/session-active')
  })
})

describe('running out', () => {
  it('expires at the end of the chosen time, with no one to have ended it, and audits it once', () => {
    const { session } = started(omar(), { durationMinutes: 15 })
    advance(14 * 60_000)
    expect(activeSessionOf('u2')?.status).toBe('active')
    advance(2 * 60_000)
    expect(activeSessionOf('u2')).toBeNull()
    const listed = succeeded(listSessions(q())).items.find((s) => s.id === session.id)!
    expect(listed).toMatchObject({ status: 'expired', endedAt: '2026-10-14T12:15:00.000Z', endedById: null, endedByName: null })
    succeeded(listSessions(q())) // seen again: not audited again
    expect(platformAuditLog().map((e) => e.action)).toEqual(['support.started', 'support.expired'])
    expect(platformAuditLog()[1]).toMatchObject({ actorName: 'System', details: expect.objectContaining({ tenantName: NORTHWIND, reason: REASON }) })
  })

  it('cannot be ended once it has expired', () => {
    const { session } = started()
    advance(31 * 60_000)
    expect(failed(endSession(omar(), session.id)).slug).toBe('support/not-active')
  })
})

describe('the list', () => {
  it('shows the demo\'s two past sessions, newest first, with who, tenant, user, reason and how they ended', () => {
    const list = succeeded(listSessions(q()))
    expect(list).toMatchObject({ total: 2, page: 1, pageSize: 25 })
    expect(list.items.map((s) => [s.staffName, s.tenantName, s.tenantUserName, s.status])).toEqual([
      ['Omar Haddad', 'Arkadios Home Office', 'Priya Okafor', 'ended'],
      ['Omar Haddad', NORTHWIND, 'Elena Marsh', 'ended'],
    ])
    expect(list.items[0].reason).toBe('Checklist not creating tasks after a stage move')
  })

  it('filters by status, pages, and refuses bad parameters', () => {
    started()
    expect(succeeded(listSessions(q('status=active'))).items).toHaveLength(1)
    expect(succeeded(listSessions(q('status=ended'))).total).toBe(2)
    expect(succeeded(listSessions(q('status=revoked'))).total).toBe(0)
    expect(succeeded(listSessions(q('pageSize=1&page=3')))).toMatchObject({ total: 3, items: [expect.objectContaining({ status: 'ended' })] })
    expect(failed(listSessions(q('status=live&page=0'))).errors).toEqual({ status: expect.any(Array), page: expect.any(Array) })
  })
})

describe('the handoff', () => {
  it('turns a code into a short token that carries act_as, the session, the reason and the expiry', () => {
    const { session, handoff } = started(omar(), { durationMinutes: 15 })
    advance(30_000)
    const out = exchanged(handoff.code)
    expect(out.expiresIn).toBe(15 * 60 - 30) // what is left, never more
    expect(Object.keys(out).sort()).toEqual(['accessToken', 'expiresIn', 'session']) // no refresh token
    expect(out.session).toMatchObject({
      id: session.id,
      actAs: { id: 'u2', name: 'Omar Haddad' },
      tenantUser: { name: 'Elena Marsh' },
      reason: REASON,
      mode: 'read',
      expiresAt: '2026-10-14T12:15:00.000Z',
    })
    expect(supportTokenClaims(out.accessToken)).toEqual({
      sub: session.tenantUserId,
      act_as: 'u2',
      sid: session.id,
      rid: session.reasonId,
      mode: 'read',
      exp: Date.parse('2026-10-14T12:15:00.000Z') / 1000,
    })
  })

  it('is single use: the second try is refused, and it also ends the session', () => {
    const { session, handoff } = started()
    const out = exchanged(handoff.code)
    expect(sessionOfToken(out.accessToken)?.id).toBe(session.id)
    expect(exchangeHandoff(handoff.code)).toEqual({ kind: 'invalid' })
    expect(sessionOfToken(out.accessToken)).toBeNull()
    expect(succeeded(listSessions(q('status=revoked'))).items[0]).toMatchObject({ id: session.id, status: 'revoked', endedByName: 'Handoff code reused' })
    const actions = platformAuditLog().map((e) => e.action)
    expect(actions).toEqual(['support.started', 'support.handoff-replayed', 'support.revoked'])
    expect(platformAuditLog().every((e) => e.isSecurity)).toBe(true)
  })

  it('is valid for 60 seconds', () => {
    const { handoff } = started()
    advance(59_000)
    expect(exchangeHandoff(handoff.code).kind).toBe('ok')
    resetMockSupport()
    const second = started().handoff
    advance(61_000)
    expect(exchangeHandoff(second.code)).toEqual({ kind: 'invalid' })
    expect(activeSessionOf('u2')?.status).toBe('active') // an unused expired code does not touch the session
  })

  it('gives the same answer for a wrong code, a missing one and one that is not text', () => {
    started()
    for (const bad of ['nope', '', undefined, null, 42, {}]) expect(exchangeHandoff(bad)).toEqual({ kind: 'invalid' })
    expect(activeSessionOf('u2')?.status).toBe('active')
  })

  it('does not exchange for a session that was ended or has run out', () => {
    const a = started()
    succeeded(endSession(omar(), a.session.id))
    expect(exchangeHandoff(a.handoff.code)).toEqual({ kind: 'invalid' })
    resetMockSupport()
    const b = started()
    advance(31 * 60_000)
    expect(exchangeHandoff(b.handoff.code)).toEqual({ kind: 'invalid' })
  })

  it('rate limits exchanges: 10 a minute, then when to try again', () => {
    started()
    for (let i = 0; i < 10; i += 1) expect(exchangeHandoff(`wrong-${i}`)).toEqual({ kind: 'invalid' })
    expect(exchangeHandoff('wrong-11')).toMatchObject({ kind: 'limited', retryAfter: 60 })
    advance(61_000)
    expect(exchangeHandoff('wrong-12')).toEqual({ kind: 'invalid' })
  })

  it('writes no audit entry for a wrong code (nothing to attribute it to)', () => {
    started()
    exchangeHandoff('nope')
    expect(platformAuditLog().map((e) => e.action)).toEqual(['support.started'])
  })
})

describe('the token', () => {
  it('stops working the moment the session ends', () => {
    const { session, handoff } = started()
    const { accessToken } = exchanged(handoff.code)
    expect(sessionOfToken(accessToken)?.id).toBe(session.id)
    succeeded(endSession(omar(), session.id))
    expect(sessionOfToken(accessToken)).toBeNull()
  })

  it('stops working the moment someone revokes the session', () => {
    const { session, handoff } = started()
    const { accessToken } = exchanged(handoff.code)
    succeeded(endSession(dana(), session.id))
    expect(sessionOfToken(accessToken)).toBeNull()
  })

  it('stops working when the time is up, and cannot be renewed', () => {
    const { handoff } = started(omar(), { durationMinutes: 15 })
    const { accessToken } = exchanged(handoff.code)
    advance(14 * 60_000 + 59_000)
    expect(sessionOfToken(accessToken)).not.toBeNull()
    advance(2_000)
    expect(sessionOfToken(accessToken)).toBeNull()
    expect(exchangeHandoff(handoff.code)).toEqual({ kind: 'invalid' })
  })

  it('can be ended from the workspace banner, which is the owner ending it', () => {
    const { session, handoff } = started()
    const { accessToken } = exchanged(handoff.code)
    expect(endSessionOfToken(accessToken)).toMatchObject({ id: session.id, status: 'ended', endedByName: 'Omar Haddad' })
    expect(endSessionOfToken(accessToken)).toBeNull()
  })

  it('belongs to no one once the session is unknown', () => {
    expect(sessionOfToken('mock-support.nope')).toBeNull()
    expect(sessionOfToken(undefined)).toBeNull()
    expect(sessionOfToken('mock-access.u1')).toBeNull()
  })
})

describe('a new link for the same session', () => {
  it('is for the owner only', () => {
    const { session } = started(omar())
    expect(failed(reissueHandoff(dana(), session.id, ORIGIN)).status).toBe(403) // even a Super admin
    expect(reissueHandoff(omar(), session.id, ORIGIN).ok).toBe(true)
  })

  it('works until the first exchange and not after', () => {
    const { session, handoff } = started()
    const again = succeeded(reissueHandoff(omar(), session.id, ORIGIN)).handoff
    exchanged(again.code)
    expect(failed(reissueHandoff(omar(), session.id, ORIGIN))).toMatchObject({ status: 409, slug: 'support/already-opened' })
    expect(handoff.code).not.toBe(again.code)
  })

  it('makes the old code useless without ending the session', () => {
    const { session, handoff } = started()
    const again = succeeded(reissueHandoff(omar(), session.id, ORIGIN)).handoff
    expect(exchangeHandoff(handoff.code)).toEqual({ kind: 'invalid' })
    expect(activeSessionOf('u2')?.status).toBe('active') // an old code is not a reuse
    expect(exchangeHandoff(again.code).kind).toBe('ok')
    expect(session.id).toBe(activeSessionOf('u2')?.id)
  })

  it('can be asked for 3 times, and then the session has to be started again', () => {
    expect(MAX_REISSUES).toBe(3)
    const { session } = started()
    for (let i = 0; i < 3; i += 1) succeeded(reissueHandoff(omar(), session.id, ORIGIN))
    expect(failed(reissueHandoff(omar(), session.id, ORIGIN))).toMatchObject({ status: 409, slug: 'support/reissue-limit' })
  })

  it('writes an audit entry each time', () => {
    const { session } = started()
    succeeded(reissueHandoff(omar(), session.id, ORIGIN))
    succeeded(reissueHandoff(omar(), session.id, ORIGIN))
    const entries = platformAuditLog().filter((e) => e.action === 'support.handoff-reissued')
    expect(entries.map((e) => e.changes[0])).toEqual([{ field: 'reissues', old: 0, new: 1 }, { field: 'reissues', old: 1, new: 2 }])
    expect(entries[0]).toMatchObject({ actorName: 'Omar Haddad', details: expect.objectContaining({ tenantName: NORTHWIND, reason: REASON }) })
  })

  it('is refused for a session that is over', () => {
    const { session } = started()
    succeeded(endSession(omar(), session.id))
    expect(failed(reissueHandoff(omar(), session.id, ORIGIN)).slug).toBe('support/not-active')
    expect(failed(reissueHandoff(omar(), 'nope', ORIGIN)).status).toBe(404)
  })
})

describe('losing the right to run sessions ends them as revoked', () => {
  const reason = (action: string) => platformAuditLog().find((e) => e.action === 'support.revoked' && e.details?.why === action)

  it('disabling the staff member', () => {
    const { session } = started(omar())
    succeeded(updateStaff(dana(), 'u2', { status: 'deactivated', version: 1 }))
    expect(succeeded(listSessions(q('status=revoked'))).items[0]).toMatchObject({ id: session.id, endedByName: 'Dana Whitfield' })
    expect(activeSessionOf('u2')).toBeNull()
    expect(reason('account deactivated')?.actorName).toBe('Dana Whitfield')
  })

  it('removing the staff member', () => {
    const { handoff } = started(omar())
    const { accessToken } = exchanged(handoff.code)
    succeeded(removeStaff(dana(), 'u2', '1'))
    expect(activeSessionOf('u2')).toBeNull()
    expect(sessionOfToken(accessToken)).toBeNull()
    expect(reason('account removed')).toBeDefined()
  })

  it('a role change that removes support.manage', () => {
    started(omar())
    succeeded(updateStaff(dana(), 'u2', { role: 'billing', version: 1 }))
    expect(activeSessionOf('u2')).toBeNull()
    expect(reason('role no longer has support.manage')).toBeDefined()
  })

  it('a role change to a read-only role as well', () => {
    started(omar())
    succeeded(updateStaff(dana(), 'u2', { role: 'auditor', version: 1 }))
    expect(activeSessionOf('u2')).toBeNull()
  })

  it('a role change that keeps support.manage leaves the session alone', () => {
    started(omar())
    succeeded(updateStaff(dana(), 'u2', { role: 'admin', version: 1 }))
    expect(activeSessionOf('u2')?.status).toBe('active')
  })

  it('taking support.manage away from a role ends the sessions of everyone in it, and no one else\'s', () => {
    started(omar())
    advance(1)
    started(dana())
    succeeded(updateRole(dana(), 'support', { permissions: permissions.support.filter((k) => k !== 'support.manage'), version: 1 }))
    expect(activeSessionOf('u2')).toBeNull()
    expect(activeSessionOf('u1')?.status).toBe('active')
    expect(reason('role no longer has support.manage')).toBeDefined()
  })

  it('a change that does not touch support.manage leaves it alone', () => {
    started(omar())
    succeeded(updateRole(dana(), 'support', { permissions: permissions.support.filter((k) => k !== 'billing.view'), version: 1 }))
    expect(activeSessionOf('u2')?.status).toBe('active')
  })

  it('ends only that person\'s sessions', () => {
    started(omar())
    advance(1)
    started(dana())
    succeeded(updateStaff(dana(), 'u2', { status: 'deactivated', version: 1 }))
    expect(activeSessionOf('u1')?.status).toBe('active')
  })
})

describe('what a support token may do in the tenant API', () => {
  it('reads in both modes', () => {
    expect(supportPolicy('read', 'read')).toEqual({ allowed: true })
    expect(supportPolicy('edit', 'read')).toEqual({ allowed: true })
  })

  it('is refused changes in read mode and allowed ordinary ones in edit mode', () => {
    expect(supportPolicy('read', 'write')).toEqual({ allowed: false, problem: 'support/read-only' })
    expect(supportPolicy('edit', 'write')).toEqual({ allowed: true })
  })

  it.each([
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
  ] as const)('refuses %s in both modes', (action) => {
    expect(supportPolicy('read', action)).toEqual({ allowed: false, problem: 'support/restricted-action' })
    expect(supportPolicy('edit', action)).toEqual({ allowed: false, problem: 'support/restricted-action' })
  })
})
