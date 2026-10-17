import { useEffect, useState } from 'react'
import { useLoaderData } from 'react-router'
import { Button } from '@/components/ui/button'
import { TENANT_API_BASE } from '@/lib/api'
import { formatCountdown, MODE_LABEL } from '@/features/support/hooks/sessionText'
import { useCountdown } from '@/features/support/hooks/useCountdown'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import type { SupportExchange } from '@/features/support/api/types'
import type { HandoffResult } from './loader'

/** How often the workspace asks whether the session is still open. The real tenant API checks on every request. */
export const POLL_MS = 3000

const FAILURES = {
  invalid: 'This support link is invalid or has expired.',
  limited: 'Too many attempts. Try again shortly.',
  unavailable: 'The workspace could not be reached. Try again.',
} as const

function Workspace({ exchange }: { exchange: SupportExchange }) {
  const { session, accessToken } = exchange
  const left = useCountdown(session.expiresAt)
  const guard = useSubmitGuard()
  const [over, setOver] = useState<string | null>(null)
  const headers = { Authorization: `Bearer ${accessToken}` }

  // The session can end from the console, or run out: the token stops working, and so does the workspace.
  useEffect(() => {
    if (over) return
    const id = setInterval(() => {
      void fetch(`${TENANT_API_BASE}/support/session`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((res) => {
        if (res.status === 401) setOver('This support session has ended.')
      })
    }, POLL_MS)
    return () => clearInterval(id)
  }, [over, accessToken])

  const done = over ?? (left === 0 ? 'The time for this support session is up.' : null)

  return (
    <>
      <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-teal-tint px-8 py-3">
        {done ? (
          <p className="m-0 flex-1 font-medium">{done} You can close this tab.</p>
        ) : (
          <>
            <p className="m-0 min-w-[260px] flex-1">
              <strong>{session.actAs.name}</strong> is signed in as <strong>{session.tenantUser.name}</strong> ({MODE_LABEL[session.mode]}). Reason:{' '}
              <span data-testid="reason">{session.reason}</span>
            </p>
            <span className="whitespace-nowrap tabular-nums">
              Time left <strong>{formatCountdown(left)}</strong>
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={guard.pending}
              onClick={() =>
                void guard.run(async () => {
                  await fetch(`${TENANT_API_BASE}/support/session/end`, { method: 'POST', headers })
                  setOver('This support session has ended.')
                })
              }
            >
              End session
            </Button>
          </>
        )}
      </div>
      <main className="mx-auto max-w-[720px] px-8 py-10">
        <h1>Tenant workspace</h1>
        <p className="mt-2 text-ink-2">
          This page stands in for the tenant workspace, which comes later. It shows what the workspace must do with a support handoff: clear the
          code from the address, keep the token in memory, and show this banner for the whole session.
        </p>
      </main>
    </>
  )
}

/** The stand-in tenant workspace (dev only): opened by a support session at /support-handoff#code=... */
export function SupportHandoffPage() {
  const result = useLoaderData() as HandoffResult
  if (result.status === 'ok') return <Workspace exchange={result.exchange} />
  return (
    <main className="mx-auto max-w-[720px] px-8 py-10">
      <h1>This link does not work</h1>
      <p role="alert" className="mt-2 text-ink-2">
        {FAILURES[result.status]}
      </p>
    </main>
  )
}
