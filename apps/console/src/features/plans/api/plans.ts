import { api } from '@/lib/api'
import type { Plan, PlansResponse, UpdatePlanInput } from './types'

/** Every plans query starts with this key, so a mutation can invalidate them all. */
export const plansKey = ['plans'] as const

export function fetchPlans() {
  return api<PlansResponse>('/plans')
}

/** Replaces the plan's modules and trial length. A stale `version` is a 409. */
export function updatePlan(id: string, input: UpdatePlanInput) {
  return api<Plan>(`/plans/${encodeURIComponent(id)}`, { method: 'PUT', body: input })
}
