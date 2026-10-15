import { describe, expect, it } from 'vitest'
import type { RoleInfo } from '../api/types'
import { assignableRoles, canChangeRole } from './outranks'

const role = (id: RoleInfo['id'], permissions: RoleInfo['permissions']): RoleInfo => ({ id, name: id, locked: id === 'admin', permissions, staffCount: 1, version: 1 })
const roles = [
  role('admin', ['tenants.manage', 'billing.manage', 'sms.manage', 'access.manage']),
  role('support', ['tenants.view', 'sms.manage', 'access.manage']),
  role('billing', ['tenants.view', 'billing.manage']),
  role('auditor', ['tenants.view', 'billing.view']),
]

describe('canChangeRole', () => {
  it('lets a role change its own members', () => {
    for (const r of roles) expect(canChangeRole(roles, r.id, r.id), r.id).toBe(true)
  })
  it('lets a Super admin change everyone', () => {
    for (const r of roles) expect(canChangeRole(roles, 'admin', r.id), r.id).toBe(true)
  })
  it('stops a manager changing someone whose role holds a permission they lack', () => {
    expect(canChangeRole(roles, 'support', 'admin')).toBe(false)
    expect(canChangeRole(roles, 'support', 'billing')).toBe(false) // billing.manage
    expect(canChangeRole(roles, 'support', 'auditor')).toBe(false) // billing.view
  })
  it('lets a role change a role that is within its own, with manage covering view', () => {
    expect(canChangeRole(roles, 'billing', 'auditor')).toBe(true)
  })
  it('says no when it cannot tell', () => {
    expect(canChangeRole([], 'admin', 'support')).toBe(false)
    expect(canChangeRole(roles, undefined, 'support')).toBe(false)
  })
})

describe('assignableRoles', () => {
  it('is the roles the caller holds in full, their own included', () => {
    expect(assignableRoles(roles, 'support').map((r) => r.id)).toEqual(['support'])
    expect(assignableRoles(roles, 'billing').map((r) => r.id)).toEqual(['billing', 'auditor'])
    expect(assignableRoles(roles, 'admin').map((r) => r.id)).toEqual(['admin', 'support', 'billing', 'auditor'])
  })
})
