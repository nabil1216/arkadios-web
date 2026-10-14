import { describe, expect, it } from 'vitest'
import type { RoleInfo } from '../api/types'
import { draftKeys, isRoleChanged, roleChanges, rolesConfirmCopy, savedRoleDraft } from './roleDraft'

const role = (id: RoleInfo['id'], permissions: RoleInfo['permissions'], extra: Partial<RoleInfo> = {}): RoleInfo => ({
  id,
  name: id,
  locked: false,
  permissions,
  staffCount: 2,
  version: 1,
  ...extra,
})
const billing = role('billing', ['tenants.view', 'billing.manage', 'transactions.manage'], { name: 'Billing manager' })
const admin = role('admin', ['access.manage'], { locked: true, name: 'Super admin' })

describe('draftKeys', () => {
  it('turns a draft back into the highest key per area, in catalog order', () => {
    expect(draftKeys(savedRoleDraft(billing))).toEqual(['tenants.view', 'billing.manage', 'transactions.manage'])
    expect(draftKeys({ ...savedRoleDraft(billing), sms: 'view', tenants: 'none' })).toEqual(['billing.manage', 'transactions.manage', 'sms.view'])
  })
})

describe('isRoleChanged and roleChanges', () => {
  it('sees a change only when a level differs', () => {
    expect(isRoleChanged(billing, savedRoleDraft(billing))).toBe(false)
    expect(isRoleChanged(billing, { ...savedRoleDraft(billing), sms: 'view' })).toBe(true)
  })

  it('never lists a locked role, whatever its draft says', () => {
    const drafts = { billing: { ...savedRoleDraft(billing), sms: 'view' as const }, admin: { ...savedRoleDraft(admin), tenants: 'manage' as const } }
    expect(roleChanges([admin, billing], drafts).map((c) => c.role.id)).toEqual(['billing'])
  })
})

describe('rolesConfirmCopy', () => {
  const change = (r: RoleInfo, patch: Partial<ReturnType<typeof savedRoleDraft>>) => ({ role: r, next: draftKeys({ ...savedRoleDraft(r), ...patch }) })

  it('is null when the save only adds', () => {
    expect(rolesConfirmCopy([change(billing, { sms: 'view' })])).toBeNull()
  })

  it('names the role, its people and what they lose', () => {
    const copy = rolesConfirmCopy([change(billing, { transactions: 'none' })])!
    expect(copy.lists).toEqual([{ title: 'Billing manager (2 people) will lose:', items: ['Change transactions'] }])
    expect(copy.destructive).toBe(true)
  })

  it('uses "person" for one', () => {
    const copy = rolesConfirmCopy([change({ ...billing, staffCount: 1 }, { transactions: 'none' })])!
    expect(copy.lists[0].title).toBe('Billing manager (1 person) will lose:')
  })

  it('asks when a role is given access.manage, and says it is not a loss', () => {
    const copy = rolesConfirmCopy([change(billing, { access: 'manage' })])!
    expect(copy.title).toBe('Give these roles access to Access control?')
    expect(copy.intro[0]).toContain('Billing manager (2 people) will be able to change who has access')
    expect(copy.lists).toEqual([])
    expect(copy.destructive).toBe(false)
  })

  it('does not ask again for a role that already holds access.manage', () => {
    const manager = role('support', ['access.manage'])
    expect(rolesConfirmCopy([change(manager, { sms: 'view' })])).toBeNull()
  })
})
