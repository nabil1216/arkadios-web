// Seed and rules for the mocked GET /plans and PUT /plans/{id}. Plans, modules and the matrix are the
// demo's (MODULES, PLANS and planModules in docs/handoff/platform-console/assets/platform.js).
import { TRIAL_DAYS_RANGE, type Plan, type PlanModule, type PlansResponse, type UpdatePlanInput } from '@/features/plans/api/types'
import type { PlanId, PlanOption } from '@/features/tenants/api/types'
import { tenantRecords } from './tenants'

export const MODULES: PlanModule[] = [
  { id: 'directory', name: 'Firm and advisor directory', note: 'Firms, advisors, staff, custom fields', comingLater: false },
  { id: 'lifetime', name: 'Lifetime and service history', note: 'Notes, tasks, hand-offs', comingLater: false },
  { id: 'workstreams', name: 'Parallel department workstreams', note: 'Onboarding, service, billing in parallel', comingLater: false },
  { id: 'reports', name: 'Report builder', note: 'Ad-hoc questions over any field', comingLater: false },
  { id: 'dashboards', name: 'Personalized dashboards', note: 'Each user arranges their own', comingLater: false },
  { id: 'ai', name: 'AI next steps', note: 'Per-tenant switch and call log', comingLater: false },
  { id: 'sso', name: 'SSO and MFA', note: 'Per-tenant identity provider', comingLater: false },
  { id: 'audit', name: 'Audit log and exports', note: 'Who did what, and every export', comingLater: false },
  { id: 'integrations', name: 'Integrations', note: 'Outlook, Salesforce, Wealthbox', comingLater: false },
  { id: 'ticketing', name: 'Ticketing', note: 'Service requests and queues', comingLater: true },
  { id: 'documents', name: 'Documents and e-signature', note: 'Approvals and signing', comingLater: true },
]

interface PlanRecord {
  id: PlanId
  name: string
  blurb: string
  trialDays: number
  modules: Record<string, boolean>
  version: number
}

const matrix = (on: string[]) => Object.fromEntries(MODULES.map((m) => [m.id, on.includes(m.id)]))
const CORE = ['directory', 'lifetime']
const PROFESSIONAL = [...CORE, 'workstreams', 'reports', 'dashboards', 'ai', 'sso', 'audit']

const seed = (): PlanRecord[] => [
  { id: 'essentials', name: 'Essentials', blurb: 'Directory and service history', trialDays: 14, modules: matrix(CORE), version: 1 },
  { id: 'professional', name: 'Professional', blurb: 'Adds workflows, reports, AI', trialDays: 30, modules: matrix(PROFESSIONAL), version: 1 },
  { id: 'enterprise', name: 'Enterprise', blurb: 'Adds integrations and audit', trialDays: 30, modules: matrix([...PROFESSIONAL, 'integrations']), version: 1 },
]
let plans = seed()

/** Back to the demo's plans (tests). */
export function resetMockPlans() {
  plans = seed()
}

const toDto = (p: PlanRecord): Plan => ({
  id: p.id,
  name: p.name,
  blurb: p.blurb,
  tenantCount: tenantRecords.filter((t) => t.planId === p.id).length,
  trialDays: p.trialDays,
  modules: { ...p.modules },
  version: p.version,
})

export const listPlans = (): PlansResponse => ({ modules: MODULES, plans: plans.map(toDto) })

/** What the create-tenant form offers: the same plans, with their current trial lengths. */
export const planOptions = (): PlanOption[] =>
  plans.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb, trialDays: p.trialDays }))

export type UpdatePlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; status: 404 }
  | { ok: false; status: 400 | 409; errors: Record<string, string[]> }

const FIELDS = ['modules', 'trialDays', 'version']

/** Replaces a plan's modules and trial length. Every bad field is reported at once; 400 before 409. */
export function updatePlan(id: string, body: unknown): UpdatePlanResult {
  const plan = plans.find((p) => p.id === id)
  if (!plan) return { ok: false, status: 404 }

  const raw = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>
  const errors: Record<string, string[]> = {}
  for (const key of Object.keys(raw)) if (!FIELDS.includes(key)) errors[key] = ['Unknown field.']

  const sent = raw.modules && typeof raw.modules === 'object' && !Array.isArray(raw.modules) ? (raw.modules as Record<string, unknown>) : null
  if (!sent) errors.modules = ['Send every module as true or false.']
  else {
    for (const key of Object.keys(sent)) if (!MODULES.some((m) => m.id === key)) errors[`modules.${key}`] = ['Unknown module.']
    for (const m of MODULES) {
      const value = sent[m.id]
      if (typeof value !== 'boolean') errors[`modules.${m.id}`] = ['Send true or false.']
      else if (value && m.comingLater) errors[`modules.${m.id}`] = ['Coming later: it cannot be switched on yet.']
    }
  }

  const days = raw.trialDays
  if (typeof days !== 'number' || !Number.isInteger(days) || days < TRIAL_DAYS_RANGE.min || days > TRIAL_DAYS_RANGE.max) {
    errors.trialDays = [`Enter a number from ${TRIAL_DAYS_RANGE.min} to ${TRIAL_DAYS_RANGE.max}.`]
  }

  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version)) errors.version = ['Send the version you loaded.']

  if (Object.keys(errors).length) return { ok: false, status: 400, errors }
  if (version !== plan.version) {
    return { ok: false, status: 409, errors: { version: ['This plan was changed by someone else. Reload to see the latest.'] } }
  }

  const input = raw as unknown as UpdatePlanInput
  plan.modules = { ...input.modules }
  plan.trialDays = input.trialDays
  plan.version += 1
  return { ok: true, plan: toDto(plan) }
}
