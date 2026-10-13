// Seed data for the mocked API. Values follow seed() in
// docs/handoff/platform-console/assets/platform.js. The role matrix lives
// here only; the app reads it through GET /api/permissions.
import type { PermissionMatrix, Role } from '@/features/auth/api/types'

export const DEMO_PASSWORD = 'demo-1234'
export const DEMO_CODE = '123456'
export const IDLE_MINUTES = 30

export interface SeedStaff {
  id: string
  name: string
  email: string
  role: Role
  mfa: boolean
  status: 'active' | 'invited' | 'deactivated'
}

export const staff: SeedStaff[] = [
  { id: 'u1', name: 'Dana Whitfield', email: 'dana.whitfield@platform.example', role: 'admin', mfa: true, status: 'active' },
  { id: 'u2', name: 'Omar Haddad', email: 'omar.haddad@platform.example', role: 'support', mfa: true, status: 'active' },
  { id: 'u3', name: 'Priya Nair', email: 'priya.nair@platform.example', role: 'billing', mfa: true, status: 'active' },
  { id: 'u4', name: 'Liam Carter', email: 'liam.carter@platform.example', role: 'auditor', mfa: false, status: 'active' },
  { id: 'u5', name: 'Sofia Reyes', email: 'sofia.reyes@platform.example', role: 'support', mfa: false, status: 'invited' },
]

/** Where each role lands after sign-in (LANDING in the demo). */
export const homeByRole: Record<Role, string> = {
  admin: '/overview',
  support: '/tenants',
  billing: '/billing',
  auditor: '/overview',
}

export const permissions: PermissionMatrix = {
  tenants: { admin: 'manage', support: 'view', billing: 'view', auditor: 'view' },
  plans: { admin: 'manage', support: 'view', billing: 'view', auditor: 'view' },
  billing: { admin: 'manage', support: 'view', billing: 'manage', auditor: 'view' },
  transactions: { admin: 'manage', support: 'none', billing: 'manage', auditor: 'view' },
  sms: { admin: 'manage', support: 'manage', billing: 'none', auditor: 'none' },
  support: { admin: 'manage', support: 'manage', billing: 'none', auditor: 'view' },
  access: { admin: 'manage', support: 'none', billing: 'none', auditor: 'view' },
}
