import { Headset } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { Button } from '@/components/ui/button'
import { Can } from '@/features/auth/components/Can'
import { usePermission } from '@/features/auth/hooks/usePermission'
import { useSession } from '@/features/auth/hooks/session'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import { supportErrorText } from '../api/problems'
import type { SupportSession } from '../api/types'
import { revokeConfirmCopy } from '../hooks/startCopy'
import { useEndSession } from '../hooks/useEndSession'
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
  const session = useSession()
  const selfId = session.status === 'authenticated' ? session.user.id : undefined
  const canRevoke = usePermission('support.manage').allowed
  const end = useEndSession()
  const guard = useSubmitGuard()
  const [revoking, setRevoking] = useState<SupportSession | null>(null)

  /** The owner ends their own session: no question, it is theirs. A refusal is shown as it comes. */
  function onEnd(s: SupportSession) {
    void guard.run(async () => {
      try {
        await end.mutateAsync(s.id)
        toast('Support session ended')
      } catch (e) {
        toast.error(supportErrorText(e, 'Could not end the session. Try again.'))
      }
    })
  }

  /** Revoking someone else's session was confirmed. A refusal stays in the dialog, in the server's words. */
  async function revoke(s: SupportSession) {
    try {
      await end.mutateAsync(s.id)
    } catch (e) {
      throw new Error(supportErrorText(e, 'Could not revoke the session. Try again.'), { cause: e })
    }
    toast(`${s.staffName}'s session was revoked`)
    setRevoking(null)
  }

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
          <SessionsTable
            sessions={data?.items}
            emptyMessage={state.status !== 'all' ? NO_MATCH : NONE_YET}
            busy={isPlaceholderData}
            actions={{ selfId, canRevoke, pending: guard.pending, onEnd, onRevoke: setRevoking }}
          />
          {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => update({ page })} /> : null}
        </>
      )}
      <ConfirmDialog copy={revoking ? revokeConfirmCopy(revoking) : null} onCancel={() => setRevoking(null)} onConfirm={() => revoke(revoking!)} />
    </StartSessionProvider>
  )
}
