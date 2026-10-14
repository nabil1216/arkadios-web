import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ACCESS_PROBLEM } from '@/features/access/api/types'
import { permissions, staff } from './db'
import {
  inviteStaff,
  listRoles,
  listStaff,
  platformAuditLog,
  removedStaff,
  removeStaff,
  resendInvite,
  resetMockStaff,
  updateRole,
  updateStaff,
  type Failure,
  type Outcome,
} from './staff'

beforeEach(resetMockStaff)
afterEach(resetMockStaff)

const person = (id: string) => staff.find((u) => u.id === id)!
const dana = () => person('u1') // Super admin
const omar = () => person('u2') // Support lead
const role = (id: string) => listRoles().items.find((r) => r.id === id)!

function failed<T>(result: Outcome<T>): Failure {
  if (result.ok) throw new Error('expected a failure')
  return result
}
const succeeded = <T,>(result: Outcome<T>) => {
  if (!result.ok) throw new Error(`expected success, got ${result.status} ${result.slug}: ${result.detail}`)
  return result
}

/** A second manager who is not a Super admin: the Support lead role gets access.manage. */
function supportCanManageAccess() {
  permissions.support = [...permissions.support, 'access.manage']
}

describe('seed', () => {
  it('lists the demo\'s five people by name, with a version and no secrets', () => {
    const { items } = listStaff()
    expect(items.map((m) => m.name)).toEqual(['Dana Whitfield', 'Liam Carter', 'Omar Haddad', 'Priya Nair', 'Sofia Reyes'])
    expect(Object.keys(items[0]).sort()).toEqual(['email', 'id', 'lastActiveAt', 'mfaEnrolled', 'name', 'role', 'status', 'version'])
    expect(items.find((m) => m.name === 'Sofia Reyes')).toMatchObject({ status: 'invited', mfaEnrolled: false, lastActiveAt: null })
  })

  it('lists the four roles with their keys, a locked Super admin, and who is in each', () => {
    const roles = listRoles().items
    expect(roles.map((r) => [r.id, r.name, r.locked, r.staffCount, r.version])).toEqual([
      ['admin', 'Super admin', true, 1, 1],
      ['support', 'Support lead', false, 2, 1], // Omar, and Sofia who is invited
      ['billing', 'Billing manager', false, 1, 1],
      ['auditor', 'Auditor', false, 1, 1],
    ])
    expect(role('auditor').permissions).toEqual(['tenants.view', 'plans.view', 'billing.view', 'transactions.view', 'support.view', 'access.view'])
  })
})

