import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Circle, X } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { fetchProvisioning, provisioningKey, tenantsKey } from '../api/tenants'
import type { ProvisioningStep } from '../api/types'
import { COMING_LATER, COMING_LATER_ID } from './pendingAction'

/** How often to ask the server how far provisioning got (each step takes about a second). */
export const POLL_MS = 800

const STATE_LABEL = { done: 'done', running: 'in progress', waiting: 'waiting', failed: 'failed' } as const

function StepIcon({ state }: { state: ProvisioningStep['state'] }) {
  if (state === 'done') return <Check size={16} strokeWidth={2} className="text-green" />
  if (state === 'failed') return <X size={16} strokeWidth={2} className="text-red" />
  if (state === 'running') {
    return <span className="size-4 animate-spin rounded-full border-2 border-line border-t-teal" />
  }
  return <Circle size={10} strokeWidth={1.7} className="text-line" />
}

interface ProvisioningViewProps {
  id: string
  onDone: () => void
  /** True while the server is still working: the drawer cannot be closed (as in the demo). */
  onBusyChange: (busy: boolean) => void
}

export function ProvisioningView({ id, onDone, onBusyChange }: ProvisioningViewProps) {
  const queryClient = useQueryClient()
  const { data, isError, refetch } = useQuery({
    queryKey: provisioningKey(id),
    queryFn: () => fetchProvisioning(id),
    refetchInterval: (query) => (query.state.data?.status === 'running' || !query.state.data ? POLL_MS : false),
    // A lost connection or an unknown id is shown, not retried forever.
    retry: false,
  })

  const status = data?.status
  const busy = !isError && status !== 'succeeded' && status !== 'failed'
  useEffect(() => {
    onBusyChange(busy)
  }, [busy, onBusyChange])

  // The new tenant joins the list when provisioning finishes: refresh every tenants query.
  useEffect(() => {
    if (status === 'succeeded') void queryClient.invalidateQueries({ queryKey: tenantsKey })
  }, [status, queryClient])

  if (isError && !data) {
    return (
      <div role="alert" className="grid gap-3">
        <p>Could not check how far the setup got. The tenant may still be on its way, so look for it in the list.</p>
        <div>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <p role="status" className="text-ink-2">
        Starting setup
      </p>
    )
  }

  return (
    <div className="grid gap-5">
      <ol aria-live="polite" className="m-0 grid list-none gap-2.5 p-0">
        {data.steps.map((step) => (
          <li
            key={step.key}
            data-state={step.state}
            className={
              step.state === 'waiting' ? 'flex items-center gap-2.5 text-ink-2' : 'flex items-center gap-2.5'
            }
          >
            <span aria-hidden="true" className="grid size-5 place-items-center">
              <StepIcon state={step.state} />
            </span>
            <span>{step.label}</span>
            <span className="sr-only"> ({STATE_LABEL[step.state]})</span>
          </li>
        ))}
      </ol>

      {data.status === 'failed' ? (
        <div role="alert" className="grid gap-3">
          <p>Setting up this tenant did not finish. Close this panel and try again, or contact support.</p>
        </div>
      ) : null}

      {data.status === 'succeeded' && data.result ? (
        <div role="status" className="rounded-md border border-line bg-[#f8fafb] p-4">
          <h3 className="mb-1">{data.result.name} is ready</h3>
          <p className="text-ink-2">
            Workspace at <span className="font-mono text-[12.5px]">{data.result.domain}</span>. An invitation went to{' '}
            {data.result.adminEmail}. The trial runs for {data.result.trialDays} days.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="secondary"
              aria-disabled="true"
              aria-describedby={COMING_LATER_ID}
              title={COMING_LATER}
              onClick={(e) => e.preventDefault()}
              className="cursor-not-allowed"
            >
              Manage tenant
            </Button>
            <Button onClick={onDone}>Done</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
