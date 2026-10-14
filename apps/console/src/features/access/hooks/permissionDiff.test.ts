import { describe, expect, it } from 'vitest'
import type { PermissionKey } from '@/features/auth/api/types'
import { describePermission, describePermissions, gainedPermissions, holdsManage, lostPermissions } from './permissionDiff'

const billing: PermissionKey[] = ['tenants.view', 'plans.view', 'billing.manage', 'transactions.manage']
const auditor: PermissionKey[] = ['tenants.view', 'plans.view', 'billing.view', 'transactions.view', 'support.view', 'access.view']

describe('lostPermissions', () => {
  it('lists what the new keys lack', () => {
    expect(lostPermissions(billing, auditor)).toEqual(['billing.manage', 'transactions.manage'])
    expect(lostPermissions(auditor, billing)).toEqual(['support.view', 'access.view'])
  })

  it('is empty for a move that only adds', () => {
    expect(lostPermissions(['tenants.view'], billing)).toEqual([])
    expect(lostPermissions(billing, billing)).toEqual([])
  })

  it('names a lost manage once, without its view as well', () => {
    expect(lostPermissions(['billing.manage'], [])).toEqual(['billing.manage'])
  })

  it('keeps the view when only the manage goes', () => {
    expect(lostPermissions(['billing.manage'], ['billing.view'])).toEqual(['billing.manage'])
    expect(lostPermissions(['billing.manage'], ['billing.manage'])).toEqual([])
  })

  it('treats manage as covering view on both sides', () => {
    expect(lostPermissions(['billing.view'], ['billing.manage'])).toEqual([])
  })
})

describe('gainedPermissions', () => {
  it('is what the new keys add', () => {
    expect(gainedPermissions(['tenants.view'], ['tenants.manage'])).toEqual(['tenants.manage'])
    expect(gainedPermissions(auditor, ['tenants.view'])).toEqual([])
  })
})

describe('holdsManage', () => {
  it('is true only for access.manage', () => {
    expect(holdsManage(['access.manage'])).toBe(true)
    expect(holdsManage(auditor)).toBe(false)
    expect(holdsManage(['billing.manage'])).toBe(false)
  })
})

describe('describePermission', () => {
  it('says what a key lets a person do', () => {
    expect(describePermission('billing.manage')).toBe('change billing')
    expect(describePermission('transactions.view')).toBe('view transactions')
    expect(describePermission('plans.manage')).toBe('change plans and modules')
    expect(describePermission('access.view')).toBe('view access control')
  })

  it('joins a list in words', () => {
    expect(describePermissions([])).toBe('nothing')
    expect(describePermissions(['billing.manage'])).toBe('change billing')
    expect(describePermissions(['billing.manage', 'transactions.manage'])).toBe('change billing and change transactions')
    expect(describePermissions(['sms.view', 'support.view', 'access.view'])).toBe('view sms, view support access and view access control')
  })
})
