import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { fetchSessions, sessionListKey } from '../api/support'
import { parseSessionListParams, toApiParams, toSearchParams, withChange, type SessionListState } from './listParams'

/** The Support access page: the status filter and the page live in the address bar; the server does the work. */
export function useSessionList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = parseSessionListParams(searchParams)
  const apiParams = toApiParams(state)
  const list = useQuery({ queryKey: sessionListKey(apiParams), queryFn: () => fetchSessions(apiParams), placeholderData: keepPreviousData })

  function update(patch: Partial<SessionListState>) {
    setSearchParams(toSearchParams(withChange(state, patch)))
  }

  // A page past the end moves to the last real page.
  const data = list.isPlaceholderData ? undefined : list.data
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && data.page > 1) {
      setSearchParams(toSearchParams({ ...state, page: Math.ceil(data.total / data.pageSize) }), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return { state, list, update }
}
