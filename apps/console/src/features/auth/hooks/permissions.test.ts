import { describe, expect, it } from 'vitest'
import type { PermissionMap } from '../api/types'
import { canManage, canView, hasPermission, levelOf } from './permissions'

// Made up for the test. The real keys come from GET /api/permissions.
const map: PermissionMap = {
  admin: ['tenants.manage', 'sms.manage'],
  support: ['tenants.view', 'sms.manage'],
  billing: ['tenants.view'],
  auditor: [],
}

describe('hasPermission', () => {
  it('is true for a key the role holds', () => {
    expect(hasPermission(map, 'support', 'tenants.view')).toBe(true)
    expect(hasPermission(map, 'admin', 'tenants.manage')).toBe(true)
  })

  it('treats manage as implying view', () => {
    expect(hasPermission(map, 'admin', 'tenants.view')).toBe(true)
    expect(hasPermission(map, 'support', 'sms.view')).toBe(true)
  })

  it('does not treat view as implying manage', () => {
    expect(hasPermission(map, 'support', 'tenants.manage')).toBe(false)
  })

  it('does not carry an implication across areas', () => {
    expect(hasPermission(map, 'admin', 'plans.view')).toBe(false)
    expect(hasPermission(map, 'support', 'billing.view')).toBe(false)
  })

  it('is false while permissions have not loaded or without a role', () => {
    expect(hasPermission(undefined, 'admin', 'tenants.view')).toBe(false)
    expect(hasPermission(map, undefined, 'tenants.view')).toBe(false)
  })

  it('is false for a role missing from the map', () => {
    expect(hasPermission({} as PermissionMap, 'admin', 'tenants.view')).toBe(false)
  })
})

describe('levelOf', () => {
  it('returns manage, view or none from the keys', () => {
    expect(levelOf(map, 'admin', 'tenants')).toBe('manage')
    expect(levelOf(map, 'support', 'tenants')).toBe('view')
    expect(levelOf(map, 'billing', 'sms')).toBe('none')
    expect(levelOf(map, 'auditor', 'tenants')).toBe('none')
  })

  it('returns none without a map or role', () => {
    expect(levelOf(undefined, 'admin', 'tenants')).toBe('none')
    expect(levelOf(map, undefined, 'tenants')).toBe('none')
  })
})

describe('canView', () => {
  it('is true for view and manage, false for none', () => {
    expect(canView(map, 'billing', 'tenants')).toBe(true)
    expect(canView(map, 'support', 'sms')).toBe(true)
    expect(canView(map, 'auditor', 'tenants')).toBe(false)
  })
})

describe('canManage', () => {
  it('is true only for manage', () => {
    expect(canManage(map, 'admin', 'tenants')).toBe(true)
    expect(canManage(map, 'support', 'tenants')).toBe(false)
    expect(canManage(map, 'support', 'sms')).toBe(true)
  })
})
