// Hand-written until packages/api-client is generated; replace then.
// Shapes follow "Plans and modules" in docs/ARCHITECTURE.md (Wire conventions).

export interface PlanModule {
  id: string
  name: string
  note: string
  /** Not available yet: shown with its switch off and disabled, and the server refuses to switch it on. */
  comingLater: boolean
}

export interface Plan {
  id: string
  name: string
  blurb: string
  /** Tenants on this plan, whatever their status. */
  tenantCount: number
  /** Days before the first bill. */
  trialDays: number
  /** Every module id in the catalog, on or off. */
  modules: Record<string, boolean>
  /** Goes back with every update; a stale one is a 409. */
  version: number
}

export interface PlansResponse {
  modules: PlanModule[]
  plans: Plan[]
}

export interface UpdatePlanInput {
  modules: Record<string, boolean>
  trialDays: number
  version: number
}

export const TRIAL_DAYS_RANGE = { min: 0, max: 90 } as const
