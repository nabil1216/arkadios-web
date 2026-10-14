import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Can } from '@/features/auth/components/Can'
import { usePermission } from '@/features/auth/hooks/usePermission'
import { ApiError } from '@/lib/api'
import { fetchPlans, plansKey, updatePlan } from '../api/plans'
import type { Plan, PlanModule, PlansResponse } from '../api/types'
import { ConfirmOffDialog } from '../components/ConfirmOffDialog'
import { PlansMatrix } from '../components/PlansMatrix'
import { offSummaries, toUpdate, trialError, type PlanDraft } from '../hooks/planDraft'
import { usePlanDrafts } from '../hooks/usePlanDrafts'

const NO_PLANS: Plan[] = []
const NO_MODULES: PlanModule[] = []
const NONE_YET = 'There are no plans yet.'

interface Outcome {
  plan: Plan
  saved?: Plan
  error?: unknown
}

/** One PUT per changed plan, all at once. Each plan succeeds or fails on its own. */
async function saveChanged(jobs: Array<{ plan: Plan; draft: PlanDraft }>): Promise<Outcome[]> {
  return Promise.all(
    jobs.map(async ({ plan, draft }): Promise<Outcome> => {
      try {
        return { plan, saved: await updatePlan(plan.id, toUpdate(plan, draft)) }
      } catch (error) {
        return { plan, error }
      }
    }),
  )
}

function problemText(outcome: Outcome): { text: string; conflict: boolean } {
  const { plan, error } = outcome
  if (error instanceof ApiError && error.status === 409) {
    return { text: `${plan.name} was changed by someone else. Reload to see the latest.`, conflict: true }
  }
  const first = error instanceof ApiError && error.status === 400 ? Object.values(error.errors ?? {})[0]?.[0] : undefined
  return { text: first ? `${plan.name}: ${first}` : `Could not save ${plan.name}. Try again.`, conflict: false }
}

export default function PlansPage() {
  const queryClient = useQueryClient()
  const { data, isError, error, refetch } = useQuery({ queryKey: plansKey, queryFn: fetchPlans })
  const manage = usePermission('plans.manage').allowed
  const plans = data?.plans ?? NO_PLANS
  const modules = data?.modules ?? NO_MODULES
  const { drafts, changedIds, dirty, setModule, setTrialDays, discard } = usePlanDrafts(plans, modules)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [problems, setProblems] = useState<Array<{ text: string; conflict: boolean }>>([])

  const save = useMutation({
    mutationFn: saveChanged,
    onSuccess: (outcomes) => {
      const saved = outcomes.flatMap((o) => (o.saved ? [o.saved] : []))
      if (saved.length > 0) {
        // Show the saved plans at once (their version moved, so their drafts drop), then refresh the counts.
        queryClient.setQueryData<PlansResponse>(plansKey, (old) =>
          old && { ...old, plans: old.plans.map((p) => saved.find((s) => s.id === p.id) ?? p) },
        )
      }
      void queryClient.invalidateQueries({ queryKey: plansKey })
      const failed = outcomes.filter((o) => o.error)
      setProblems(failed.map(problemText))
      if (failed.length === 0) toast('Plan changes saved')
    },
  })

  const changedPlans = plans.filter((p) => changedIds.includes(p.id))
  const summaries = offSummaries(changedPlans, drafts, modules)
  const trialInvalid = changedIds.some((id) => trialError(drafts[id]))

  function runSave() {
    setProblems([])
    save.mutate(changedPlans.map((plan) => ({ plan, draft: drafts[plan.id] })))
  }

  function onSave() {
    // Switching a module off hides it for tenants that already use it: ask first.
    if (summaries.length > 0) setConfirmOpen(true)
    else runSave()
  }

  function onDiscard() {
    discard()
    setProblems([])
    toast('Changes discarded')
  }

  // A plan whose version moved on drops its own edit (see usePlanDrafts); edits on other plans stay.
  function reload() {
    setProblems([])
    void refetch()
  }

  return (
    <>
      <PageHeader
        title="Plans and modules"
        description="Switch modules on or off per plan. Tenants see only what their plan includes; the rest shows locked with an upgrade prompt."
        actions={
          <Can permission="plans.manage">
            <div className="flex gap-2">
              <Button id="pl-discard" variant="secondary" disabled={!dirty || save.isPending} onClick={onDiscard}>
                Discard
              </Button>
              <Button id="pl-save" disabled={!dirty || trialInvalid || save.isPending} onClick={onSave}>
                Save changes
              </Button>
            </div>
          </Can>
        }
      />

      {problems.length > 0 ? (
        <div role="alert" className="mb-4 rounded-md border border-line bg-red-tint p-4 text-red">
          <h2 className="mb-1">Some changes were not saved.</h2>
          <ul className="m-0 list-disc pl-5">
            {problems.map((p) => (
              <li key={p.text}>{p.text}</li>
            ))}
          </ul>
          {problems.some((p) => p.conflict) ? (
            <Button variant="secondary" className="mt-3" onClick={reload}>
              Reload plans
            </Button>
          ) : null}
        </div>
      ) : null}

      {isError && !data ? (
        <div role="alert" className="rounded-md border border-line bg-paper p-5">
          <h2 className="mb-1">Could not load plans and modules.</h2>
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
      ) : data && data.plans.length === 0 ? (
        <p className="rounded-md border border-line bg-paper px-3.5 py-8 text-center text-ink-2">{NONE_YET}</p>
      ) : (
        <PlansMatrix
          plans={data?.plans}
          modules={modules}
          drafts={drafts}
          readOnly={!manage || save.isPending}
          onModule={setModule}
          onTrialDays={setTrialDays}
        />
      )}

      <ConfirmOffDialog
        open={confirmOpen}
        summaries={summaries}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          runSave()
        }}
      />
    </>
  )
}
