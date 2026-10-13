import { Outlet } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { usePermissionMatrix } from '../hooks/usePermissions'
import { NoAccessPage } from '../pages/NoAccessPage'
import type { Area } from '../api/types'
import { canView } from '../hooks/permissions'

/** Cosmetic route guard for one area; the server is the authority. */
export function RequireArea({ area }: { area: Area }) {
  const { permissions, role, isPending, isError, refetch } = usePermissionMatrix()

  if (isPending) {
    return (
      <div role="status" className="text-ink-2">
        Loading
      </div>
    )
  }

  if (isError || !permissions) {
    return (
      <>
        <PageHeader title="Could not load permissions" />
        <div role="alert" className="mb-4 text-red">
          Something went wrong while checking what your role can open.
        </div>
        <Button variant="secondary" onClick={() => void refetch()}>
          Try again
        </Button>
      </>
    )
  }

  return canView(permissions, role, area) ? <Outlet /> : <NoAccessPage area={area} />
}
