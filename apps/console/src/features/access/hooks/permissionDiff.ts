import type { Area, Level, PermissionKey } from '@/features/auth/api/types'
import { AREA_LABELS } from '@/features/auth/hooks/permissions'

/** Every key a list stands for: `<area>.manage` also means `<area>.view`. */
function expand(keys: readonly PermissionKey[]): Set<PermissionKey> {
  const out = new Set<PermissionKey>(keys)
  for (const key of keys) if (key.endsWith('.manage')) out.add(`${key.slice(0, -'.manage'.length)}.view` as PermissionKey)
  return out
}

/** What `from` has that `to` lacks, strongest first per area (a lost `manage` hides its own `view`). */
export function lostPermissions(from: readonly PermissionKey[], to: readonly PermissionKey[]): PermissionKey[] {
  const kept = expand(to)
  const lost = [...expand(from)].filter((key) => !kept.has(key))
  return lost.filter((key) => !(key.endsWith('.view') && lost.includes(`${key.slice(0, -'.view'.length)}.manage` as PermissionKey)))
}

/** What `to` has that `from` lacks. */
export const gainedPermissions = (from: readonly PermissionKey[], to: readonly PermissionKey[]) => lostPermissions(to, from)

/** What a list of keys allows in one area. */
export function levelOfKeys(keys: readonly PermissionKey[], area: Area): Level {
  const all = expand(keys)
  if (all.has(`${area}.manage`)) return 'manage'
  return all.has(`${area}.view`) ? 'view' : 'none'
}

export const holdsManage = (keys: readonly PermissionKey[]) => expand(keys).has('access.manage')

/** "change billing", "view transactions": what a key lets a person do, in words. */
export function describePermission(key: PermissionKey): string {
  const [area, action] = key.split('.') as [Area, 'view' | 'manage']
  return `${action === 'manage' ? 'change' : 'view'} ${AREA_LABELS[area].toLowerCase()}`
}

/** "change billing and view transactions", or "nothing" for an empty list. */
export function describePermissions(keys: readonly PermissionKey[]): string {
  const words = keys.map(describePermission)
  if (words.length === 0) return 'nothing'
  if (words.length === 1) return words[0]
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}
