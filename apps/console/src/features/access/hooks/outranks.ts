import type { PermissionKey, Role } from '@/features/auth/api/types'
import type { RoleInfo } from '../api/types'
import { lostPermissions } from './permissionDiff'

const keysOf = (roles: RoleInfo[], id: Role | undefined): PermissionKey[] | undefined => roles.find((r) => r.id === id)?.permissions

/** True when `holder` has every key of `needed` (`manage` covers `view`). */
const holdsAll = (holder: PermissionKey[], needed: PermissionKey[]) => lostPermissions(needed, holder).length === 0

/**
 * Whether the signed-in role may change someone in `targetRole`: it must hold every permission that role holds.
 * Mirrors the server's access/outranked rule so the console can hide what would be refused. The server decides.
 */
export function canChangeRole(roles: RoleInfo[], actorRole: Role | undefined, targetRole: Role): boolean {
  const actor = keysOf(roles, actorRole)
  const target = keysOf(roles, targetRole)
  return !!actor && !!target && holdsAll(actor, target)
}

/** The roles the signed-in role may hand out: those whose permissions it holds in full (its own role among them). */
export function assignableRoles(roles: RoleInfo[], actorRole: Role | undefined): RoleInfo[] {
  return roles.filter((r) => canChangeRole(roles, actorRole, r.id))
}