describe('invite', () => {
  it('adds an invited person with MFA not set up, and audits it', () => {
    const { value } = succeeded(inviteStaff(dana(), { name: ' Test Person ', email: ' test.person@platform.example ', role: 'support' }))
    expect(value).toMatchObject({ name: 'Test Person', email: 'test.person@platform.example', role: 'support', status: 'invited', mfaEnrolled: false, lastActiveAt: null, version: 1 })
    expect(value.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(listStaff().items).toHaveLength(6)
    expect(platformAuditLog()).toEqual([
      expect.objectContaining({
        actorId: 'u1',
        actorName: 'Dana Whitfield',
        action: 'staff.invited',
        entityType: 'StaffUser',
        entityId: value.id,
        entityName: 'Test Person',
        isSecurity: true,
        changes: [
          { field: 'name', old: null, new: 'Test Person' },
          { field: 'email', old: null, new: 'test.person@platform.example' },
          { field: 'role', old: null, new: 'support' },
          { field: 'status', old: null, new: 'invited' },
        ],
      }),
    ])
  })

  it('has no way to set a password or MFA: those fields are unknown', () => {
    const base = { name: 'Test Person', email: 'test.person@platform.example', role: 'support' }
    const result = failed(inviteStaff(dana(), { ...base, password: 'demo-1234', mfaEnrolled: false, mfaRequired: false }))
    expect(result.status).toBe(400)
    expect(result.errors).toEqual({ password: ['Unknown field.'], mfaEnrolled: ['Unknown field.'], mfaRequired: ['Unknown field.'] })
    expect(listStaff().items).toHaveLength(5)
  })

  it('reports every bad field at once', () => {
    const result = failed(inviteStaff(dana(), { name: '  ', email: 'nope', role: 'owner' }))
    expect(result.status).toBe(400)
    expect(Object.keys(result.errors!).sort()).toEqual(['email', 'name', 'role'])
    expect(failed(inviteStaff(dana(), { name: 'x'.repeat(101), email: 'a@b.co', role: 'support' })).errors).toEqual({ name: ['Use 100 characters or fewer.'] })
  })

  it('refuses an email that already has access, ignoring case', () => {
    const result = failed(inviteStaff(dana(), { name: 'Test Person', email: 'LIAM.CARTER@platform.example', role: 'support' }))
    expect(result).toMatchObject({ status: 409, errors: { email: ['This person already has access.'] } })
  })

  it('runs the 400 checks before the duplicate check', () => {
    expect(failed(inviteStaff(dana(), { name: '', email: 'liam.carter@platform.example', role: 'support' })).status).toBe(400)
  })

  it('refuses a role the inviter does not hold themselves (escalation), and invites nobody', () => {
    supportCanManageAccess()
    const result = failed(inviteStaff(omar(), { name: 'Test Person', email: 'test.person@platform.example', role: 'admin' }))
    expect(result).toMatchObject({ status: 409, slug: ACCESS_PROBLEM.escalation })
    expect(result.detail).toContain('tenants.manage')
    expect(listStaff().items).toHaveLength(5)
    expect(platformAuditLog()).toEqual([])
  })

  it('lets a manager invite into a role whose keys they all hold', () => {
    supportCanManageAccess()
    succeeded(inviteStaff(omar(), { name: 'Test Person', email: 'test.person@platform.example', role: 'support' }))
  })

  it('resends only to an invited person, and audits it', () => {
    succeeded(resendInvite(dana(), 'u5'))
    expect(platformAuditLog().map((e) => e.action)).toEqual(['staff.invite-resent'])
    expect(failed(resendInvite(dana(), 'u2')).status).toBe(409)
    expect(failed(resendInvite(dana(), 'nobody')).status).toBe(404)
  })
})

describe('change a role', () => {
  it('saves it, bumps the version, ends the person\'s sessions and audits old and new', () => {
    const result = succeeded(updateStaff(dana(), 'u2', { role: 'billing', version: 1 }))
    expect(result.value).toMatchObject({ id: 'u2', role: 'billing', version: 2 })
    expect(result.revokedUserIds).toEqual(['u2'])
    expect(omar().securityStamp).toBe(1)
    expect(platformAuditLog()).toEqual([
      expect.objectContaining({ actorName: 'Dana Whitfield', action: 'staff.role-changed', entityId: 'u2', entityName: 'Omar Haddad', changes: [{ field: 'role', old: 'support', new: 'billing' }] }),
    ])
  })

  it('does nothing and audits nothing when the role is the same', () => {
    const result = succeeded(updateStaff(dana(), 'u2', { role: 'support', version: 1 }))
    expect(result.value.version).toBe(1)
    expect(result.revokedUserIds).toEqual([])
    expect(platformAuditLog()).toEqual([])
  })

  it('validates the body: unknown fields, a bad role or status, nothing to change, no version', () => {
    expect(failed(updateStaff(dana(), 'u2', { role: 'owner', version: 1 })).errors).toEqual({ role: ['Choose a role.'] })
    expect(failed(updateStaff(dana(), 'u2', { status: 'invited', version: 1 })).errors).toEqual({ status: ['Use active or deactivated.'] })
    expect(failed(updateStaff(dana(), 'u2', { name: 'Omar', role: 'billing', version: 1 })).errors).toEqual({ name: ['Unknown field.'] })
    expect(failed(updateStaff(dana(), 'u2', { mfaEnrolled: false, role: 'billing', version: 1 })).errors).toEqual({ mfaEnrolled: ['Unknown field.'] })
    expect(failed(updateStaff(dana(), 'u2', { version: 1 })).status).toBe(400)
    expect(failed(updateStaff(dana(), 'u2', { role: 'billing' })).errors).toEqual({ version: ['Send the version you loaded.'] })
    expect(failed(updateStaff(dana(), 'nobody', { role: 'billing', version: 1 })).status).toBe(404)
  })

  it('returns 409 with errors.version for a stale version, applies nothing, and checks 400 first', () => {
    succeeded(updateStaff(dana(), 'u2', { role: 'billing', version: 1 }))
    const stale = failed(updateStaff(dana(), 'u2', { role: 'auditor', version: 1 }))
    expect(stale).toMatchObject({ status: 409, errors: { version: ['This person was changed by someone else. Reload to see the latest.'] } })
    expect(omar().role).toBe('billing')
    expect(failed(updateStaff(dana(), 'u2', { role: 'owner', version: 1 })).status).toBe(400)
  })

  it('refuses a role the actor does not hold themselves (escalation)', () => {
    supportCanManageAccess()
    for (const [id, target] of [['u3', 'admin'], ['u3', 'auditor'], ['u4', 'billing']] as const) {
      const result = failed(updateStaff(omar(), id, { role: target, version: 1 }))
      expect(result, target).toMatchObject({ status: 409, slug: ACCESS_PROBLEM.escalation })
    }
    expect(person('u3').role).toBe('billing')
    expect(person('u4').role).toBe('auditor')
    expect(platformAuditLog()).toEqual([])
    succeeded(updateStaff(omar(), 'u4', { role: 'support', version: 1 })) // a role they hold in full
  })
})

describe('safety: your own access, and the last admin', () => {
  const SELF = { status: 409, slug: ACCESS_PROBLEM.selfLockout }

  it('a person cannot take their own access.manage away by changing their role', () => {
    expect(failed(updateStaff(dana(), 'u1', { role: 'auditor', version: 1 }))).toMatchObject(SELF)
    expect(dana().role).toBe('admin')
  })

  it('may move to another role that keeps access.manage', () => {
    supportCanManageAccess()
    succeeded(updateStaff(dana(), 'u1', { role: 'support', version: 1 }))
  })

  it('a person cannot disable or remove themselves', () => {
    expect(failed(updateStaff(dana(), 'u1', { status: 'deactivated', version: 1 }))).toMatchObject(SELF)
    expect(failed(removeStaff(dana(), 'u1', '1'))).toMatchObject(SELF)
    expect(dana().status).toBe('active')
    expect(listStaff().items).toHaveLength(5)
  })

  it('a role edit cannot take away the editor\'s own access.manage', () => {
    supportCanManageAccess()
    const result = failed(updateRole(omar(), 'support', { permissions: ['tenants.view'], version: 1 }))
    expect(result).toMatchObject(SELF)
    expect(role('support').permissions).toContain('access.manage')
  })

  // The actor is always an active manager, so the last admin can only be someone else's target when the
  // request raced with a change that already took the actor's own access away. These tests recreate that:
  // Omar was a manager, and was disabled while his request to demote Dana was in flight.
  describe('the last admin (a request that raced with another change)', () => {
    const LAST = { status: 409, slug: ACCESS_PROBLEM.lastAdmin }
    beforeEach(() => {
      permissions.support = [...permissions.admin]
      omar().status = 'deactivated'
    })

    it('cannot be demoted', () => {
      expect(failed(updateStaff(omar(), 'u1', { role: 'auditor', version: 1 }))).toMatchObject(LAST)
      expect(dana().role).toBe('admin')
    })
    it('cannot be disabled', () => {
      expect(failed(updateStaff(omar(), 'u1', { status: 'deactivated', version: 1 }))).toMatchObject(LAST)
      expect(dana().status).toBe('active')
    })
    it('cannot be removed', () => {
      expect(failed(removeStaff(omar(), 'u1', '1'))).toMatchObject(LAST)
      expect(listStaff().items.some((m) => m.id === 'u1')).toBe(true)
      expect(removedStaff()).toEqual([])
    })
    it('says so in plain words', () => {
      expect(failed(updateStaff(omar(), 'u1', { role: 'auditor', version: 1 })).detail).toBe(
        'This is the last active person with access to Access control. Make someone else a Super admin first.',
      )
    })
    it('can be demoted once another active person holds access.manage', () => {
      omar().status = 'active'
      succeeded(updateStaff(omar(), 'u1', { role: 'support', version: 1 }))
    })
  })

  it('an invited or disabled admin does not count as an admin', () => {
    permissions.support = [...permissions.admin]
    omar().status = 'invited'
    expect(failed(updateStaff(omar(), 'u1', { role: 'auditor', version: 1 })).slug).toBe(ACCESS_PROBLEM.lastAdmin)
  })
})

describe('disable, reactivate and remove', () => {
  it('disabling ends the person\'s sessions and audits it', () => {
    const result = succeeded(updateStaff(dana(), 'u2', { status: 'deactivated', version: 1 }))
    expect(result.value).toMatchObject({ status: 'deactivated', version: 2 })
    expect(result.revokedUserIds).toEqual(['u2'])
    expect(omar().securityStamp).toBe(1)
    expect(platformAuditLog()[0]).toMatchObject({ action: 'staff.deactivated', changes: [{ field: 'status', old: 'active', new: 'deactivated' }] })
  })

  it('reactivating brings them back and ends nothing', () => {
    succeeded(updateStaff(dana(), 'u2', { status: 'deactivated', version: 1 }))
    const result = succeeded(updateStaff(dana(), 'u2', { status: 'active', version: 2 }))
    expect(result.value).toMatchObject({ status: 'active', version: 3 })
    expect(result.revokedUserIds).toEqual([])
    expect(platformAuditLog()[1]).toMatchObject({ action: 'staff.reactivated', changes: [{ field: 'status', old: 'deactivated', new: 'active' }] })
  })

  it('only an active account can be disabled, and only a disabled one activated', () => {
    expect(failed(updateStaff(dana(), 'u5', { status: 'deactivated', version: 1 })).status).toBe(409)
    expect(failed(updateStaff(dana(), 'u2', { status: 'active', version: 1 })).status).toBe(409)
  })

  it('does not reactivate into a role the actor does not hold (escalation)', () => {
    permissions.support = [...permissions.support, 'access.manage']
    succeeded(updateStaff(dana(), 'u3', { status: 'deactivated', version: 1 }))
    expect(failed(updateStaff(omar(), 'u3', { status: 'active', version: 2 })).slug).toBe(ACCESS_PROBLEM.escalation)
  })

  it('remove is a soft delete: gone from the list, kept aside, audited with a copy of the name', () => {
    const result = succeeded(removeStaff(dana(), 'u3', '1'))
    expect(result.revokedUserIds).toEqual(['u3'])
    expect(listStaff().items.map((m) => m.id)).not.toContain('u3')
    expect(removedStaff().map((u) => u.id)).toEqual(['u3'])
    expect(platformAuditLog()).toEqual([
      expect.objectContaining({
        action: 'staff.removed',
        entityId: 'u3',
        entityName: 'Priya Nair',
        changes: [
          { field: 'status', old: 'active', new: 'removed' },
          { field: 'role', old: 'billing', new: null },
        ],
      }),
    ])
  })

  it('needs the version: 400 without one, 409 when stale, 404 for an unknown id', () => {
    expect(failed(removeStaff(dana(), 'u3', null)).status).toBe(400)
    expect(failed(removeStaff(dana(), 'u3', 'abc')).status).toBe(400)
    expect(failed(removeStaff(dana(), 'u3', '7'))).toMatchObject({ status: 409, errors: { version: expect.any(Array) } })
    expect(failed(removeStaff(dana(), 'nobody', '1')).status).toBe(404)
    expect(listStaff().items).toHaveLength(5)
  })

  it('lets the same email be invited again after a removal', () => {
    succeeded(removeStaff(dana(), 'u3', '1'))
    succeeded(inviteStaff(dana(), { name: 'Priya Nair', email: 'priya.nair@platform.example', role: 'billing' }))
  })
})

describe('what each role can do', () => {
  it('saves a role, keeps the highest key per area, bumps the version and audits old and new', () => {
    const result = succeeded(updateRole(dana(), 'billing', { permissions: ['billing.view', 'billing.manage', 'sms.view', 'sms.view'], version: 1 }))
    expect(result.value).toMatchObject({ id: 'billing', permissions: ['billing.manage', 'sms.view'], version: 2, staffCount: 1 })
    expect(result.revokedUserIds).toEqual([]) // permissions are not in the token: nobody is signed out
    expect(platformAuditLog()).toEqual([
      expect.objectContaining({
        action: 'role.permissions-changed',
        entityType: 'Role',
        entityId: 'billing',
        entityName: 'Billing manager',
        changes: [{ field: 'permissions', old: ['tenants.view', 'plans.view', 'billing.manage', 'transactions.manage'], new: ['billing.manage', 'sms.view'] }],
      }),
    ])
  })

  it('takes effect for the next request: the live map changes', () => {
    succeeded(updateRole(dana(), 'auditor', { permissions: ['tenants.view'], version: 1 }))
    expect(permissions.auditor).toEqual(['tenants.view'])
  })

  it('leaves the Super admin role alone', () => {
    expect(failed(updateRole(dana(), 'admin', { permissions: [], version: 1 }))).toMatchObject({ status: 409, slug: ACCESS_PROBLEM.roleLocked })
    expect(role('admin').locked).toBe(true)
  })

  it('returns 409 with errors.version for a stale version and applies nothing', () => {
    succeeded(updateRole(dana(), 'auditor', { permissions: ['tenants.view'], version: 1 }))
    const stale = failed(updateRole(dana(), 'auditor', { permissions: ['plans.view'], version: 1 }))
    expect(stale).toMatchObject({ status: 409, errors: { version: ['This role was changed by someone else. Reload to see the latest.'] } })
    expect(permissions.auditor).toEqual(['tenants.view'])
  })

  it('validates: unknown keys and fields, not a list, no version, unknown role', () => {
    expect(failed(updateRole(dana(), 'billing', { permissions: ['tenants.root'], version: 1 })).errors).toEqual({ 'permissions.tenants.root': ['Unknown permission.'] })
    expect(failed(updateRole(dana(), 'billing', { permissions: 'x', version: 1 })).errors).toEqual({ permissions: ['Send a list of permission keys.'] })
    expect(failed(updateRole(dana(), 'billing', { permissions: [], version: 1, name: 'x' })).errors).toEqual({ name: ['Unknown field.'] })
    expect(failed(updateRole(dana(), 'billing', { permissions: [] })).errors).toEqual({ version: ['Send the version you loaded.'] })
    expect(failed(updateRole(dana(), 'owner', { permissions: [], version: 1 })).status).toBe(404)
  })

  it('refuses to grant a key the editor does not hold (escalation)', () => {
    supportCanManageAccess()
    const result = failed(updateRole(omar(), 'auditor', { permissions: [...permissions.auditor, 'tenants.manage'], version: 1 }))
    expect(result).toMatchObject({ status: 409, slug: ACCESS_PROBLEM.escalation })
    expect(permissions.auditor).not.toContain('tenants.manage')
    succeeded(updateRole(omar(), 'auditor', { permissions: [...permissions.auditor, 'sms.manage'], version: 1 })) // Omar holds sms.manage
  })

  it('may grant access.manage to a role only if the editor holds it', () => {
    succeeded(updateRole(dana(), 'billing', { permissions: [...permissions.billing, 'access.manage'], version: 1 }))
    expect(role('billing').permissions).toContain('access.manage')
  })

  describe('the last role that holds access.manage (forced: the locked Super admin role normally keeps it)', () => {
    it('cannot lose it', () => {
      permissions.admin = permissions.admin.filter((k) => k !== 'access.manage')
      permissions.support = [...permissions.support, 'access.manage']
      const result = failed(updateRole(dana(), 'support', { permissions: ['tenants.view'], version: 1 }))
      expect(result).toMatchObject({ status: 409, slug: ACCESS_PROBLEM.lastManagerRole })
      expect(role('support').permissions).toContain('access.manage')
    })

    it('cannot lose it when no active person would be left holding it', () => {
      // Dana (Super admin) was disabled while her request to edit the Support role was in flight.
      permissions.support = [...permissions.support, 'access.manage']
      dana().status = 'deactivated'
      const result = failed(updateRole(dana(), 'support', { permissions: ['tenants.view'], version: 1 }))
      expect(result).toMatchObject({ status: 409, slug: ACCESS_PROBLEM.lastAdmin })
      expect(role('support').permissions).toContain('access.manage')
    })
  })
})
