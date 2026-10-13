import { useQuery } from '@tanstack/react-query'
import { fetchPermissions, permissionsKey } from '../api/permissions'
import type { Area } from '../api/types'
import { canManage, canView, levelOf } from './permissions'
import { useSession } from './session'

/** The keys per role from GET /api/permissions plus the signed-in role. */
export function usePermissionMatrix() {
  const session = useSession()
  const query = useQuery({
    queryKey: permissionsKey,
    queryFn: fetchPermissions,
    enabled: session.status === 'authenticated',
  })
  return {
    permissions: query.data,
    role: session.status === 'authenticated' ? session.user.role : undefined,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}

/** UI checks are cosmetic; the server is the authority. */
export function usePermission(area: Area) {
  const { permissions, role, isPending } = usePermissionMatrix()
  return {
    isPending,
    level: levelOf(permissions, role, area),
    canView: canView(permissions, role, area),
    canManage: canManage(permissions, role, area),
  }
}
