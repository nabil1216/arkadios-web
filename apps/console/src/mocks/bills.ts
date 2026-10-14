// Seed and rules for the mocked billing endpoints. Ten bills for the five non-trial tenants, as in the
// demo's seedBase(): last month paid (Sterling Hollow still owes it), this month pending.
// Money is integer minor units all the way; nothing here multiplies by a float.
import { LIST_DEFAULTS, type ListResponse } from '@/lib/list'
import type { Money } from '@/lib/money'
import {
  BILL_SORT_KEYS,
  BILL_STATUSES,
  DEFAULT_BILL_SORT,
  EXTEND_DAYS,
  type Bill,
  type BillNotice,
  type BillSortKey,
  type BillSummary,
  type BillStatus,
} from '@/features/billing/api/types'
import { planOptions } from './plans'
import { tenantRecords } from './tenants'

const CURRENCY = 'USD'
const TAX_RATE_BPS = 700
/** Price per billed user per month, in cents (the demo's $18, $26 and $34). */
const UNIT_PRICE_MINOR: Record<string, number> = { essentials: 1800, professional: 2600, enterprise: 3400 }
const DAY = 864e5

interface BillRecord {
  id: string
  tenantId: string
  month: string
  planId: string
  billedUsers: number
  unitPriceMinor: number
  deadlineMs: number
  paid: boolean
}

/** Tax in minor units: subtotal times the rate in basis points, rounded half up. Integers only. */
export const taxOf = (subtotalMinor: number, rateBps: number) => Math.floor((subtotalMinor * rateBps + 5000) / 10000)

const monthKey = (offset: number, now = Date.now()) => {
  const d = new Date(now)
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + offset
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

// Fixed ids, so a bill keeps its id across page loads.
const IDS = [
  '3d6f0a21-5c4e-4b7a-9e12-7a8b9c0d1e01', '6a1c2b3d-8e4f-4a50-8b61-0f9e8d7c6b02', '9b2e4d6f-1a3c-4d85-a7c9-2b4d6f8a0c03',
  'c7d8e9f0-2b3a-4c14-b5d6-e7f8091a2b04', '1f2e3d4c-5b6a-4798-8a0b-1c2d3e4f5a05', 'a4b5c6d7-e8f9-4a0b-9c1d-2e3f40516206',
  '58a9b0c1-d2e3-4f45-8678-9a0b1c2d3e07', 'e0f1a2b3-c4d5-4e66-a788-99aabbccdd08', '72839405-a6b7-4c8d-8e9f-a0b1c2d3e409',
  'd5e6f708-192a-4b3c-9d4e-5f60718293a0',
]

function seed(now = Date.now()): BillRecord[] {
  const billed = tenantRecords.filter((t) => t.status !== 'trial')
  return billed.flatMap((t, i) => [
    {
      id: IDS[i * 2],
      tenantId: t.id,
      month: monthKey(-1, now),
      planId: t.planId,
      billedUsers: t.usersUsed,
      unitPriceMinor: UNIT_PRICE_MINOR[t.planId],
      deadlineMs: now - 8 * DAY,
      paid: t.status !== 'suspended', // Sterling Hollow is suspended for this overdue bill
    },
    {
      id: IDS[i * 2 + 1],
      tenantId: t.id,
      month: monthKey(0, now),
      planId: t.planId,
      billedUsers: t.usersUsed,
      unitPriceMinor: UNIT_PRICE_MINOR[t.planId],
      deadlineMs: now + 24 * DAY,
      paid: false,
    },
  ])
}

let records = seed()

/** Back to the demo's ten bills (tests). */
export function resetMockBills(now = Date.now()) {
  records = seed(now)
}

const money = (amountMinor: number): Money => ({ amountMinor, currency: CURRENCY })

function statusOf(r: BillRecord, now: number): BillStatus {
  return r.paid ? 'paid' : r.deadlineMs < now ? 'overdue' : 'pending'
}

function toDto(r: BillRecord, now = Date.now()): Bill {
  const subtotal = r.billedUsers * r.unitPriceMinor
  const tax = taxOf(subtotal, TAX_RATE_BPS)
  return {
    id: r.id,
    tenantId: r.tenantId,
    tenantName: tenantRecords.find((t) => t.id === r.tenantId)?.name ?? 'Unknown tenant',
    month: r.month,
    planId: r.planId,
    planName: planOptions().find((p) => p.id === r.planId)?.name ?? r.planId,
    billedUsers: r.billedUsers,
    unitPrice: money(r.unitPriceMinor),
    subtotal: money(subtotal),
    tax: money(tax),
    taxRateBps: TAX_RATE_BPS,
    payable: money(subtotal + tax),
    deadline: new Date(r.deadlineMs).toISOString(),
    status: statusOf(r, now),
  }
}

const text = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })
const RANK: Record<BillStatus, number> = { overdue: 0, pending: 1, paid: 2 }

