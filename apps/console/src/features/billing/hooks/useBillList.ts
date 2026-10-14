import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { billListKey, billSummaryKey, fetchBills, fetchBillSummary } from '../api/bills'
import { parseBillListParams, toApiParams, toSearchParams, toSummaryParams, withChange, type BillListState } from './listParams'

/**
 * The Billing page: filters, sort and page live in the address bar; the server does the work. The totals
 * are a second request that follows the search and the month. Changing anything but the page starts again from page 1.
 */
export function useBillList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = parseBillListParams(searchParams)
  const apiParams = toApiParams(state)
  const summaryParams = toSummaryParams(state)

  const list = useQuery({
    queryKey: billListKey(apiParams),
    queryFn: () => fetchBills(apiParams),
    placeholderData: keepPreviousData,
  })
  const summary = useQuery({
    queryKey: billSummaryKey(summaryParams),
    queryFn: () => fetchBillSummary(summaryParams),
    placeholderData: keepPreviousData,
  })

  /** `replace` keeps typing in the search box from filling the back button. */
  function update(patch: Partial<BillListState>, options: { replace?: boolean } = {}) {
    setSearchParams(toSearchParams(withChange(state, patch)), { replace: options.replace })
  }

  // A page past the end moves to the last real page.
  const data = list.isPlaceholderData ? undefined : list.data
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && data.page > 1) {
      setSearchParams(toSearchParams({ ...state, page: Math.ceil(data.total / data.pageSize) }), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  return { state, list, summary, update }
}
