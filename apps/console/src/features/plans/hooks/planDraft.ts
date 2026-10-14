import { z } from 'zod'
import { TRIAL_DAYS_RANGE, type Plan, type PlanModule, type UpdatePlanInput } from '../api/types'

/** What the person has typed for one plan. The trial length stays text while they type. */
export interface PlanDraft {
  modules: Record<string, boolean>
  trialDays: string
}

export const TRIAL_MESSAGE = `Enter a number from ${TRIAL_DAYS_RANGE.min} to ${TRIAL_DAYS_RANGE.max}.`

const trialSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}$/, TRIAL_MESSAGE)
  .transform(Number)
  .pipe(z.number().min(TRIAL_DAYS_RANGE.min, TRIAL_MESSAGE).max(TRIAL_DAYS_RANGE.max, TRIAL_MESSAGE))

/** The trial length as a number, or null when the text is not a whole number from 0 to 90. */
export function parseTrialDays(text: string): number | null {
  const result = trialSchema.safeParse(text)
  return result.success ? result.data : null
}

export const trialError = (draft: PlanDraft): string | undefined =>
  parseTrialDays(draft.trialDays) === null ? TRIAL_MESSAGE : undefined

export const savedDraft = (plan: Plan): PlanDraft => ({ modules: { ...plan.modules }, trialDays: String(plan.trialDays) })

/** True when the draft differs from what the server has. An unreadable trial length counts as a change. */
export function isChanged(plan: Plan, draft: PlanDraft, catalog: PlanModule[]): boolean {
  if (catalog.some((m) => draft.modules[m.id] !== plan.modules[m.id])) return true
  // An unreadable trial length is null, which never equals the saved number: it counts as a change.
  return parseTrialDays(draft.trialDays) !== plan.trialDays
}

/** Modules that are on now and would be off after saving. Switching on never counts. */
export function switchedOff(plan: Plan, draft: PlanDraft, catalog: PlanModule[]): PlanModule[] {
  return catalog.filter((m) => plan.modules[m.id] && !draft.modules[m.id])
}

export interface OffSummary {
  plan: Plan
  modules: PlanModule[]
}

/** The plans that need a confirmation before saving: modules going off on a plan that has tenants. */
export function offSummaries(plans: Plan[], drafts: Record<string, PlanDraft>, catalog: PlanModule[]): OffSummary[] {
  return plans
    .filter((plan) => plan.tenantCount > 0 && drafts[plan.id])
    .map((plan) => ({ plan, modules: switchedOff(plan, drafts[plan.id], catalog) }))
    .filter((entry) => entry.modules.length > 0)
}

/** The PUT body for one plan. Only call it when the trial length is valid. */
export function toUpdate(plan: Plan, draft: PlanDraft): UpdatePlanInput {
  return { modules: { ...draft.modules }, trialDays: parseTrialDays(draft.trialDays) ?? plan.trialDays, version: plan.version }
}