const comparators: Record<BillSortKey, (a: Bill, b: Bill) => number> = {
  status: (a, b) => RANK[a.status] - RANK[b.status],
  tenant: (a, b) => text(a.tenantName, b.tenantName),
  month: (a, b) => a.month.localeCompare(b.month),
  payable: (a, b) => a.payable.amountMinor - b.payable.amountMinor,
  deadline: (a, b) => Date.parse(a.deadline) - Date.parse(b.deadline),
}

const INTEGER = /^\d+$/
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

type Errors = Record<string, string[]>
export type QueryResult<T> = { ok: true; body: T } | { ok: false; errors: Errors }

/** q and month, the filters the list and the totals share. */
function readScope(query: URLSearchParams, errors: Errors) {
  const q = (query.get('q') ?? '').trim()
  if (q.length > LIST_DEFAULTS.maxQueryLength) errors.q = [`Search must be ${LIST_DEFAULTS.maxQueryLength} characters or fewer.`]
  const month = query.get('month') || undefined
  if (month && !MONTH.test(month)) errors.month = ['Month must look like 2026-09.']
  return { q: q.toLowerCase(), month }
}

const inScope = (b: Bill, scope: { q: string; month?: string }) =>
  (!scope.month || b.month === scope.month) && (!scope.q || b.tenantName.toLowerCase().includes(scope.q))

/** Filters, sorts and pages the bills from the query string, like the real endpoint. */
export function queryBills(query: URLSearchParams, now = Date.now()): QueryResult<ListResponse<Bill>> {
  const errors: Errors = {}
  const scope = readScope(query, errors)

  const status = query.get('status') || undefined
  if (status && !(BILL_STATUSES as readonly string[]).includes(status)) {
    errors.status = [`Status must be one of: ${BILL_STATUSES.join(', ')}.`]
  }

  const sortParam = query.get('sort') || DEFAULT_BILL_SORT
  const descending = sortParam.startsWith('-')
  const sortKey = descending ? sortParam.slice(1) : sortParam
  if (!(BILL_SORT_KEYS as readonly string[]).includes(sortKey)) {
    errors.sort = [`Sort must be one of: ${BILL_SORT_KEYS.join(', ')} (prefix with - for descending).`]
  }

  const pageParam = query.get('page')
  const page = pageParam === null ? LIST_DEFAULTS.page : INTEGER.test(pageParam) ? Number(pageParam) : 0
  if (page < 1) errors.page = ['Page must be a whole number, 1 or more.']
  const sizeParam = query.get('pageSize')
  const pageSize = sizeParam === null ? LIST_DEFAULTS.pageSize : INTEGER.test(sizeParam) ? Number(sizeParam) : 0
  if (pageSize < 1 || pageSize > LIST_DEFAULTS.maxPageSize) {
    errors.pageSize = [`Page size must be a whole number from 1 to ${LIST_DEFAULTS.maxPageSize}.`]
  }

  if (Object.keys(errors).length) return { ok: false, errors }

  const compare = comparators[sortKey as BillSortKey]
  const matches = records
    .map((r) => toDto(r, now))
    .filter((b) => inScope(b, scope) && (!status || b.status === status))
    // Direction applies to the chosen key only; ties fall back to tenant name, month, then id, ascending.
    .sort((a, b) => (descending ? -compare(a, b) : compare(a, b)) || text(a.tenantName, b.tenantName) || a.month.localeCompare(b.month) || a.id.localeCompare(b.id))

  const start = (page - 1) * pageSize
  return { ok: true, body: { items: matches.slice(start, start + pageSize), total: matches.length, page, pageSize } }
}

