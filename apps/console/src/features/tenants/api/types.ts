// Hand-written until packages/api-client is generated; replace then.
// Shapes follow "Tenants list" in docs/ARCHITECTURE.md (Wire conventions).

export const TENANT_STATUSES = ['active', 'trial', 'suspended', 'offboarding'] as const
export type TenantStatus = (typeof TENANT_STATUSES)[number]

export const PLAN_IDS = ['essentials', 'professional', 'enterprise'] as const
export type PlanId = (typeof PLAN_IDS)[number]

/** Keys `sort` accepts; a leading `-` means descending. Anything else is a 400. */
export const TENANT_SORT_KEYS = ['name', 'plan', 'usersUsed', 'status', 'createdAt'] as const
export type TenantSortKey = (typeof TENANT_SORT_KEYS)[number]

export const DEFAULT_TENANT_SORT: TenantSortKey = 'name'

export interface Tenant {
  /** Opaque GUID. Never a sequence number. */
  id: string
  name: string
  domain: string
  /** Database name only; connection strings never leave the server. */
  database: string
  planId: PlanId
  planName: string
  usersUsed: number
  userLimit: number
  status: TenantStatus
  /** ISO 8601, UTC. */
  createdAt: string
}

export interface TenantListParams {
  q?: string
  status?: TenantStatus
  /** `name`, `-name`, `usersUsed`, ... */
  sort?: string
  page?: number
  pageSize?: number
}
