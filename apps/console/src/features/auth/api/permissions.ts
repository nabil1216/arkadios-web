import { api } from '@/lib/api'
import type { PermissionMap } from './types'

export const permissionsKey = ['auth', 'permissions'] as const

export function fetchPermissions() {
  return api<PermissionMap>('/permissions')
}
