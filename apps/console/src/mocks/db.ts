// Seed data for the mocked API. Values follow seed() in
// docs/handoff/platform-console/assets/platform.js. The permission keys per
// role live here only; the app reads them through GET /api/permissions.
import type { PermissionMap, Role } from '@/features/auth/api/types'

export const DEMO_PASSWORD = 'demo-1234'
export const DEMO_CODE = '123456'
export const IDLE_MINUTES = 30
/** Access token lifetime; the architecture asks for 10 to 15 minutes. */
export const ACCESS_TOKEN_SECONDS = 900

// MFA is required for every platform user (docs/ARCHITECTURE.md, section 5),
// so staff have no per-user MFA switch; `mfaEnrolled` is only whether they have set it up.
export interface SeedStaff {
  id: string
  name: string
  email: string
  role: Role
  status: 'active' | 'invited' | 'deactivated'
  mfaEnrolled: boolean
  lastActiveAt: string | null
  version: number
  /** Bumped when the role or status changes: access tokens carrying an older stamp stop working. */
  securityStamp: number
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

/** The demo's five staff (s.staff in platform.js). The auditor is enrolled here: MFA is required for all. */
export const seedStaff = (): SeedStaff[] => {
  const base = { version: 1, securityStamp: 0 }
  return [
    { id: 'u1', name: 'Dana Whitfield', email: 'dana.whitfield@platform.example', role: 'admin', status: 'active', mfaEnrolled: true, lastActiveAt: hoursAgo(0.2), ...base },
    { id: 'u2', name: 'Omar Haddad', email: 'omar.haddad@platform.example', role: 'support', status: 'active', mfaEnrolled: true, lastActiveAt: hoursAgo(2), ...base },
    { id: 'u3', name: 'Priya Nair', email: 'priya.nair@platform.example', role: 'billing', status: 'active', mfaEnrolled: true, lastActiveAt: hoursAgo(24), ...base },
    { id: 'u4', name: 'Liam Carter', email: 'liam.carter@platform.example', role: 'auditor', status: 'active', mfaEnrolled: true, lastActiveAt: hoursAgo(144), ...base },
    { id: 'u5', name: 'Sofia Reyes', email: 'sofia.reyes@platform.example', role: 'support', status: 'invited', mfaEnrolled: false, lastActiveAt: null, ...base },
  ]
}

export const staff: SeedStaff[] = seedStaff()

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
export const seedPermissions = (): PermissionMap => ({
  admin: ['tenants.manage', 'plans.manage', 'billing.manage', 'transactions.manage', 'sms.manage', 'support.manage', 'access.manage'],
  support: ['tenants.view', 'plans.view', 'billing.view', 'sms.manage', 'support.manage'],
  billing: ['tenants.view', 'plans.view', 'billing.manage', 'transactions.manage'],
  auditor: ['tenants.view', 'plans.view', 'billing.view', 'transactions.view', 'support.view', 'access.view'],
})

export const permissions: PermissionMap = seedPermissions()
