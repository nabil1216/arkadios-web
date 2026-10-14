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

// ---- Create tenant (docs/ARCHITECTURE.md, "Create tenant")

export interface PlanOption {
  id: PlanId
  name: string
  blurb: string
  trialDays: number
}

export interface RegionOption {
  id: string
  name: string
}

/** Everything the create form needs, in one request. */
export interface TenantOptions {
  plans: PlanOption[]
  regions: RegionOption[]
  /** Tenants live at <domain>.<baseDomain>. */
  baseDomain: string
}

export interface CreateTenantInput {
  name: string
  /** The part before the base domain. Also names the database. */
  domain: string
  planId: PlanId
  userLimit: number
  region: string
  adminEmail: string
}

/** 202 Accepted: the tenant now exists as a provisioning job under this id. */
export interface CreateTenantAccepted {
  id: string
}

export type ProvisioningStepState = 'waiting' | 'running' | 'done' | 'failed'

export interface ProvisioningStep {
  key: string
  label: string
  state: ProvisioningStepState
}

export interface ProvisioningResult {
  name: string
  /** Full workspace host, for example arkadios.platform.example. */
  domain: string
  adminEmail: string
  trialDays: number
}

export interface Provisioning {
  id: string
  status: 'running' | 'succeeded' | 'failed'
  steps: ProvisioningStep[]
  /** Only when status is succeeded. */
  result?: ProvisioningResult
}

/** Rules shared by the form and the mock server; the real server owns them. */
export const DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]{2,29}$/
export const USER_LIMIT_RANGE = { min: 1, max: 1000 } as const
export const NAME_MAX_LENGTH = 100
