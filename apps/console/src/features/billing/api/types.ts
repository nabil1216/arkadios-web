// Hand-written until packages/api-client is generated; replace then.
// Shapes follow "Billing" in docs/ARCHITECTURE.md (Wire conventions).
import type { Money } from '@/lib/money'

export const BILL_STATUSES = ['pending', 'paid', 'overdue'] as const
export type BillStatus = (typeof BILL_STATUSES)[number]

/** Keys `sort` accepts; a leading `-` means descending. Anything else is a 400. */
export const BILL_SORT_KEYS = ['status', 'tenant', 'month', 'payable', 'deadline'] as const
export type BillSortKey = (typeof BILL_SORT_KEYS)[number]

/** Overdue first, then pending, then paid, as in the demo. */
export const DEFAULT_BILL_SORT: BillSortKey = 'status'

export const EXTEND_DAYS = [7, 14, 30] as const
export type ExtendDays = (typeof EXTEND_DAYS)[number]

export interface Bill {
  /** Opaque GUID. */
  id: string
  tenantId: string
  tenantName: string
  /** "2026-09". */
  month: string
  planId: string
  planName: string
  billedUsers: number
  unitPrice: Money
  /** billedUsers times unitPrice. The server does all the money arithmetic. */
  subtotal: Money
  tax: Money
  /** Basis points: 700 is 7%. */
  taxRateBps: number
  /** subtotal plus tax. */
  payable: Money
  /** ISO 8601 UTC date-time. */
  deadline: string
  status: BillStatus
}

export interface BillListParams {
  q?: string
  status?: BillStatus
  /** "2026-09". */
  month?: string
  sort?: string
  page?: number
  pageSize?: number
}

/** Totals for one currency; every amount is an integer in that currency's minor unit. */
export interface BillTotals {
  currency: string
  billable: number
  collected: number
  notYetPaid: number
  overdue: number
}

export interface BillSummary {
  totals: BillTotals[]
}

/** What the tenant sees at the top of its workspace. */
export interface BillNotice {
  /** Plain text. The client renders it as text, never as HTML. */
  message: string
  amountDue: Money
  paymentMethods: string[]
}

export interface ExtendInput {
  days: ExtendDays
}
