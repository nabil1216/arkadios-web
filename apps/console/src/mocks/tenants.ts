// Seed and query logic for the mocked GET /tenants. The six tenants are the demo's
// (seedBase() in docs/handoff/platform-console/assets/platform.js).
import { LIST_DEFAULTS, type ListResponse } from '@/lib/list'
import {
  DEFAULT_TENANT_SORT,
  TENANT_SORT_KEYS,
  TENANT_STATUSES,
  type PlanId,
  type Tenant,
  type TenantSortKey,
  type TenantStatus,
} from '@/features/tenants/api/types'

export const BASE_DOMAIN = 'platform.example'
export const PLAN_NAMES: Record<PlanId, string> = {
  essentials: 'Essentials',
  professional: 'Professional',
  enterprise: 'Enterprise',
}

/** What the server stores. The connection string is here to prove it never reaches a response. */
export interface TenantRecord extends Tenant {
  connectionString: string
}

const daysAgo = (days: number) => new Date(Date.now() - days * 864e5).toISOString()

export function makeTenantRecord(
  id: string,
  name: string,
  subdomain: string,
  planId: PlanId,
  usersUsed: number,
  userLimit: number,
  status: TenantStatus,
  createdDaysAgo: number,
): TenantRecord {
  const database = 'tenant_' + subdomain.replace(/-/g, '_')
  return {
    id,
    name,
    domain: `${subdomain}.${BASE_DOMAIN}`,
    database,
    planId,
    planName: PLAN_NAMES[planId],
    usersUsed,
    userLimit,
    status,
    createdAt: daysAgo(createdDaysAgo),
    connectionString: `Server=mock-sql;Database=${database};User Id=mock;Password=mock-secret;`,
  }
}

export const tenantRecords: TenantRecord[] = [
  makeTenantRecord('8f14e45f-ceea-467a-9575-7b1f2c1a0d33', 'Arkadios Home Office', 'arkadios', 'professional', 64, 100, 'active', 40),
  makeTenantRecord('c4a8d1b2-3e5f-4a60-9b7c-1d2e3f405162', 'Northwind Advisory Group', 'northwind', 'enterprise', 212, 250, 'active', 210),
  makeTenantRecord('1b9e7c3a-6d24-4f81-a05b-9c8d7e6f5a43', 'Cobalt Ridge Wealth', 'cobalt-ridge', 'professional', 47, 50, 'active', 120),
  makeTenantRecord('e2d94a07-b813-4c56-8f10-3a7b6c5d4e21', 'Marlow & Finch Partners', 'marlow-finch', 'essentials', 18, 25, 'trial', 6),
  makeTenantRecord('5a3f0c9e-7b12-4d8a-b6e4-2f1c0d9e8a77', 'Sterling Hollow Family Office', 'sterling-hollow', 'professional', 31, 40, 'suspended', 300),
  makeTenantRecord('a7c61d34-92e8-4b0f-8d53-6e4f3a2b1c09', 'Quillon Trust Company', 'quillon', 'enterprise', 140, 200, 'active', 75),
]

/** The response shape, picked field by field so nothing else can leak. */
export function toDto(r: TenantRecord): Tenant {
  return {
    id: r.id,
    name: r.name,
    domain: r.domain,
    database: r.database,
    planId: r.planId,
    planName: r.planName,
    usersUsed: r.usersUsed,
    userLimit: r.userLimit,
    status: r.status,
    createdAt: r.createdAt,
  }
}

const text = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })

const comparators: Record<TenantSortKey, (a: TenantRecord, b: TenantRecord) => number> = {
  name: (a, b) => text(a.name, b.name),
  plan: (a, b) => text(a.planName, b.planName),
  usersUsed: (a, b) => a.usersUsed - b.usersUsed,
  status: (a, b) => text(a.status, b.status),
  createdAt: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
}

export type TenantQueryResult =
  | { ok: true; body: ListResponse<Tenant> }
  | { ok: false; errors: Record<string, string[]> }

const INTEGER = /^\d+$/

/** Filters, sorts and pages the seed from the query string, like the real endpoint. */
export function queryTenants(query: URLSearchParams): TenantQueryResult {
  const errors: Record<string, string[]> = {}

  const q = (query.get('q') ?? '').trim()
  if (q.length > LIST_DEFAULTS.maxQueryLength) {
    errors.q = [`Search must be ${LIST_DEFAULTS.maxQueryLength} characters or fewer.`]
  }

  const status = query.get('status') || undefined
  if (status && !(TENANT_STATUSES as readonly string[]).includes(status)) {
    errors.status = [`Status must be one of: ${TENANT_STATUSES.join(', ')}.`]
  }

  const sortParam = query.get('sort') || DEFAULT_TENANT_SORT
  const descending = sortParam.startsWith('-')
  const sortKey = descending ? sortParam.slice(1) : sortParam
  if (!(TENANT_SORT_KEYS as readonly string[]).includes(sortKey)) {
    errors.sort = [`Sort must be one of: ${TENANT_SORT_KEYS.join(', ')} (prefix with - for descending).`]
  }

  const pageParam = query.get('page')
  const page = pageParam === null ? LIST_DEFAULTS.page : INTEGER.test(pageParam) ? Number(pageParam) : 0
  if (page < 1) errors.page = ['Page must be a whole number, 1 or more.']

  const sizeParam = query.get('pageSize')
  const pageSize = sizeParam === null ? LIST_DEFAULTS.pageSize : INTEGER.test(sizeParam) ? Number(sizeParam) : 0
  if (pageSize < 1 || pageSize > LIST_DEFAULTS.maxPageSize) {
    errors.pageSize = [`Page size must be a whole number from 1 to ${LIST_DEFAULTS.maxPageSize}.`]
  }

  if (Object.keys(errors).length) return { ok: false, errors }

  // `q` is plain text: "%" and "_" mean themselves here, as they must in the real parameterized LIKE.
  const needle = q.toLowerCase()
  const compare = comparators[sortKey as TenantSortKey]
  const matches = tenantRecords
    .filter((t) => !status || t.status === status)
    .filter((t) => !needle || `${t.name} ${t.domain} ${t.database}`.toLowerCase().includes(needle))
    // Direction applies to the chosen key only; ties always fall back to name, then id, ascending.
    .sort((a, b) => (descending ? -compare(a, b) : compare(a, b)) || text(a.name, b.name) || a.id.localeCompare(b.id))

  const start = (page - 1) * pageSize
  return {
    ok: true,
    body: { items: matches.slice(start, start + pageSize).map(toDto), total: matches.length, page, pageSize },
  }
}
