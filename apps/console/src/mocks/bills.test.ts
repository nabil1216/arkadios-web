import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Bill } from '@/features/billing/api/types'
import { extendBill, invoiceOf, noticeOf, queryBills, resetMockBills, summarizeBills, taxOf } from './bills'

const NOW = Date.UTC(2026, 9, 14, 9, 0, 0) // 14 Oct 2026, so last month is 2026-09
const DAY = 864e5

const list = (params: Record<string, string> = {}, now = NOW) => {
  const result = queryBills(new URLSearchParams(params), now)
  if (!result.ok) throw new Error('unexpected errors: ' + JSON.stringify(result.errors))
  return result.body
}
const errorsFor = (params: Record<string, string>) => {
  const result = queryBills(new URLSearchParams(params), NOW)
  if (result.ok) throw new Error('expected errors')
  return result.errors
}
const summary = (params: Record<string, string> = {}, now = NOW) => {
  const result = summarizeBills(new URLSearchParams(params), now)
  if (!result.ok) throw new Error('unexpected errors: ' + JSON.stringify(result.errors))
  return result.body.totals
}
const all = () => list({ pageSize: '100' }).items
const find = (tenant: string, month: string) => all().find((b) => b.tenantName.startsWith(tenant) && b.month === month)!
const label = (b: Bill) => `${b.tenantName.split(' ')[0]} ${b.month.slice(5)} ${b.status}`

beforeEach(() => resetMockBills(NOW))
afterEach(() => resetMockBills())

describe('taxOf: integer minor units, rounded half up', () => {
  it.each([
    [0, 0],
    [1, 0],
    [7, 0], // 0.49
    [8, 1], // 0.56
    [50, 4], // 3.5 rounds up
    [150, 11], // 10.5 rounds up
    [166400, 11648],
    [120000, 8400],
    [999999, 70000], // 69999.93
  ])('7%% of %d is %d', (subtotal, tax) => {
    expect(taxOf(subtotal, 700)).toBe(tax)
  })

  it('always returns a whole number', () => {
    for (const subtotal of [1, 3, 17, 333, 12345, 987654]) expect(Number.isInteger(taxOf(subtotal, 700))).toBe(true)
  })
})

