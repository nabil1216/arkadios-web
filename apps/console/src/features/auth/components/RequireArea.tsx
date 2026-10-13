import { Outlet } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import type { Area } from '../api/types'
import { usePermission } from '../hooks/usePermission'
import { NoAccessPage } from '../pages/NoAccessPage'

/** Cosmetic route guard for one area; the server is the authority. */
export function RequireArea({ area }: { area: Area }) {
  const { allowed, isPending, isError, refetch } = usePermission(`${area}.view`)

  if (isPending) {
    return (
      <div role="status" className="text-ink-2">
        Loading
      </div>
    )
  }

  if (isError) {
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

  return allowed ? <Outlet /> : <NoAccessPage area={area} />
}
