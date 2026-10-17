import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { Button } from '@/components/ui/button'
import { Can } from '@/features/auth/components/Can'
import { ApiError } from '@/lib/api'
import { COMING_LATER, COMING_LATER_ID } from '../components/pendingAction'
import { StartSessionProvider } from '@/features/support/components/StartSessionProvider'
import { SIGN_IN_UNAVAILABLE, SIGN_IN_UNAVAILABLE_ID } from '@/features/support/components/signInAs'
import { CreateTenantDrawer } from '../components/CreateTenantDrawer'
import { TenantsTable } from '../components/TenantsTable'
import { TenantsToolbar } from '../components/TenantsToolbar'
import { useTenantList } from '../hooks/useTenantList'

const NO_MATCH = 'No tenants match. Clear the search or choose another status.'
const NONE_YET = 'There are no tenants yet.'

export default function TenantsPage() {
  const { state, query, update } = useTenantList()
  const { data, isError, error, isPlaceholderData, refetch } = query
  const filtered = state.q !== '' || state.status !== 'all'
  const [createOpen, setCreateOpen] = useState(false)
  const createButton = useRef<HTMLButtonElement>(null)

  return (
    <StartSessionProvider>
      <PageHeader
        title="Tenants"
        description="Each tenant has its own domain, database, plan, and user limit."
        actions={
          <Can permission="tenants.manage">
            <Button ref={createButton} onClick={() => setCreateOpen(true)}>
              <Plus size={18} strokeWidth={1.7} aria-hidden="true" /> Create tenant
            </Button>
          </Can>
        }
      />
      <p id={COMING_LATER_ID} className="sr-only">
        {COMING_LATER}
      </p>
      <p id={SIGN_IN_UNAVAILABLE_ID} className="sr-only">
        {SIGN_IN_UNAVAILABLE}
      </p>

      <Can permission="tenants.manage">
        <CreateTenantDrawer open={createOpen} onOpenChange={setCreateOpen} returnFocusTo={createButton} />
      </Can>

      <TenantsToolbar q={state.q} status={state.status} onChange={update} />

      {isError && !data ? (
        <div role="alert" className="rounded-md border border-line bg-paper p-5">
          <h2 className="mb-1">Could not load tenants.</h2>
          <p className="text-ink-2">
            {error instanceof ApiError ? error.message : 'Something went wrong. Check your connection and try again.'}
          </p>
          {error instanceof ApiError && error.traceId ? (
            <p className="mt-1 text-[12.5px] text-ink-2">
              Reference: <span className="font-mono">{error.traceId}</span>
            </p>
          ) : null}
          <Button variant="secondary" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <TenantsTable
            items={data?.items}
            total={data?.total ?? 0}
            page={state.page}
            pageSize={state.pageSize}
            sort={state.sort}
            onSort={(sort) => update({ sort })}
            busy={isPlaceholderData}
            emptyMessage={filtered ? NO_MATCH : NONE_YET}
          />
          {data ? (
            <Pager
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={(page) => update({ page })}
            />
          ) : null}
        </>
      )}
    </StartSessionProvider>
  )
}
