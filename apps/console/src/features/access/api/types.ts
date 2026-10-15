import type { PermissionKey, Role } from '@/features/auth/api/types'

// Hand-written until packages/api-client is generated; replace then.

export type StaffStatus = 'active' | 'invited' | 'deactivated'

/** A status the console may set. `invited` only ever comes from an invitation. */
export type SettableStatus = 'active' | 'deactivated'

export interface StaffMember {
  id: string
  name: string
  email: string
  /** One role per person. */
  role: Role
  status: StaffStatus
  /** Read only. MFA is required for every platform user; there is no setting for it. */
  mfaEnrolled: boolean
  /** ISO 8601 UTC, null when the person has never signed in. */
  lastActiveAt: string | null
  version: number
}

export interface StaffList {
  items: StaffMember[]
}

/** There is deliberately no password field: an invitation sends a set-password link. */
export interface InviteInput {
  name: string
  email: string
  role: Role
}

export interface UpdateStaffInput {
  role?: Role
  status?: SettableStatus
  version: number
}

export interface RoleInfo {
  id: Role
  name: string
  /** A locked role (Super admin) cannot be edited. */
  locked: boolean
  permissions: PermissionKey[]
  /** People in the role who are not deactivated. */
  staffCount: number
  version: number
}

export interface RoleList {
  items: RoleInfo[]
}

export interface UpdateRoleInput {
  permissions: PermissionKey[]
  version: number
}

export const NAME_MAX_LENGTH = 100
export const EMAIL_MAX_LENGTH = 254

/** Problem `type` slugs of the safety 409s (docs/ARCHITECTURE.md, Access control). */
export const ACCESS_PROBLEM = {
  selfLockout: 'access/self-lockout',
  lastAdmin: 'access/last-admin',
  lastManagerRole: 'access/last-manager-role',
  escalation: 'access/escalation',
  outranked: 'access/outranked',
  roleLocked: 'access/role-locked',
} as const
