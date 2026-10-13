import { api } from '@/lib/api'
import type { PermissionMatrix } from './types'

export const permissionsKey = ['auth', 'permissions'] as const

export function fetchPermissions() {
  return api<PermissionMatrix>('/permissions')
}
