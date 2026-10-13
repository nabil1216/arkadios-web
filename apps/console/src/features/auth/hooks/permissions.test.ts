import { describe, expect, it } from 'vitest'
import type { PermissionMatrix } from '../api/types'
import { canManage, canView, levelOf } from './permissions'

// A small matrix made up for the test. The real one comes from GET /api/permissions.
const matrix = {
  tenants: { admin: 'manage', support: 'view', billing: 'view', auditor: 'view' },
  sms: { admin: 'manage', support: 'manage', billing: 'none', auditor: 'none' },
} as unknown as PermissionMatrix

describe('levelOf', () => {
  it('returns the level for the role and area', () => {
    expect(levelOf(matrix, 'admin', 'tenants')).toBe('manage')
    expect(levelOf(matrix, 'support', 'tenants')).toBe('view')
    expect(levelOf(matrix, 'billing', 'sms')).toBe('none')
  })

  it('returns none while the matrix has not loaded', () => {
    expect(levelOf(undefined, 'admin', 'tenants')).toBe('none')
  })

  it('returns none when there is no signed-in role', () => {
    expect(levelOf(matrix, undefined, 'tenants')).toBe('none')
  })

  it('returns none for an area the matrix does not list', () => {
    expect(levelOf(matrix, 'admin', 'access')).toBe('none')
  })
})

describe('canView', () => {
  it('is true for view and manage, false for none', () => {
    expect(canView(matrix, 'auditor', 'tenants')).toBe(true)
    expect(canView(matrix, 'support', 'sms')).toBe(true)
    expect(canView(matrix, 'auditor', 'sms')).toBe(false)
  })

  it('is false without a matrix or role', () => {
    expect(canView(undefined, 'admin', 'tenants')).toBe(false)
    expect(canView(matrix, undefined, 'tenants')).toBe(false)
  })
})

describe('canManage', () => {
  it('is true only for manage', () => {
    expect(canManage(matrix, 'admin', 'tenants')).toBe(true)
    expect(canManage(matrix, 'support', 'tenants')).toBe(false)
    expect(canManage(matrix, 'billing', 'sms')).toBe(false)
  })
})
