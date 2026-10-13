// Seed data for the mocked API. Values follow seed() in
// docs/handoff/platform-console/assets/platform.js. The permission keys per
// role live here only; the app reads them through GET /api/permissions.
import type { PermissionMap, Role } from '@/features/auth/api/types'

export const DEMO_PASSWORD = 'demo-1234'
export const DEMO_CODE = '123456'
export const IDLE_MINUTES = 30

// MFA is required for every platform user (docs/ARCHITECTURE.md, section 5),
// so staff have no per-user MFA switch.
export interface SeedStaff {
  id: string
  name: string
  email: string
  role: Role
  status: 'active' | 'invited' | 'deactivated'
}

export const staff: SeedStaff[] = [
  { id: 'u1', name: 'Dana Whitfield', email: 'dana.whitfield@platform.example', role: 'admin', status: 'active' },
  { id: 'u2', name: 'Omar Haddad', email: 'omar.haddad@platform.example', role: 'support', status: 'active' },
  { id: 'u3', name: 'Priya Nair', email: 'priya.nair@platform.example', role: 'billing', status: 'active' },
  { id: 'u4', name: 'Liam Carter', email: 'liam.carter@platform.example', role: 'auditor', status: 'active' },
  { id: 'u5', name: 'Sofia Reyes', email: 'sofia.reyes@platform.example', role: 'support', status: 'invited' },
]

/** Where each role lands after sign-in (LANDING in the demo). */
export const homeByRole: Record<Role, string> = {
  admin: '/overview',
  support: '/tenants',
  billing: '/billing',
  auditor: '/overview',
}

/**
 * Permission keys per role (GET /api/permissions). `<area>.manage` implies
 * `<area>.view`, so roles list only their highest key per area.
 * Mirrors s.perms in the demo's seed().
 */
export const permissions: PermissionMap = {
  admin: ['tenants.manage', 'plans.manage', 'billing.manage', 'transactions.manage', 'sms.manage', 'support.manage', 'access.manage'],
  support: ['tenants.view', 'plans.view', 'billing.view', 'sms.manage', 'support.manage'],
  billing: ['tenants.view', 'plans.view', 'billing.manage', 'transactions.manage'],
  auditor: ['tenants.view', 'plans.view', 'billing.view', 'transactions.view', 'support.view', 'access.view'],
}
