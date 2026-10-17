import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLatestSearchParams } from '@/lib/useLatestSearchParams'
import { fetchSessions, sessionListKey } from '../api/support'
import { parseSessionListParams, toApiParams, toSearchParams, withChange, type SessionListState } from './listParams'

/** The Support access page: the status filter and the page live in the address bar; the server does the work. */
export function useSessionList() {
  const { searchParams, commit } = useLatestSearchParams()
  const state = parseSessionListParams(searchParams)
  const apiParams = toApiParams(state)
  const list = useQuery({ queryKey: sessionListKey(apiParams), queryFn: () => fetchSessions(apiParams), placeholderData: keepPreviousData })

  /** The change is merged into the newest address, not into the one this render saw. */
  function update(patch: Partial<SessionListState>) {
    commit((latest) => toSearchParams(withChange(parseSessionListParams(latest), patch)))
  }

  // A page past the end moves to the last real page.
  const data = list.isPlaceholderData ? undefined : list.data
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && data.page > 1) {
      commit((latest) => toSearchParams({ ...parseSessionListParams(latest), page: Math.ceil(data.total / data.pageSize) }), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return { state, list, update }
}
