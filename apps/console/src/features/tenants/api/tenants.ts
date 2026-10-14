import { api } from '@/lib/api'
import type { ListResponse } from '@/lib/list'
import type { Tenant, TenantListParams } from './types'

/** Every tenants query starts with this key, so a mutation can invalidate them all. */
export const tenantsKey = ['tenants'] as const
export const tenantListKey = (params: TenantListParams) => [...tenantsKey, 'list', params] as const

export function fetchTenants(params: TenantListParams) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  return api<ListResponse<Tenant>>(`/tenants?${query}`)
}