/** Totals per currency for the bills in scope (q and month; status is not a filter here). */
export function summarizeBills(query: URLSearchParams, now = Date.now()): QueryResult<BillSummary> {
  const errors: Errors = {}
  const scope = readScope(query, errors)
  if (Object.keys(errors).length) return { ok: false, errors }

  const byCurrency = new Map<string, BillSummary['totals'][number]>()
  for (const bill of records.map((r) => toDto(r, now)).filter((b) => inScope(b, scope))) {
    const { currency, amountMinor } = bill.payable
    const t = byCurrency.get(currency) ?? { currency, billable: 0, collected: 0, notYetPaid: 0, overdue: 0 }
    t.billable += amountMinor
    if (bill.status === 'paid') t.collected += amountMinor
    else if (bill.status === 'pending') t.notYetPaid += amountMinor
    else t.overdue += amountMinor
    byCurrency.set(currency, t)
  }
  return { ok: true, body: { totals: [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency)) } }
}

const find = (id: string) => records.find((r) => r.id === id)

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const fmtMonth = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const fmtMoney = (m: Money) => (m.amountMinor / 100).toLocaleString('en-US', { style: 'currency', currency: m.currency })

export type NoticeResult = { ok: true; notice: BillNotice } | { ok: false; status: 404 | 409 }

/** The notice the tenant sees, written by the server so the preview is exactly what the tenant gets. */
export function noticeOf(id: string, now = Date.now()): NoticeResult {
  const r = find(id)
  if (!r) return { ok: false, status: 404 }
  if (statusOf(r, now) === 'paid') return { ok: false, status: 409 }
  const bill = toDto(r, now)
  return {
    ok: true,
    notice: {
      message: `Your bill for ${fmtMonth(r.month)} is ready. Pay your bill before ${fmtDate(r.deadlineMs)}.`,
      amountDue: bill.payable,
      paymentMethods: ['stripe', 'paypal'],
    },
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export type InvoiceResult = { ok: true; filename: string; html: string } | { ok: false; status: 404 | 409 }

/** The demo's sample invoice. The file name is built here from the bill id and month, never from input. */
export function invoiceOf(id: string, now = Date.now()): InvoiceResult {
  const r = find(id)
  if (!r) return { ok: false, status: 404 }
  if (statusOf(r, now) !== 'paid') return { ok: false, status: 409 }
  const b = toDto(r, now)
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${escapeHtml(b.id)}</title>` +
    '<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;color:#1b2a3a}table{width:100%;border-collapse:collapse}td,th{padding:8px 0;border-bottom:1px solid #d9dfe4;text-align:left}td:last-child,th:last-child{text-align:right}</style></head><body>' +
    `<h1>Invoice</h1><p>${escapeHtml(b.tenantName)}<br>${escapeHtml(fmtMonth(b.month))} subscription, ${escapeHtml(b.planName)} plan</p>` +
    `<table><tr><th>Item</th><th>Amount</th></tr><tr><td>${b.billedUsers} billed users at ${fmtMoney(b.unitPrice)}</td><td>${fmtMoney(b.subtotal)}</td></tr>` +
    `<tr><td>Tax</td><td>${fmtMoney(b.tax)}</td></tr><tr><th>Payable</th><th>${fmtMoney(b.payable)}</th></tr></table>` +
    `<p>Status: ${b.status}. Deadline: ${fmtDate(r.deadlineMs)}.</p><p style="color:#556270">Sample invoice from the platform console demo.</p></body></html>`
  return { ok: true, filename: `invoice-${r.month}-${r.id}.html`, html }
}

export type ExtendResult =
  | { ok: true; bill: Bill }
  | { ok: false; status: 404 }
  | { ok: false; status: 400; errors: Errors }
  | { ok: false; status: 409 }

/**
 * Pushes the deadline back: the later of now and the current deadline, plus 7, 14 or 30 days. An overdue
 * bill becomes pending again. Paid bills cannot be extended. Not idempotent: every call extends again.
 */
export function extendBill(id: string, body: unknown, now = Date.now()): ExtendResult {
  const r = find(id)
  if (!r) return { ok: false, status: 404 }

  const raw = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>
  const errors: Errors = {}
  for (const key of Object.keys(raw)) if (key !== 'days') errors[key] = ['Unknown field.']
  if (!(EXTEND_DAYS as readonly unknown[]).includes(raw.days)) errors.days = [`Choose ${EXTEND_DAYS.slice(0, -1).join(', ')} or ${EXTEND_DAYS.at(-1)} days.`]
  if (Object.keys(errors).length) return { ok: false, status: 400, errors }

  if (r.paid) return { ok: false, status: 409 }
  r.deadlineMs = Math.max(now, r.deadlineMs) + (raw.days as number) * DAY
  return { ok: true, bill: toDto(r, now) }
}
