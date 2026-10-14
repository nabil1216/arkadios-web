import { api } from '@/lib/api'
import type { ListResponse } from '@/lib/list'
import type {
  CreateTenantAccepted,
  CreateTenantInput,
  Provisioning,
  Tenant,
  TenantListParams,
  TenantOptions,
} from './types'

/** Every tenants query starts with this key, so a mutation can invalidate them all. */
export const tenantsKey = ['tenants'] as const
export const tenantListKey = (params: TenantListParams) => [...tenantsKey, 'list', params] as const

export const tenantOptionsKey = [...tenantsKey, 'options'] as const
export const provisioningKey = (id: string) => [...tenantsKey, 'provisioning', id] as const

export function fetchTenantOptions() {
  return api<TenantOptions>('/tenants/options')
}

/** 202 Accepted: provisioning has started under the returned id. */
export function createTenant(input: CreateTenantInput) {
  return api<CreateTenantAccepted>('/tenants', { body: input })
}

export function fetchProvisioning(id: string) {
  return api<Provisioning>(`/tenants/${encodeURIComponent(id)}/provisioning`)
}

export function fetchTenants(params: TenantListParams) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  return api<ListResponse<Tenant>>(`/tenants?${query}`)
}
