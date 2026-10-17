import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLatestSearchParams } from '@/lib/useLatestSearchParams'
import { fetchTenants, tenantListKey } from '../api/tenants'
import {
  parseTenantListParams,
  toApiParams,
  toSearchParams,
  withChange,
  type TenantListState,
} from './listParams'

/**
 * The Tenants list: filters, sort and page live in the address bar; the server does the work.
 * Changing anything but the page starts again from page 1.
 */
export function useTenantList() {
  const { searchParams, commit } = useLatestSearchParams()
  const state = parseTenantListParams(searchParams)
  const apiParams = toApiParams(state)

  const query = useQuery({
    queryKey: tenantListKey(apiParams),
    queryFn: () => fetchTenants(apiParams),
    placeholderData: keepPreviousData,
  })

  /**
   * `replace` keeps typing in the search box from filling the back button. The change is merged into the newest address, not
   * into the one this render saw, so a search that waited cannot undo a filter changed since.
   */
  function update(patch: Partial<TenantListState>, options: { replace?: boolean } = {}) {
    commit((latest) => toSearchParams(withChange(parseTenantListParams(latest), patch)), { replace: options.replace })
  }

  // A page past the end (a stale link, or rows deleted meanwhile) moves to the last real page.
  const data = query.isPlaceholderData ? undefined : query.data
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && data.page > 1) {
      const last = Math.ceil(data.total / data.pageSize)
      commit((latest) => toSearchParams({ ...parseTenantListParams(latest), page: last }), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return { state, query, update }
}
