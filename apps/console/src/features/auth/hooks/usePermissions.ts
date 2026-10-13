import { useQuery } from '@tanstack/react-query'
import { fetchPermissions, permissionsKey } from '../api/permissions'
import { canManage, canView, levelOf, type Area } from '../permissions'
import { useSession } from '../session'

/** The role matrix from GET /api/permissions plus the signed-in role. */
export function usePermissionMatrix() {
  const session = useSession()
  const query = useQuery({
    queryKey: permissionsKey,
    queryFn: fetchPermissions,
    enabled: session.status === 'authenticated',
  })
  return {
    matrix: query.data,
    role: session.status === 'authenticated' ? session.user.role : undefined,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  }
}

/** UI checks are cosmetic; the server is the authority. */
export function usePermission(area: Area) {
  const { matrix, role, isPending } = usePermissionMatrix()
  return {
    isPending,
    level: levelOf(matrix, role, area),
    canView: canView(matrix, role, area),
    canManage: canManage(matrix, role, area),
  }
}
