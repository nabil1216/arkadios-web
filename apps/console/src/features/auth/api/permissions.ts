import { api } from '@/lib/api'
import type { PermissionMatrix } from '../permissions'

export const permissionsKey = ['auth', 'permissions'] as const

export function fetchPermissions() {
  return api<PermissionMatrix>('/permissions')
}
