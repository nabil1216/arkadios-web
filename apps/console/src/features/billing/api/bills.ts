import { api, apiDownload } from '@/lib/api'
import type { ListResponse } from '@/lib/list'
import { saveBlob } from '@/lib/download'
import type { Bill, BillListParams, BillNotice, BillSummary, ExtendInput } from './types'

/** Every billing query starts with this key, so a mutation can invalidate them all. */
export const billsKey = ['bills'] as const
export const billListKey = (params: BillListParams) => [...billsKey, 'list', params] as const
export const billSummaryKey = (params: Pick<BillListParams, 'q' | 'month'>) => [...billsKey, 'summary', params] as const
export const billNoticeKey = (id: string) => [...billsKey, 'notice', id] as const

const query = (params: object) => {
  const out = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') out.set(key, String(value))
  return out.toString()
}

export const fetchBills = (params: BillListParams) => api<ListResponse<Bill>>(`/bills?${query(params)}`)
export const fetchBillSummary = (params: Pick<BillListParams, 'q' | 'month'>) => api<BillSummary>(`/bills/summary?${query(params)}`)
export const fetchBillNotice = (id: string) => api<BillNotice>(`/bills/${encodeURIComponent(id)}/notice`)

/** Not idempotent: every successful call moves the deadline again. */
export const extendBill = (id: string, input: ExtendInput) =>
  api<Bill>(`/bills/${encodeURIComponent(id)}/extend`, { method: 'POST', body: input })

/** Fetches the invoice with the bearer token and saves it under the name the server gave it. */
export async function downloadInvoice(bill: Pick<Bill, 'id' | 'month'>) {
  const { blob, filename } = await apiDownload(`/bills/${encodeURIComponent(bill.id)}/invoice`)
  saveBlob(blob, filename ?? `invoice-${bill.month}`)
}
