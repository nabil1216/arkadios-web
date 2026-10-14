import { useState } from 'react'
import type { Plan, PlanModule } from '../api/types'
import { isChanged, savedDraft, type PlanDraft } from './planDraft'

interface Edit extends PlanDraft {
  /** The plan version the edit started from. */
  version: number
}

/**
 * The edits on the Plans page, one per plan. An edit belongs to the version it started from: when the
 * server's version moves on (a save, or someone else's change) the edit simply stops applying, so the
 * page never shows a draft on top of a plan it was not made from.
 */
export function usePlanDrafts(plans: Plan[], catalog: PlanModule[]) {
  const [edits, setEdits] = useState<Record<string, Edit>>({})

  const drafts: Record<string, PlanDraft> = {}
  for (const plan of plans) {
    const edit = edits[plan.id]
    drafts[plan.id] = edit && edit.version === plan.version ? edit : savedDraft(plan)
  }
  const changedIds = plans.filter((p) => isChanged(p, drafts[p.id], catalog)).map((p) => p.id)

  function edit(planId: string, change: (draft: PlanDraft) => PlanDraft) {
    const plan = plans.find((p) => p.id === planId)
    if (!plan) return
    const next = change(drafts[planId])
    setEdits((current) => ({ ...current, [planId]: { ...next, version: plan.version } }))
  }

  return {
    drafts,
    changedIds,
    dirty: changedIds.length > 0,
    setModule: (planId: string, moduleId: string, on: boolean) =>
      edit(planId, (d) => ({ ...d, modules: { ...d.modules, [moduleId]: on } })),
    setTrialDays: (planId: string, text: string) => edit(planId, (d) => ({ ...d, trialDays: text })),
    /** Drop the edits for these plans, or for all of them. */
    discard: (planIds?: string[]) =>
      setEdits((current) => (planIds ? Object.fromEntries(Object.entries(current).filter(([id]) => !planIds.includes(id))) : {})),
  }
}
