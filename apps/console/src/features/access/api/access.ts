import { api } from '@/lib/api'
import type { Role } from '@/features/auth/api/types'
import type { InviteInput, RoleInfo, RoleList, StaffList, StaffMember, UpdateRoleInput, UpdateStaffInput } from './types'

/** Every access control query starts with this key, so a mutation can invalidate them all. */
export const accessKey = ['access'] as const
export const staffKey = [...accessKey, 'staff'] as const
export const rolesKey = [...accessKey, 'roles'] as const

export const fetchStaff = () => api<StaffList>('/staff')
export const fetchRoles = () => api<RoleList>('/roles')

/** Sends the person a set-password link. There is no password in the request. */
export const inviteStaff = (input: InviteInput) => api<StaffMember>('/staff', { method: 'POST', body: input })

export const resendInvite = (id: string) => api<void>(`/staff/${encodeURIComponent(id)}/resend-invite`, { method: 'POST', body: {} })

/** A role change or a disable ends that person's sessions at once. A stale `version` is a 409. */
export const updateStaff = (id: string, input: UpdateStaffInput) =>
  api<StaffMember>(`/staff/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })

/** A soft delete on the server. A stale `version` is a 409. */
export const removeStaff = (id: string, version: number) =>
  api<void>(`/staff/${encodeURIComponent(id)}?version=${version}`, { method: 'DELETE' })

export const updateRolePermissions = (role: Role, input: UpdateRoleInput) =>
  api<RoleInfo>(`/roles/${encodeURIComponent(role)}/permissions`, { method: 'PUT', body: input })
