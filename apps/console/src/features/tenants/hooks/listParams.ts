import { z } from 'zod'
import { LIST_DEFAULTS } from '@/lib/list'
import {
  DEFAULT_TENANT_SORT,
  TENANT_SORT_KEYS,
  TENANT_STATUSES,
  type TenantListParams,
  type TenantSortKey,
  type TenantStatus,
} from '../api/types'

/** What the page shows, as kept in the address bar: ?q=north&status=trial&sort=-usersUsed&page=2&pageSize=10 */
export interface TenantListState {
  q: string
  status: TenantStatus | 'all'
  sort: string
  page: number
  pageSize: number
}

export const DEFAULT_STATE: TenantListState = {
  q: '',
  status: 'all',
  sort: DEFAULT_TENANT_SORT,
  page: LIST_DEFAULTS.page,
  pageSize: LIST_DEFAULTS.pageSize,
}

export function parseSort(sort: string): { key: TenantSortKey; descending: boolean } | null {
  const descending = sort.startsWith('-')
  const key = descending ? sort.slice(1) : sort
  return (TENANT_SORT_KEYS as readonly string[]).includes(key) ? { key: key as TenantSortKey, descending } : null
}

// The address bar is user input: anything invalid falls back to its default instead of failing.
const schema = z.object({
  q: z.string().trim().max(LIST_DEFAULTS.maxQueryLength).catch(DEFAULT_STATE.q),
  status: z.enum([...TENANT_STATUSES, 'all']).catch(DEFAULT_STATE.status),
  sort: z.string().refine((s) => parseSort(s) !== null).catch(DEFAULT_STATE.sort),
  page: z.coerce.number().int().min(1).catch(DEFAULT_STATE.page),
  pageSize: z.coerce.number().int().min(1).max(LIST_DEFAULTS.maxPageSize).catch(DEFAULT_STATE.pageSize),
})

export function parseTenantListParams(search: URLSearchParams): TenantListState {
  return schema.parse(Object.fromEntries(search))
}

/** The address-bar form: only what differs from the defaults, so the plain page has a plain URL. */
export function toSearchParams(state: TenantListState): URLSearchParams {
  const out = new URLSearchParams()
  if (state.q) out.set('q', state.q)
  if (state.status !== DEFAULT_STATE.status) out.set('status', state.status)
  if (state.sort !== DEFAULT_STATE.sort) out.set('sort', state.sort)
  if (state.page !== DEFAULT_STATE.page) out.set('page', String(state.page))
  if (state.pageSize !== DEFAULT_STATE.pageSize) out.set('pageSize', String(state.pageSize))
  return out
}

/** The request form for GET /tenants. */
export function toApiParams(state: TenantListState): TenantListParams {
  return {
    ...(state.q ? { q: state.q } : {}),
    ...(state.status !== 'all' ? { status: state.status } : {}),
    sort: state.sort,
    page: state.page,
    pageSize: state.pageSize,
  }
}

/** Changing a filter, the sort or the page size starts again from page 1. */
export function withChange(state: TenantListState, patch: Partial<TenantListState>): TenantListState {
  return { ...state, page: 1, ...patch }
}

/** The sort after clicking a column: a new column starts ascending, the same column flips direction. */
export function nextSort(current: string, key: TenantSortKey): string {
  const parsed = parseSort(current)
  return parsed?.key === key && !parsed.descending ? `-${key}` : key
}

/** For aria-sort on a column header. */
export function ariaSort(current: string, key: TenantSortKey): 'ascending' | 'descending' | 'none' {
  const parsed = parseSort(current)
  if (parsed?.key !== key) return 'none'
  return parsed.descending ? 'descending' : 'ascending'
}
