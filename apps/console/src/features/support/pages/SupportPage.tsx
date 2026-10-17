import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { SessionsTable } from '../components/SessionsTable'
import { SessionsToolbar } from '../components/SessionsToolbar'
import { SupportRules } from '../components/SupportRules'
import { useSessionList } from '../hooks/useSessionList'

const NO_MATCH = 'No sessions match. Choose another status.'
const NONE_YET = 'There are no support sessions yet.'

export default function SupportPage() {
  const { state, list, update } = useSessionList()
  const { data, isError, error, isPlaceholderData, refetch } = list

  return (
    <>
      <PageHeader title="Support access" description="Platform staff can sign in as a tenant user to troubleshoot, without ever seeing a password." />

      <SupportRules />

      <SessionsToolbar status={state.status} onStatus={(status) => update({ status })} />

      {isError && !data ? (
        <QueryErrorPanel title="Could not load support sessions." error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <SessionsTable sessions={data?.items} emptyMessage={state.status !== 'all' ? NO_MATCH : NONE_YET} busy={isPlaceholderData} />
          {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => update({ page })} /> : null}
        </>
      )}
    </>
  )
}
