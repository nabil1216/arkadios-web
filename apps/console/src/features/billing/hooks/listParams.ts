import { z } from 'zod'
import { LIST_DEFAULTS } from '@/lib/list'
import { BILL_SORT_KEYS, BILL_STATUSES, DEFAULT_BILL_SORT, type BillListParams, type BillSortKey, type BillStatus } from '../api/types'

/** What the page shows, as kept in the address bar: ?q=north&status=overdue&month=2026-09&sort=-payable&page=2 */
export interface BillListState {
  q: string
  status: BillStatus | 'all'
  /** "2026-09", or "" for every month. */
  month: string
  sort: string
  page: number
  pageSize: number
}

export const DEFAULT_STATE: BillListState = {
  q: '',
  status: 'all',
  month: '',
  sort: DEFAULT_BILL_SORT,
  page: LIST_DEFAULTS.page,
  pageSize: LIST_DEFAULTS.pageSize,
}

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function parseSort(sort: string): { key: BillSortKey; descending: boolean } | null {
  const descending = sort.startsWith('-')
  const key = descending ? sort.slice(1) : sort
  return (BILL_SORT_KEYS as readonly string[]).includes(key) ? { key: key as BillSortKey, descending } : null
}

// The address bar is user input: anything invalid falls back to its default instead of failing.
const schema = z.object({
  q: z.string().trim().max(LIST_DEFAULTS.maxQueryLength).catch(DEFAULT_STATE.q),
  status: z.enum([...BILL_STATUSES, 'all']).catch(DEFAULT_STATE.status),
  month: z.string().regex(MONTH_PATTERN).catch(DEFAULT_STATE.month),
  sort: z.string().refine((s) => parseSort(s) !== null).catch(DEFAULT_STATE.sort),
  page: z.coerce.number().int().min(1).catch(DEFAULT_STATE.page),
  pageSize: z.coerce.number().int().min(1).max(LIST_DEFAULTS.maxPageSize).catch(DEFAULT_STATE.pageSize),
})

export function parseBillListParams(search: URLSearchParams): BillListState {
  return schema.parse(Object.fromEntries(search))
}

/** The address-bar form: only what differs from the defaults. */
export function toSearchParams(state: BillListState): URLSearchParams {
  const out = new URLSearchParams()
  if (state.q) out.set('q', state.q)
  if (state.status !== DEFAULT_STATE.status) out.set('status', state.status)
  if (state.month) out.set('month', state.month)
  if (state.sort !== DEFAULT_STATE.sort) out.set('sort', state.sort)
  if (state.page !== DEFAULT_STATE.page) out.set('page', String(state.page))
  if (state.pageSize !== DEFAULT_STATE.pageSize) out.set('pageSize', String(state.pageSize))
  return out
}

/** The request form for GET /bills. */
export function toApiParams(state: BillListState): BillListParams {
  return {
    ...(state.q ? { q: state.q } : {}),
    ...(state.status !== 'all' ? { status: state.status } : {}),
    ...(state.month ? { month: state.month } : {}),
    sort: state.sort,
    page: state.page,
    pageSize: state.pageSize,
  }
}

/** The totals follow the search and the month only: the status is what they are split by. */
export function toSummaryParams(state: BillListState): Pick<BillListParams, 'q' | 'month'> {
  return { ...(state.q ? { q: state.q } : {}), ...(state.month ? { month: state.month } : {}) }
}

/** Changing a filter, the sort or the page size starts again from page 1. */
export function withChange(state: BillListState, patch: Partial<BillListState>): BillListState {
  return { ...state, page: 1, ...patch }
}

/** The sort after clicking a column: a new column starts ascending, the same column flips direction. */
export function nextSort(current: string, key: BillSortKey): string {
  const parsed = parseSort(current)
  return parsed?.key === key && !parsed.descending ? `-${key}` : key
}

/** For aria-sort on a column header. */
export function ariaSort(current: string, key: BillSortKey): 'ascending' | 'descending' | 'none' {
  const parsed = parseSort(current)
  if (parsed?.key !== key) return 'none'
  return parsed.descending ? 'descending' : 'ascending'
}
