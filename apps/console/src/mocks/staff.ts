// Rules for the mocked Access control endpoints (docs/ARCHITECTURE.md, "Access control"):
// GET /staff, POST /staff, PATCH /staff/{id}, DELETE /staff/{id}, POST /staff/{id}/resend-invite,
// GET /roles and PUT /roles/{role}/permissions. Pure functions, like plans.ts; handlers.ts maps the
// results to HTTP, issues the invitation link and revokes sessions.
import {
  ACCESS_PROBLEM,
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  type RoleInfo,
  type RoleList,
  type StaffList,
  type StaffMember,
  type UpdateRoleInput,
  type UpdateStaffInput,
} from '@/features/access/api/types'
import type { Action, Area, PermissionKey, Role } from '@/features/auth/api/types'
import { hasPermission, ROLE_LABELS } from '@/features/auth/hooks/permissions'
import { permissions, seedPermissions, seedStaff, staff, type SeedStaff } from './db'

const ROLE_IDS: Role[] = ['admin', 'support', 'billing', 'auditor']
const AREAS: Area[] = ['tenants', 'plans', 'billing', 'transactions', 'sms', 'support', 'access']
const ACTIONS: Action[] = ['view', 'manage']
const ALL_KEYS = new Set<string>(AREAS.flatMap((a) => ACTIONS.map((x) => `${a}.${x}`)))
/** The Super admin role cannot be edited. */
const LOCKED_ROLE: Role = 'admin'
const MANAGE: PermissionKey = 'access.manage'
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface Failure {
  ok: false
  status: 400 | 404 | 409
  /** Problem `type` slug, appended to the errors base URL. */
  slug: string
  title: string
  detail?: string
  errors?: Record<string, string[]>
}
export type Outcome<T> = { ok: true; value: T; revokedUserIds: string[] } | Failure

const failure = (f: Omit<Failure, 'ok'>): Failure => ({ ok: false, ...f })
const success = <T,>(value: T, revokedUserIds: string[] = []): Outcome<T> => ({ ok: true, value, revokedUserIds })

const notFound = (what: string) => failure({ status: 404, slug: 'not-found', title: 'Not found', detail: `No such ${what}.` })
const invalid = (errors: Record<string, string[]>) =>
  failure({ status: 400, slug: 'validation', title: 'One or more validation errors occurred.', errors })
const stale = (what: string) =>
  failure({
    status: 409,
    slug: 'conflict',
    title: 'Conflict',
    detail: `This ${what} was changed by someone else.`,
    errors: { version: [`This ${what} was changed by someone else. Reload to see the latest.`] },
  })
const conflict = (detail: string) => failure({ status: 409, slug: 'conflict', title: 'Conflict', detail })

// --- state -------------------------------------------------------------------------------------

export interface AuditChange {
  field: string
  old: unknown
  new: unknown
}
/** One PlatformAuditLog entry: who, what, and the old and new values. The name is a copy, so it survives a soft delete. */
export interface AuditEntry {
  id: string
  occurredAt: string
  actorId: string
  actorName: string
  action: string
  entityType: 'StaffUser' | 'Role'
  entityId: string
  entityName: string
  changes: AuditChange[]
  isSecurity: true
}

const roleVersions = (): Record<Role, number> => ({ admin: 1, support: 1, billing: 1, auditor: 1 })
let versionOfRole = roleVersions()
let auditLog: AuditEntry[] = []
/** Soft-deleted people: gone from every list and from sign-in, kept for the audit trail. */
let removed: SeedStaff[] = []

/** Back to the demo's staff, role permissions and an empty audit log (tests). */
export function resetMockStaff() {
  staff.splice(0, staff.length, ...seedStaff())
  const seeded = seedPermissions()
  for (const role of ROLE_IDS) permissions[role] = seeded[role]
  versionOfRole = roleVersions()
  auditLog = []
  removed = []
}

export const platformAuditLog = (): readonly AuditEntry[] => auditLog
export const removedStaff = (): readonly SeedStaff[] => removed

function audit(actor: SeedStaff, action: string, entityType: AuditEntry['entityType'], entityId: string, entityName: string, changes: AuditChange[]) {
  auditLog.push({
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType,
    entityId,
    entityName,
    changes,
    isSecurity: true,
  })
}

// --- permission helpers ------------------------------------------------------------------------

const held = (role: Role, key: PermissionKey) => hasPermission(permissions, role, key)

/** Every key a list stands for, with `manage` expanded to also mean `view`. */
function effective(keys: PermissionKey[]): Set<PermissionKey> {
  const out = new Set<PermissionKey>(keys)
  for (const key of keys) if (key.endsWith('.manage')) out.add(`${key.slice(0, -'.manage'.length)}.view` as PermissionKey)
  return out
}

