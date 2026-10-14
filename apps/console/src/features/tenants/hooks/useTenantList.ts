import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const state = parseTenantListParams(searchParams)
  const apiParams = toApiParams(state)

  const query = useQuery({
    queryKey: tenantListKey(apiParams),
    queryFn: () => fetchTenants(apiParams),
    placeholderData: keepPreviousData,
  })

  /** `replace` keeps typing in the search box from filling the back button. */
  function update(patch: Partial<TenantListState>, options: { replace?: boolean } = {}) {
    setSearchParams(toSearchParams(withChange(state, patch)), { replace: options.replace })
  }

  // A page past the end (a stale link, or rows deleted meanwhile) moves to the last real page.
  const data = query.isPlaceholderData ? undefined : query.data
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && data.page > 1) {
      const last = Math.ceil(data.total / data.pageSize)
      setSearchParams(toSearchParams({ ...state, page: last }), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return { state, query, update }
}
