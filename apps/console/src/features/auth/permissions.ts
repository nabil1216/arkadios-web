// Types and pure helpers only. The role matrix itself comes from
// GET /api/permissions; it is never defined in the app.

export type Role = 'admin' | 'support' | 'billing' | 'auditor'

export type Area =
  | 'tenants'
  | 'plans'
  | 'billing'
  | 'transactions'
  | 'sms'
  | 'support'
  | 'access'

export type Level = 'manage' | 'view' | 'none'

export type PermissionMatrix = Record<Area, Record<Role, Level>>

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Super admin',
  support: 'Support lead',
  billing: 'Billing manager',
  auditor: 'Auditor',
}

export const AREA_LABELS: Record<Area, string> = {
  tenants: 'Tenants',
  plans: 'Plans and modules',
  billing: 'Billing',
  transactions: 'Transactions',
  sms: 'SMS',
  support: 'Support access',
  access: 'Access control',
}

export function levelOf(
  matrix: PermissionMatrix | undefined,
  role: Role | undefined,
  area: Area,
): Level {
  if (!matrix || !role) return 'none'
  return matrix[area]?.[role] ?? 'none'
}

export function canView(
  matrix: PermissionMatrix | undefined,
  role: Role | undefined,
  area: Area,
): boolean {
  return levelOf(matrix, role, area) !== 'none'
}

export function canManage(
  matrix: PermissionMatrix | undefined,
  role: Role | undefined,
  area: Area,
): boolean {
  return levelOf(matrix, role, area) === 'manage'
}
