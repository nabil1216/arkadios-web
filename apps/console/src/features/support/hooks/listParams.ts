import { z } from 'zod'
import { LIST_DEFAULTS } from '@/lib/list'
import { SESSION_STATUSES, type SessionListParams, type SessionStatus } from '../api/types'

/** What the page shows, as kept in the address bar: ?status=active&page=2 */
export interface SessionListState {
  status: SessionStatus | 'all'
  page: number
  pageSize: number
}

export const DEFAULT_STATE: SessionListState = { status: 'all', page: LIST_DEFAULTS.page, pageSize: LIST_DEFAULTS.pageSize }

// The address bar is user input: anything invalid falls back to its default instead of failing.
const schema = z.object({
  status: z.enum([...SESSION_STATUSES, 'all']).catch(DEFAULT_STATE.status),
  page: z.coerce.number().int().min(1).catch(DEFAULT_STATE.page),
  pageSize: z.coerce.number().int().min(1).max(LIST_DEFAULTS.maxPageSize).catch(DEFAULT_STATE.pageSize),
})

export const parseSessionListParams = (search: URLSearchParams): SessionListState => schema.parse(Object.fromEntries(search))

/** The address-bar form: only what differs from the defaults. */
export function toSearchParams(state: SessionListState): URLSearchParams {
  const out = new URLSearchParams()
  if (state.status !== DEFAULT_STATE.status) out.set('status', state.status)
  if (state.page !== DEFAULT_STATE.page) out.set('page', String(state.page))
  if (state.pageSize !== DEFAULT_STATE.pageSize) out.set('pageSize', String(state.pageSize))
  return out
}

/** The request form for GET /support-sessions. */
export const toApiParams = (state: SessionListState): SessionListParams => ({
  ...(state.status !== 'all' ? { status: state.status } : {}),
  page: state.page,
  pageSize: state.pageSize,
})

/** Changing the filter starts again from page 1. */
export const withChange = (state: SessionListState, patch: Partial<SessionListState>): SessionListState => ({ ...state, page: 1, ...patch })
