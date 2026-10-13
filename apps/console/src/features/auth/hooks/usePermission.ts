import { useQuery } from '@tanstack/react-query'
import { fetchPermissions, permissionsKey } from '../api/permissions'
import type { PermissionKey } from '../api/types'
import { hasPermission } from './permissions'
import { useSession } from './session'

/**
 * Whether the signed-in role holds a permission key (`manage` implies `view`).
 * UI checks are cosmetic; the server is the authority.
 */
export function usePermission(key: PermissionKey) {
  const session = useSession()
  const query = useQuery({
    queryKey: permissionsKey,
    queryFn: fetchPermissions,
    enabled: session.status === 'authenticated',
  })
  const role = session.status === 'authenticated' ? session.user.role : undefined
  return {
    allowed: hasPermission(query.data, role, key),
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}
