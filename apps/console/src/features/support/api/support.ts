import { api } from '@/lib/api'
import type { ListResponse } from '@/lib/list'
import type { Handoff, SessionList, SessionListParams, StartedSession, StartInput, SupportSession, SupportTenant, SupportUser } from './types'

/** Every support query starts with this key, so a mutation can invalidate them all. */
export const supportKey = ['support'] as const
export const sessionListKey = (params: SessionListParams) => [...supportKey, 'sessions', params] as const
export const activeSessionKey = [...supportKey, 'active'] as const
export const supportTenantsKey = (q: string) => [...supportKey, 'tenants', q] as const
export const supportUsersKey = (tenantId: string, q: string) => [...supportKey, 'users', tenantId, q] as const

const query = (params: object) => {
  const out = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') out.set(key, String(value))
  return out.toString()
}

export const fetchSessions = (params: SessionListParams) => api<SessionList>(`/support-sessions?${query(params)}`)

/** The signed-in person's own open session, or null. */
export const fetchActiveSession = async () => (await api<{ session: SupportSession | null }>('/support-sessions/active')).session

export const fetchSupportTenants = (q: string) => api<ListResponse<SupportTenant>>(`/support/tenants?${query({ q, pageSize: 100 })}`)
export const fetchSupportUsers = (tenantId: string, q: string) =>
  api<ListResponse<SupportUser>>(`/tenants/${encodeURIComponent(tenantId)}/support-users?${query({ q, pageSize: 100 })}`)

/** Not idempotent: every call opens a session (one at a time per person, and ten an hour). */
export const startSession = (input: StartInput) => api<StartedSession>('/support-sessions', { method: 'POST', body: input })

export const endSession = (id: string) => api<SupportSession>(`/support-sessions/${encodeURIComponent(id)}/end`, { method: 'POST', body: {} })

/** A fresh one-time code for a session whose workspace did not open yet. Owner only, up to 3 times. */
export const reissueHandoff = (id: string) =>
  api<{ handoff: Handoff }>(`/support-sessions/${encodeURIComponent(id)}/handoff`, { method: 'POST', body: {} })
