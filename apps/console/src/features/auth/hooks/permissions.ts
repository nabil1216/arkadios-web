// Labels and pure helpers only. The permission keys per role come from
// GET /api/permissions; it is never defined in the app.
import type { Area, Level, PermissionKey, PermissionMap, Role } from '../api/types'

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

/** True when the role holds the key. `<area>.manage` also grants `<area>.view`. */
export function hasPermission(
  map: PermissionMap | undefined,
  role: Role | undefined,
  key: PermissionKey,
): boolean {
  const keys = map && role ? map[role] : undefined
  if (!keys) return false
  if (keys.includes(key)) return true
  return key.endsWith('.view') && keys.includes(`${key.slice(0, -'.view'.length)}.manage` as PermissionKey)
}

export function levelOf(
  map: PermissionMap | undefined,
  role: Role | undefined,
  area: Area,
): Level {
  if (hasPermission(map, role, `${area}.manage`)) return 'manage'
  if (hasPermission(map, role, `${area}.view`)) return 'view'
  return 'none'
}

export function canView(map: PermissionMap | undefined, role: Role | undefined, area: Area): boolean {
  return hasPermission(map, role, `${area}.view`)
}

export function canManage(map: PermissionMap | undefined, role: Role | undefined, area: Area): boolean {
  return hasPermission(map, role, `${area}.manage`)
}