/** Highest key per area, in catalog order: what the server stores and returns. */
function canonical(keys: PermissionKey[]): PermissionKey[] {
  const all = effective(keys)
  const out: PermissionKey[] = []
  for (const area of AREAS) {
    if (all.has(`${area}.manage`)) out.push(`${area}.manage`)
    else if (all.has(`${area}.view`)) out.push(`${area}.view`)
  }
  return out
}

const sameKeys = (a: PermissionKey[], b: PermissionKey[]) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/** What `role` has that the actor does not: the keys an escalation would hand out. */
function missingFor(actor: SeedStaff, keys: PermissionKey[]): PermissionKey[] {
  return [...effective(keys)].filter((k) => !held(actor.role, k))
}

function escalation(missing: PermissionKey[]) {
  return failure({
    status: 409,
    slug: ACCESS_PROBLEM.escalation,
    title: 'Not allowed',
    detail: `You cannot grant what you do not hold yourself (${missing.join(', ')}).`,
  })
}

/** What the person being changed can do that the actor cannot: why the actor is outranked. */
function outranked(actor: SeedStaff, target: SeedStaff): Failure | null {
  const missing = missingFor(actor, permissions[target.role])
  if (missing.length === 0) return null
  return failure({
    status: 409,
    slug: ACCESS_PROBLEM.outranked,
    title: 'Not allowed',
    detail: `${target.name} can do things you cannot (${missing.join(', ')}). Only someone who holds all of them can change this person.`,
  })
}

/** The same rule for a role: one that holds a permission the actor lacks is out of reach, checked as it is before the edit. */
function roleOutranked(actor: SeedStaff, role: Role): Failure | null {
  const missing = missingFor(actor, permissions[role])
  if (missing.length === 0) return null
  return failure({
    status: 409,
    slug: ACCESS_PROBLEM.outranked,
    title: 'Not allowed',
    detail: `The ${ROLE_LABELS[role]} role can do things you cannot (${missing.join(', ')}). Only someone who holds all of them can change what it can do.`,
  })
}

const selfLockout = (detail: string) => failure({ status: 409, slug: ACCESS_PROBLEM.selfLockout, title: 'Not allowed', detail })

/** Active people who hold access.manage, given the roles' permissions as they would be. */
function activeManagers(permissionsOf: (role: Role) => PermissionKey[], people: SeedStaff[]) {
  return people.filter((u) => u.status === 'active' && effective(permissionsOf(u.role)).has(MANAGE))
}

const lastAdmin = (detail: string) => failure({ status: 409, slug: ACCESS_PROBLEM.lastAdmin, title: 'Not allowed', detail })

// --- reads -------------------------------------------------------------------------------------

const toMember = (u: SeedStaff): StaffMember => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  mfaEnrolled: u.mfaEnrolled,
  lastActiveAt: u.lastActiveAt,
  version: u.version,
})

export function listStaff(): StaffList {
  const items = [...staff].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map(toMember)
  return { items }
}

const toRole = (id: Role): RoleInfo => ({
  id,
  name: ROLE_LABELS[id],
  locked: id === LOCKED_ROLE,
  permissions: canonical(permissions[id]),
  staffCount: staff.filter((u) => u.role === id && u.status !== 'deactivated').length,
  version: versionOfRole[id],
})

export const listRoles = (): RoleList => ({ items: ROLE_IDS.map(toRole) })

// --- body helpers ------------------------------------------------------------------------------

function objectOf(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {}
}

function unknownFields(raw: Record<string, unknown>, allowed: string[], errors: Record<string, string[]>) {
  for (const key of Object.keys(raw)) if (!allowed.includes(key)) errors[key] = ['Unknown field.']
}

const isRole = (value: unknown): value is Role => typeof value === 'string' && (ROLE_IDS as string[]).includes(value)
const isVersion = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1

// --- invite ------------------------------------------------------------------------------------

/**
 * Creates an invited account. There is no password anywhere: the caller sends a set-password link.
 * Order: 400, then escalation, then duplicate email (both 409).
 */
