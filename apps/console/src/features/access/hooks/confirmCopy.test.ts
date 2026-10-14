import { describe, expect, it } from 'vitest'
import type { RoleInfo, StaffMember } from '../api/types'
import { confirmCopy, inviteConfirmCopy, roleChangeNeedsConfirm } from './confirmCopy'

const role = (id: RoleInfo['id'], name: string, permissions: RoleInfo['permissions']): RoleInfo => ({ id, name, locked: false, permissions, staffCount: 1, version: 1 })
const roles = [
  role('admin', 'Super admin', ['tenants.manage', 'billing.manage', 'access.manage']),
  role('billing', 'Billing manager', ['tenants.view', 'billing.manage']),
  role('auditor', 'Auditor', ['tenants.view', 'billing.view']),
  role('support', 'Support lead', ['tenants.view', 'billing.manage', 'sms.manage']),
]
const priya: StaffMember = { id: 'u3', name: 'Priya Nair', email: 'p@x.example', role: 'billing', status: 'active', mfaEnrolled: true, lastActiveAt: null, version: 1 }

describe('roleChangeNeedsConfirm', () => {
  it('asks when something is lost', () => {
    expect(roleChangeNeedsConfirm(roles, priya, 'auditor')).toBe(true)
  })
  it('asks when access.manage is handed out, even if nothing is lost', () => {
    expect(roleChangeNeedsConfirm(roles, priya, 'admin')).toBe(true)
  })
  it('does not ask for a change that only adds', () => {
    expect(roleChangeNeedsConfirm(roles, priya, 'support')).toBe(false)
  })
  it('asks when it cannot tell what changes', () => {
    expect(roleChangeNeedsConfirm([], priya, 'auditor')).toBe(true)
  })
})

describe('confirmCopy', () => {
  it('names the person and what they lose on a demotion', () => {
    const copy = confirmCopy({ kind: 'role', member: priya, to: 'auditor' }, roles)
    expect(copy.title).toBe('Change Priya Nair to Auditor?')
    expect(copy.lists).toEqual([{ title: 'Priya Nair will lose:', items: ['Change billing'] }])
    expect(copy.destructive).toBe(true)
  })

  it('says the person will be able to change who has access when the new role holds access.manage', () => {
    const copy = confirmCopy({ kind: 'role', member: priya, to: 'admin' }, roles)
    expect(copy.intro[0]).toContain('Priya Nair will be able to do that too')
    expect(copy.lists).toEqual([])
    expect(copy.destructive).toBe(false)
  })

  it('lists everything the role allows when deactivating, and says they can come back', () => {
    const copy = confirmCopy({ kind: 'deactivate', member: priya }, roles)
    expect(copy.lists[0].title).toBe('Priya Nair will lose, as Billing manager:')
    expect(copy.lists[0].items).toEqual(['View tenants', 'Change billing'])
    expect(copy.outro).toEqual(['You can reactivate them later.'])
  })

  it('says removing is for good, and what is kept', () => {
    const copy = confirmCopy({ kind: 'remove', member: priya }, roles)
    expect(copy.intro[0]).toContain('for good')
    expect(copy.intro[0]).toContain('audit log')
    expect(copy.confirmLabel).toBe('Remove')
  })

  it('has nothing to list for an invited person', () => {
    const copy = confirmCopy({ kind: 'remove', member: { ...priya, status: 'invited' } }, roles)
    expect(copy.lists).toEqual([])
    expect(copy.intro[0]).toContain('has not signed in yet')
  })
})

describe('inviteConfirmCopy', () => {
  it('names the person and the role, and says they set their own password', () => {
    const copy = inviteConfirmCopy('Test Person', roles[0])
    expect(copy.title).toBe('Invite Test Person as Super admin?')
    expect(copy.outro[0]).toContain('You never see or set it')
  })
})
