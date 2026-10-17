import { Headset } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { Button } from '@/components/ui/button'
import { Can } from '@/features/auth/components/Can'
import { StartSessionProvider } from '../components/StartSessionProvider'
import { useStartSession } from '../components/startSessionContext'
import { SessionsTable } from '../components/SessionsTable'
import { SessionsToolbar } from '../components/SessionsToolbar'
import { SupportRules } from '../components/SupportRules'
import { useSessionList } from '../hooks/useSessionList'

const NO_MATCH = 'No sessions match. Choose another status.'
const NONE_YET = 'There are no support sessions yet.'

function StartButton() {
  const start = useStartSession()
  return (
    <Button id="su-start" onClick={() => void start.open()}>
      <Headset size={18} strokeWidth={1.7} aria-hidden="true" /> Start support session
    </Button>
  )
}

export default function SupportPage() {
  const { state, list, update } = useSessionList()
  const { data, isError, error, isPlaceholderData, refetch } = list

  return (
    <StartSessionProvider>
      <PageHeader
        title="Support access"
        description="Platform staff can sign in as a tenant user to troubleshoot, without ever seeing a password."
        actions={
          <Can permission="support.manage">
            <StartButton />
          </Can>
        }
      />

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
    </StartSessionProvider>
  )
}