export function inviteStaff(actor: SeedStaff, body: unknown): Outcome<StaffMember> {
  const raw = objectOf(body)
  const errors: Record<string, string[]> = {}
  unknownFields(raw, ['name', 'email', 'role'], errors)

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) errors.name = ['Enter their name.']
  else if (name.length > NAME_MAX_LENGTH) errors.name = [`Use ${NAME_MAX_LENGTH} characters or fewer.`]

  const email = typeof raw.email === 'string' ? raw.email.trim() : ''
  if (!EMAIL_PATTERN.test(email) || email.length > EMAIL_MAX_LENGTH) errors.email = ['Enter a valid email address.']

  if (!isRole(raw.role)) errors.role = ['Choose a role.']
  if (Object.keys(errors).length) return invalid(errors)

  const role = raw.role as Role
  const missing = missingFor(actor, permissions[role])
  if (missing.length) return escalation(missing)

  if (staff.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return failure({
      status: 409,
      slug: 'conflict',
      title: 'Conflict',
      detail: 'This person already has access.',
      errors: { email: ['This person already has access.'] },
    })
  }

  const person: SeedStaff = {
    id: crypto.randomUUID(),
    name,
    email,
    role,
    status: 'invited',
    mfaEnrolled: false,
    lastActiveAt: null,
    version: 1,
    securityStamp: 0,
  }
  staff.push(person)
  audit(actor, 'staff.invited', 'StaffUser', person.id, person.name, [
    { field: 'name', old: null, new: name },
    { field: 'email', old: null, new: email },
    { field: 'role', old: null, new: role },
    { field: 'status', old: null, new: 'invited' },
  ])
  return success(toMember(person))
}

export function resendInvite(actor: SeedStaff, id: string): Outcome<StaffMember> {
  const person = staff.find((u) => u.id === id)
  if (!person) return notFound('person')
  if (person.status !== 'invited') return conflict('Only a person who has not accepted yet can be sent the invitation again.')
  audit(actor, 'staff.invite-resent', 'StaffUser', person.id, person.name, [])
  return success(toMember(person))
}

/** An invited person set their password through the reset flow: the account becomes active. */
export function activateInvited(person: SeedStaff) {
  if (person.status !== 'invited') return
  person.status = 'active'
  person.version += 1
  audit(person, 'staff.activated', 'StaffUser', person.id, person.name, [{ field: 'status', old: 'invited', new: 'active' }])
}

// --- change a person ---------------------------------------------------------------------------

/**
 * PATCH /staff/{id}. Order: 404, 400, stale version (409), outranked, no change (200), then the safety rules:
 * self lockout, escalation, last admin. A role change or a disable ends that person's sessions.
 */
export function updateStaff(actor: SeedStaff, id: string, body: unknown): Outcome<StaffMember> {
  const person = staff.find((u) => u.id === id)
  if (!person) return notFound('person')

  const raw = objectOf(body)
  const errors: Record<string, string[]> = {}
  unknownFields(raw, ['role', 'status', 'version'], errors)
  if (raw.role !== undefined && !isRole(raw.role)) errors.role = ['Choose a role.']
  if (raw.status !== undefined && raw.status !== 'active' && raw.status !== 'deactivated') errors.status = ['Use active or deactivated.']
  if (raw.role === undefined && raw.status === undefined) errors.role = ['Send a role or a status to change.']
  if (!isVersion(raw.version)) errors.version = ['Send the version you loaded.']
  if (Object.keys(errors).length) return invalid(errors)
  if (raw.version !== person.version) return stale('person')
  const above = outranked(actor, person)
  if (above) return above

  const input = raw as unknown as UpdateStaffInput
  const newRole = input.role ?? person.role
  const roleChanges = newRole !== person.role
  if (input.status === 'deactivated' && person.status !== 'active') return conflict('Only an active account can be deactivated.')
  if (input.status === 'active' && person.status !== 'deactivated') return conflict('Only a deactivated account can be activated.')
  const statusChanges = input.status !== undefined
  if (!roleChanges && !statusChanges) return success(toMember(person))

  const self = person.id === actor.id
  const losesOwnAccess = input.status === 'deactivated' || (held(person.role, MANAGE) && !effective(permissions[newRole]).has(MANAGE))
  if (self && losesOwnAccess) {
    return selfLockout('You cannot remove your own access to Access control. Ask another Super admin to do it.')
  }

  if (roleChanges || input.status === 'active') {
    const missing = missingFor(actor, permissions[newRole])
    if (missing.length) return escalation(missing)
  }

  const afterStatus = input.status ?? person.status
  const after = staff.map((u) => (u.id === person.id ? { ...u, role: newRole, status: afterStatus } : u))
  if (held(person.role, MANAGE) && person.status === 'active' && activeManagers((r) => permissions[r], after).length === 0) {
    return lastAdmin('This is the last active person with access to Access control. Make someone else a Super admin first.')
  }

  const was = { role: person.role, status: person.status }
  person.role = newRole
  if (input.status) person.status = input.status
  person.version += 1
  // The token holds the role and the stamp, so a role change or a disable ends the session at once.
  const endsSessions = roleChanges || input.status === 'deactivated'
  if (endsSessions) person.securityStamp += 1

  if (roleChanges) audit(actor, 'staff.role-changed', 'StaffUser', person.id, person.name, [{ field: 'role', old: was.role, new: newRole }])
  if (statusChanges) {
    audit(actor, input.status === 'deactivated' ? 'staff.deactivated' : 'staff.reactivated', 'StaffUser', person.id, person.name, [
      { field: 'status', old: was.status, new: person.status },
    ])
  }
  return success(toMember(person), endsSessions ? [person.id] : [])
}