describe('seed (the demo)', () => {
  it('has ten bills: five tenants, last month and this month', () => {
    const items = all()
    expect(items).toHaveLength(10)
    expect(new Set(items.map((b) => b.month))).toEqual(new Set(['2026-09', '2026-10']))
    expect(new Set(items.map((b) => b.tenantName)).size).toBe(5)
    expect(items.some((b) => b.tenantName.startsWith('Marlow'))).toBe(false) // the trial tenant is not billed
  })

  it('has opaque GUID ids', () => {
    for (const b of all()) expect(b.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(new Set(all().map((b) => b.id)).size).toBe(10)
  })

  it('leaves only Sterling Hollow last month unpaid, and so overdue', () => {
    expect(all().filter((b) => b.status === 'overdue').map(label)).toEqual(['Sterling 09 overdue'])
    expect(all().filter((b) => b.status === 'pending')).toHaveLength(5)
    expect(all().filter((b) => b.status === 'paid')).toHaveLength(4)
    expect(find('Sterling', '2026-10').status).toBe('pending')
  })

  it('computes each bill with integer arithmetic: users times price, 7% tax, payable', () => {
    const b = find('Arkadios', '2026-10')
    expect(b).toMatchObject({
      billedUsers: 64,
      planId: 'professional',
      planName: 'Professional',
      taxRateBps: 700,
      unitPrice: { amountMinor: 2600, currency: 'USD' },
      subtotal: { amountMinor: 166400, currency: 'USD' },
      tax: { amountMinor: 11648, currency: 'USD' },
      payable: { amountMinor: 178048, currency: 'USD' },
    })
    for (const bill of all()) {
      expect(bill.subtotal.amountMinor).toBe(bill.billedUsers * bill.unitPrice.amountMinor)
      expect(bill.payable.amountMinor).toBe(bill.subtotal.amountMinor + bill.tax.amountMinor)
    }
  })

  it('never puts a float in a money field', () => {
    for (const bill of all()) {
      for (const m of [bill.unitPrice, bill.subtotal, bill.tax, bill.payable]) {
        expect(Number.isInteger(m.amountMinor)).toBe(true)
        expect(m.currency).toBe('USD')
      }
      expect(Number.isInteger(bill.taxRateBps)).toBe(true)
    }
  })

  it('has deadlines as ISO 8601 UTC date-times: last month 8 days ago, this month in 24 days', () => {
    expect(find('Arkadios', '2026-09').deadline).toBe(new Date(NOW - 8 * DAY).toISOString())
    expect(find('Arkadios', '2026-10').deadline).toBe(new Date(NOW + 24 * DAY).toISOString())
    expect(find('Arkadios', '2026-10').deadline).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})

describe('list', () => {
  it('returns the envelope with the defaults', () => {
    expect(list()).toMatchObject({ total: 10, page: 1, pageSize: 25 })
  })

  it('puts overdue first, then pending, then paid, each by tenant name (the demo order)', () => {
    expect(list().items.map(label)).toEqual([
      'Sterling 09 overdue',
      'Arkadios 10 pending',
      'Cobalt 10 pending',
      'Northwind 10 pending',
      'Quillon 10 pending',
      'Sterling 10 pending',
      'Arkadios 09 paid',
      'Cobalt 09 paid',
      'Northwind 09 paid',
      'Quillon 09 paid',
    ])
  })

  it('searches the tenant name, ignoring case and outer spaces, with % and _ as plain characters', () => {
    expect(list({ q: '  NORTH ' }).items.map(label)).toEqual(['Northwind 10 pending', 'Northwind 09 paid'])
    expect(list({ q: '%' }).total).toBe(0)
    expect(list({ q: 'n_r' }).total).toBe(0)
    expect(list({ q: 'zzz' })).toMatchObject({ items: [], total: 0 })
  })

  it('filters by status and by month, and both together', () => {
    expect(list({ status: 'paid' }).total).toBe(4)
    expect(list({ status: 'overdue' }).total).toBe(1)
    expect(list({ month: '2026-10' }).total).toBe(5)
    expect(list({ month: '2026-09', status: 'paid' }).total).toBe(4)
    expect(list({ month: '2026-10', status: 'paid' }).total).toBe(0)
    expect(list({ q: 'sterling', month: '2026-09' }).items.map(label)).toEqual(['Sterling 09 overdue'])
  })

  it('sorts by every key, both ways, breaking ties by tenant, month, then id', () => {
    expect(list({ sort: 'tenant' }).items.slice(0, 2).map(label)).toEqual(['Arkadios 09 paid', 'Arkadios 10 pending'])
    expect(list({ sort: '-tenant' }).items[0].tenantName).toMatch(/^Sterling/)
    expect(list({ sort: 'month' }).items[0].month).toBe('2026-09')
    expect(list({ sort: '-month' }).items[0].month).toBe('2026-10')
    expect(list({ sort: 'payable' }).items[0].payable.amountMinor).toBe(86242)
    expect(list({ sort: '-payable' }).items[0].payable.amountMinor).toBe(771256)
    expect(list({ sort: 'deadline' }).items.map((b) => Date.parse(b.deadline))).toEqual(
      [...all().map((b) => Date.parse(b.deadline))].sort((a, b) => a - b),
    )
    // descending status puts paid first, still by tenant name inside each group
    expect(list({ sort: '-status' }).items.slice(0, 4).map(label)).toEqual(['Arkadios 09 paid', 'Cobalt 09 paid', 'Northwind 09 paid', 'Quillon 09 paid'])
  })

  it('pages with the real total, and returns nothing past the end', () => {
    expect(list({ pageSize: '4' }).items).toHaveLength(4)
    expect(list({ pageSize: '4', page: '3' })).toMatchObject({ total: 10, page: 3 })
    expect(list({ pageSize: '4', page: '3' }).items).toHaveLength(2)
    expect(list({ pageSize: '4', page: '9' })).toMatchObject({ items: [], total: 10 })
    const pages = [1, 2, 3].flatMap((p) => list({ pageSize: '4', page: String(p) }).items.map((b) => b.id))
    expect(pages).toEqual(list({ pageSize: '100' }).items.map((b) => b.id))
  })

  it('reports an error per bad parameter, all at once', () => {
    expect(
      Object.keys(errorsFor({ status: 'late', month: '2026-13', sort: 'id', page: '0', pageSize: '500', q: 'x'.repeat(101) })).sort(),
    ).toEqual(['month', 'page', 'pageSize', 'q', 'sort', 'status'])
    for (const month of ['2026-9', '26-09', '2026-00', 'September', '2026-09-01']) expect(errorsFor({ month }).month).toBeDefined()
    for (const sort of ['name', 'id', '-id', 'payable;drop', 'Status']) expect(errorsFor({ sort }).sort).toBeDefined()
    expect(errorsFor({ status: 'all' }).status).toBeDefined()
  })

  it('derives the status from the clock: a pending bill becomes overdue once its deadline has passed', () => {
    const later = NOW + 30 * DAY
    expect(list({}, later).items.filter((b) => b.status === 'overdue')).toHaveLength(6)
    expect(find('Arkadios', '2026-10').status).toBe('pending')
  })
})

describe('summary', () => {
  it('totals billable, collected, not yet paid and overdue per currency, in minor units', () => {
    expect(summary()).toEqual([
      { currency: 'USD', billable: 3351240, collected: 1589378, notYetPaid: 1675620, overdue: 86242 },
    ])
  })

  it('adds up: collected plus not yet paid plus overdue is billable', () => {
    const [t] = summary()
    expect(t.collected + t.notYetPaid + t.overdue).toBe(t.billable)
    for (const v of Object.values(t)) if (typeof v === 'number') expect(Number.isInteger(v)).toBe(true)
  })

  it('follows the search and the month, but not the status', () => {
    expect(summary({ month: '2026-10' })).toEqual([{ currency: 'USD', billable: 1675620, collected: 0, notYetPaid: 1675620, overdue: 0 }])
    expect(summary({ q: 'sterling' })).toEqual([{ currency: 'USD', billable: 172484, collected: 0, notYetPaid: 86242, overdue: 86242 }])
    expect(summary({ q: 'sterling', month: '2026-09' })).toEqual([{ currency: 'USD', billable: 86242, collected: 0, notYetPaid: 0, overdue: 86242 }])
    expect(summary({ status: 'paid' })).toEqual(summary()) // an unknown parameter here: ignored
  })

  it('has no totals when nothing is in scope', () => {
    expect(summary({ q: 'zzz' })).toEqual([])
  })

  it('refuses a bad search or month', () => {
    const result = summarizeBills(new URLSearchParams({ month: 'nope', q: 'x'.repeat(101) }), NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['month', 'q'])
  })
})

describe('notice', () => {
  it('is written by the server: the message, the amount due and the payment methods', () => {
    const b = find('Arkadios', '2026-10')
    const result = noticeOf(b.id, NOW)
    expect(result).toEqual({
      ok: true,
      notice: {
        message: 'Your bill for October 2026 is ready. Pay your bill before Nov 7, 2026.',
        amountDue: { amountMinor: 178048, currency: 'USD' },
        paymentMethods: ['stripe', 'paypal'],
      },
    })
  })

  it('works for an overdue bill, and is plain text', () => {
    const result = noticeOf(find('Sterling', '2026-09').id, NOW)
    expect(result.ok && result.notice.message).toBe('Your bill for September 2026 is ready. Pay your bill before Oct 6, 2026.')
    expect(result.ok && result.notice.message).not.toMatch(/[<>&]/)
  })

  it('refuses a paid bill (409) and an unknown one (404)', () => {
    expect(noticeOf(find('Arkadios', '2026-09').id, NOW)).toEqual({ ok: false, status: 409 })
    expect(noticeOf('00000000-0000-4000-8000-000000000000', NOW)).toEqual({ ok: false, status: 404 })
  })
})

describe('invoice', () => {
  it('is for a paid bill, named by the server from the month and the bill id', () => {
    const b = find('Arkadios', '2026-09')
    const result = invoiceOf(b.id, NOW)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.filename).toBe(`invoice-2026-09-${b.id}.html`)
    expect(result.filename).toMatch(/^invoice-\d{4}-\d{2}-[0-9a-f-]{36}\.html$/)
    expect(result.html).toContain('Arkadios Home Office')
    expect(result.html).toContain('64 billed users at $26.00')
    expect(result.html).toContain('$1,664.00')
    expect(result.html).toContain('$116.48')
    expect(result.html).toContain('$1,780.48')
    expect(result.html).toContain('Status: paid')
  })

  it('refuses an unpaid bill (409) and an unknown one (404)', () => {
    expect(invoiceOf(find('Arkadios', '2026-10').id, NOW)).toEqual({ ok: false, status: 409 })
    expect(invoiceOf(find('Sterling', '2026-09').id, NOW)).toEqual({ ok: false, status: 409 })
    expect(invoiceOf('nope', NOW)).toEqual({ ok: false, status: 404 })
  })
})

describe('extend', () => {
  const extend = (b: Bill, body: unknown) => extendBill(b.id, body, NOW)

  it('moves an overdue bill to now plus the days, and it is pending again', () => {
    const result = extend(find('Sterling', '2026-09'), { days: 7 })
    expect(result.ok && result.bill.deadline).toBe(new Date(NOW + 7 * DAY).toISOString())
    expect(result.ok && result.bill.status).toBe('pending')
    expect(find('Sterling', '2026-09').status).toBe('pending')
  })

  it('adds the days to a deadline that is still ahead', () => {
    const b = find('Arkadios', '2026-10')
    const result = extend(b, { days: 30 })
    expect(result.ok && result.bill.deadline).toBe(new Date(NOW + 54 * DAY).toISOString())
    expect(result.ok && result.bill.id).toBe(b.id)
  })

  it.each([7, 14, 30])('accepts %d days', (days) => {
    expect(extend(find('Cobalt', '2026-10'), { days }).ok).toBe(true)
  })

  it.each([0, 1, 5, 15, 60, -7, '14', null, undefined, 14.5])('refuses %j days', (days) => {
    const result = extend(find('Cobalt', '2026-10'), { days })
    expect(result).toMatchObject({ ok: false, status: 400 })
    if (!result.ok && result.status === 400) expect(result.errors.days).toEqual(['Choose 7, 14 or 30 days.'])
  })

  it('refuses unknown fields and an empty body', () => {
    const result = extend(find('Cobalt', '2026-10'), { days: 7, status: 'paid' })
    expect(result).toMatchObject({ ok: false, status: 400 })
    if (!result.ok && result.status === 400) expect(result.errors).toEqual({ status: ['Unknown field.'] })
    for (const body of [undefined, null, [], 'x', 7]) expect(extend(find('Cobalt', '2026-10'), body)).toMatchObject({ ok: false, status: 400 })
  })

  it('refuses a paid bill (409) and an unknown one (404), changing nothing', () => {
    const paid = find('Arkadios', '2026-09')
    expect(extend(paid, { days: 7 })).toEqual({ ok: false, status: 409 })
    expect(find('Arkadios', '2026-09').deadline).toBe(paid.deadline)
    expect(extendBill('nope', { days: 7 }, NOW)).toEqual({ ok: false, status: 404 })
  })

  it('is not idempotent: sending it twice extends twice', () => {
    const b = find('Sterling', '2026-09')
    extend(b, { days: 7 })
    const second = extend(b, { days: 7 })
    expect(second.ok && second.bill.deadline).toBe(new Date(NOW + 14 * DAY).toISOString())
  })

  it('leaves every other bill alone', () => {
    const before = all().filter((b) => !(b.tenantName.startsWith('Sterling') && b.month === '2026-09'))
    extend(find('Sterling', '2026-09'), { days: 14 })
    const after = all().filter((b) => !(b.tenantName.startsWith('Sterling') && b.month === '2026-09'))
    expect(after).toEqual(before)
  })

  it('moves the money from overdue to not yet paid in the totals', () => {
    extend(find('Sterling', '2026-09'), { days: 7 })
    expect(summary()).toEqual([{ currency: 'USD', billable: 3351240, collected: 1589378, notYetPaid: 1761862, overdue: 0 }])
  })
})

describe('resetMockBills', () => {
  it('goes back to the demo bills', () => {
    extendBill(find('Sterling', '2026-09').id, { days: 7 }, NOW)
    resetMockBills(NOW)
    expect(find('Sterling', '2026-09').status).toBe('overdue')
  })
})
