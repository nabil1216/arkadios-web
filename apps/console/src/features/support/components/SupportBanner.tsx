import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import { supportErrorText } from '../api/problems'
import { reissueHandoff, supportKey } from '../api/support'
import { openWorkspace } from '../hooks/openWorkspace'
import { useActiveSession } from '../hooks/useActiveSession'
import { useCountdown } from '../hooks/useCountdown'
import { formatCountdown, MODE_LABEL } from '../hooks/sessionText'
import type { SupportSession } from '../api/types'

function Banner({ session }: { session: SupportSession }) {
  const queryClient = useQueryClient()
  const left = useCountdown(session.expiresAt)
  const guard = useSubmitGuard()
  // A new one-time code, for a workspace tab that did not open (a blocked pop-up). It works until the workspace has been opened once.
  const reopen = useMutation({
    mutationFn: () => reissueHandoff(session.id),
    onSuccess: ({ handoff }) => openWorkspace(handoff.url),
    onError: (e) => toast.error(supportErrorText(e, 'Could not open the workspace. Try again.')),
  })

  // When the time is up the server ends the session: read it again so the banner and the list catch up.
  useEffect(() => {
    if (left === 0) void queryClient.invalidateQueries({ queryKey: supportKey })
  }, [left, queryClient])

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-line bg-teal-tint px-8 py-2.5 max-[860px]:px-4">
      <Eye size={18} strokeWidth={1.7} aria-hidden="true" className="shrink-0 text-teal-ink" />
      <p className="m-0 min-w-[240px] flex-1">
        Support session: signed in as <strong>{session.tenantUserName}</strong> at <strong>{session.tenantName}</strong> ({MODE_LABEL[session.mode]}). Everything
        you do is recorded.
      </p>
      <span className="whitespace-nowrap tabular-nums">
        <span className="text-ink-2">Time left </span>
        <strong aria-label={`${formatCountdown(left)} left`}>{formatCountdown(left)}</strong>
      </span>
      <Button variant="secondary" size="sm" disabled={guard.pending} onClick={() => void guard.run(() => reopen.mutateAsync())}>
        Open workspace
      </Button>
    </div>
  )
}

/** Shown on every console page while the signed-in person has a support session open (the demo's .session-banner). */
export function SupportBanner() {
  const { data } = useActiveSession()
  if (!data) return null
  return <Banner key={data.id} session={data} />
}