/** DELETE /staff/{id}?version=. A soft delete: the row stays for the audit trail. */
export function removeStaff(actor: SeedStaff, id: string, version: string | null): Outcome<null> {
  const person = staff.find((u) => u.id === id)
  if (!person) return notFound('person')
  const sent = version !== null && /^\d+$/.test(version) ? Number(version) : NaN
  if (!isVersion(sent)) return invalid({ version: ['Send the version you loaded.'] })
  if (sent !== person.version) return stale('person')
  const above = outranked(actor, person)
  if (above) return above

  if (person.id === actor.id) return selfLockout('You cannot remove your own access to Access control. Ask another Super admin to do it.')

  const after = staff.filter((u) => u.id !== person.id)
  if (held(person.role, MANAGE) && person.status === 'active' && activeManagers((r) => permissions[r], after).length === 0) {
    return lastAdmin('This is the last active person with access to Access control. Make someone else a Super admin first.')
  }

  staff.splice(staff.indexOf(person), 1)
  person.securityStamp += 1
  removed.push(person)
  audit(actor, 'staff.removed', 'StaffUser', person.id, person.name, [
    { field: 'status', old: person.status, new: 'removed' },
    { field: 'role', old: person.role, new: null },
  ])
  return success(null, [person.id])
}

// --- role permissions --------------------------------------------------------------------------

/**
 * PUT /roles/{role}/permissions. Order: 404, locked role (409), 400, stale version (409), outranked, self lockout,
 * escalation, last manager role, last admin. Permissions are not in the token, so nobody is signed out:
 * the cached map is evicted and the next request resolves the new keys.
 */
export function updateRole(actor: SeedStaff, id: string, body: unknown): Outcome<RoleInfo> {
  if (!isRole(id)) return notFound('role')
  if (id === LOCKED_ROLE) {
    return failure({ status: 409, slug: ACCESS_PROBLEM.roleLocked, title: 'Not allowed', detail: `The ${ROLE_LABELS[id]} role cannot be changed.` })
  }

  const raw = objectOf(body)
  const errors: Record<string, string[]> = {}
  unknownFields(raw, ['permissions', 'version'], errors)
  const sent = raw.permissions
  if (!Array.isArray(sent)) errors.permissions = ['Send a list of permission keys.']
  else {
    for (const key of sent) if (typeof key !== 'string' || !ALL_KEYS.has(key)) errors[`permissions.${String(key)}`] = ['Unknown permission.']
  }
  if (!isVersion(raw.version)) errors.version = ['Send the version you loaded.']
  if (Object.keys(errors).length) return invalid(errors)
  if (raw.version !== versionOfRole[id]) return stale('role')
  const above = roleOutranked(actor, id)
  if (above) return above

  const input = raw as unknown as UpdateRoleInput
  const next = canonical(input.permissions)
  const before = canonical(permissions[id])
  if (sameKeys(next, before)) return success(toRole(id))

  if (actor.role === id && effective(before).has(MANAGE) && !effective(next).has(MANAGE)) {
    return selfLockout('You cannot remove your own access to Access control. Ask another Super admin to do it.')
  }

  const granted = [...effective(next)].filter((k) => !effective(before).has(k))
  const missing = granted.filter((k) => !held(actor.role, k))
  if (missing.length) return escalation(missing)

  const permissionsAfter = (role: Role) => (role === id ? next : permissions[role])
  if (!ROLE_IDS.some((r) => effective(permissionsAfter(r)).has(MANAGE))) {
    return failure({
      status: 409,
      slug: ACCESS_PROBLEM.lastManagerRole,
      title: 'Not allowed',
      detail: 'This is the last role with access to Access control. Another role must keep it.',
    })
  }
  if (activeManagers(permissionsAfter, staff).length === 0) {
    return lastAdmin('No active person would be left with access to Access control.')
  }

  permissions[id] = next
  versionOfRole[id] += 1
  audit(actor, 'role.permissions-changed', 'Role', id, ROLE_LABELS[id], [{ field: 'permissions', old: before, new: next }])
  return success(toRole(id))
}
