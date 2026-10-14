import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { toast } from 'sonner'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import '@/features/auth/api/auth' // wires the bearer token into the API client
import type { Role } from '@/features/auth/api/types'
import { sessionStore } from '@/features/auth/hooks/session'
import { Toaster } from '@/components/ui/sonner'
import { API_BASE } from '@/lib/api'
import { formatDay } from '@/lib/format'
import { handlers } from '@/mocks/handlers'
import { resetMockBills } from '@/mocks/bills'
import { problem } from '@/mocks/problem'
import { makeSession, renderRoutes } from '@/test/render'
import BillingPage from './BillingPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const USER_ID: Record<Role, string> = { admin: 'u1', support: 'u2', billing: 'u3', auditor: 'u4' }
let fetchSpy: MockInstance<typeof fetch>
let currentRole: Role = 'admin'

beforeEach(() => {
  sessionStore.reset()
  resetMockBills()
  fetchSpy = vi.spyOn(globalThis, 'fetch')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  fetchSpy.mockRestore()
  resetMockBills()
  toast.dismiss() // sonner keeps its toasts between tests
  vi.restoreAllMocks()
})

function open(search = '', role: Role = 'admin') {
  currentRole = role
  const session = makeSession(role)
  sessionStore.setSession({ ...session, accessToken: `mock-access.${USER_ID[role]}`, user: { ...session.user, id: USER_ID[role] } })
  return renderRoutes(
    [
      {
        path: '/billing',
        element: (
          <>
            <BillingPage />
            <Toaster />
          </>
        ),
      },
    ],
    '/billing' + search,
  )
}

const rows = () => Array.from(document.querySelectorAll<HTMLElement>('#b-body tr[data-id]'))
const rowOf = (tenant: string, status: string) => rows().find((r) => r.textContent?.includes(tenant) && r.textContent?.includes(status))!
const ready = async () => {
  await waitFor(() => expect(rows()).toHaveLength(10))
  // for a role that can extend, wait until permissions have arrived so the buttons exist
  if (currentRole === 'admin' || currentRole === 'billing') await screen.findAllByRole('button', { name: /^Extend deadline for/ })
}
/** Permissions have arrived (the request was made and answered), so a button that is not there is really absent. */
const permissionsLoaded = async () => {
  await waitFor(() => expect(requests(/\/permissions$/).length).toBeGreaterThan(0))
  await new Promise((r) => setTimeout(r, 300))
}
const searchOf = (router: { state: { location: { search: string } } }) => router.state.location.search
const requests = (match: RegExp) => fetchSpy.mock.calls.map(([url]) => String(url)).filter((u) => match.test(u))
const posts = () =>
  fetchSpy.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) as { days: number } }))

describe('BillingPage: the list', () => {
  it('shows the heading, the demo description and the ten bills, overdue first', async () => {
    open()
    expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument()
    expect(
      screen.getByText('Monthly subscription bills for every tenant. Tenants pay online through Stripe or PayPal from their own bill notice.'),
    ).toBeInTheDocument()
    await ready()
    expect(within(rows()[0]).getByText('Overdue')).toBeInTheDocument()
    expect(rows().map((r) => r.querySelector('td')?.textContent)).toEqual([
      'Sterling Hollow Family Office',
      'Arkadios Home Office',
      'Cobalt Ridge Wealth',
      'Northwind Advisory Group',
      'Quillon Trust Company',
      'Sterling Hollow Family Office',
      'Arkadios Home Office',
      'Cobalt Ridge Wealth',
      'Northwind Advisory Group',
      'Quillon Trust Company',
    ])
  })

  it('shows every column of a bill, with money formatted from integer minor units', async () => {
    open()
    await ready()
    const row = rowOf('Arkadios Home Office', 'Pending')
    const cells = within(row).getAllByRole('cell')
    expect(cells.map((c) => c.textContent).slice(0, 8)).toEqual([
      'Arkadios Home Office',
      expect.stringMatching(/^\w{3} \d{4}$/),
      'Professional',
      '64',
      '$26.00',
      '$1,664.00',
      '$116.48',
      '$1,780.48',
    ])
    expect(within(row).getByText('Pending')).toBeInTheDocument()
  })

  it('shows the deadline in local time, with the exact UTC date-time kept in the markup', async () => {
    open()
    await ready()
    const time = within(rowOf('Arkadios Home Office', 'Pending')).getByText(/\w{3} \d{1,2}$/, { selector: 'time' })
    const iso = time.getAttribute('datetime')!
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(time).toHaveTextContent(formatDay(iso))
    expect(time.getAttribute('title')).toContain(String(new Date(iso).getFullYear()))
  })

  it('shows the totals strip: Billable, Collected, Not yet paid and an Overdue alert', async () => {
    open()
    const strip = await screen.findByText('$33,512.40')
    expect(strip).toBeInTheDocument()
    const tile = (label: string) => screen.getByText(label, { selector: 'dt' }).closest('div')!
    expect(within(tile('Billable')).getByText('$33,512.40')).toBeInTheDocument()
    expect(within(tile('Collected')).getByText('$15,893.78')).toBeInTheDocument()
    expect(within(tile('Not yet paid')).getByText('$16,756.20')).toBeInTheDocument()
    expect(within(tile('Overdue')).getByText('$862.42')).toBeInTheDocument()
    expect(tile('Overdue').className).toContain('bg-red-tint')
    expect(tile('Billable').className).not.toContain('bg-red-tint')
  })

  it('has a sortable header on Tenant, Month, Payable, Deadline and Status, with aria-sort', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await ready()
    const header = (name: string) => screen.getByRole('columnheader', { name })
    expect(header('Status')).toHaveAttribute('aria-sort', 'ascending')
    for (const name of ['Tenant', 'Month', 'Payable', 'Deadline']) expect(header(name)).toHaveAttribute('aria-sort', 'none')
    for (const name of ['Plan', 'Billed users', 'Unit price', 'Subtotal', 'Tax']) expect(header(name)).not.toHaveAttribute('aria-sort')

    await user.click(within(header('Payable')).getByRole('button'))
    expect(searchOf(router)).toBe('?sort=payable')
    await waitFor(() => expect(within(rows()[0]).getByText('$862.42')).toBeInTheDocument())
    await user.click(within(header('Payable')).getByRole('button'))
    expect(searchOf(router)).toBe('?sort=-payable')
    await waitFor(() => expect(within(rows()[0]).getByText('$7,712.56')).toBeInTheDocument())
    expect(header('Payable')).toHaveAttribute('aria-sort', 'descending')
    await user.click(within(header('Status')).getByRole('button')) // back to the default sort
    expect(searchOf(router)).toBe('')
    await user.click(within(header('Status')).getByRole('button'))
    expect(searchOf(router)).toBe('?sort=-status')
  })
})

describe('BillingPage: states', () => {
  it('shows loading rows and loading totals first', async () => {
    open()
    expect(screen.getAllByTestId('bill-skeleton')).toHaveLength(5)
    expect(screen.getByTestId('totals-skeleton')).toBeInTheDocument()
    await ready()
    expect(screen.queryByTestId('bill-skeleton')).not.toBeInTheDocument()
    expect(screen.queryByTestId('totals-skeleton')).not.toBeInTheDocument()
  })

  it('shows an error with the reference, and Try again loads the bills', async () => {
    server.use(http.get(`${API_BASE}/bills`, () => problem(500, 'server', 'Server error', { detail: 'The database is not available.' }), { once: true }))
    const user = userEvent.setup()
    open()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load bills.')
    expect(alert).toHaveTextContent('The database is not available.')
    expect(alert).toHaveTextContent(/Reference: [0-9a-f-]{36}/)
    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(rows()).toHaveLength(10))
  })

  it('shows a plain message when the server cannot be reached', async () => {
    server.use(http.get(`${API_BASE}/bills`, () => HttpResponse.error(), { once: true }))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Check your connection and try again.')
  })

  it('still shows the bills when only the totals fail, and retries the totals alone', async () => {
    server.use(http.get(`${API_BASE}/bills/summary`, () => problem(500, 'server', 'Server error'), { once: true }))
    const user = userEvent.setup()
    open()
    await waitFor(() => expect(rows()).toHaveLength(10))
    const alert = await screen.findByText('Could not load the totals.')
    await user.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('$33,512.40')).toBeInTheDocument()
    expect(rows()).toHaveLength(10)
  })

  it('says so when a filter matches nothing, and when there are no bills at all', async () => {
    const { unmount } = open('?q=zzz')
    expect(await screen.findByText('No bills match. Clear the search or choose another status or month.')).toBeInTheDocument()
    unmount()
    server.use(
      http.get(`${API_BASE}/bills`, () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 25 })),
      http.get(`${API_BASE}/bills/summary`, () => HttpResponse.json({ totals: [] })),
    )
    open()
    expect(await screen.findByText('There are no bills yet.')).toBeInTheDocument()
    expect(screen.queryByText('Billable')).not.toBeInTheDocument()
  })

  it('shows one totals strip per currency', async () => {
    server.use(
      http.get(`${API_BASE}/bills/summary`, () =>
        HttpResponse.json({
          totals: [
            { currency: 'EUR', billable: 100000, collected: 100000, notYetPaid: 0, overdue: 0 },
            { currency: 'JPY', billable: 150000, collected: 0, notYetPaid: 150000, overdue: 0 },
          ],
        }),
      ),
    )
    open()
    expect(await screen.findByLabelText('Totals in EUR')).toHaveTextContent('€1,000.00')
    expect(screen.getByLabelText('Totals in JPY')).toHaveTextContent('¥150,000')
  })
})

describe('BillingPage: filters and URL', () => {
  it('reads the filters from the address bar', async () => {
    open('?status=paid&month=2026-09&sort=-payable')
    await waitFor(() => expect(rows()).toHaveLength(4))
    expect(screen.getByLabelText('Filter by status')).toHaveValue('paid')
    expect(screen.getByLabelText('Filter by month')).toHaveValue('2026-09')
    expect(within(rows()[0]).getByText('$7,712.56')).toBeInTheDocument()
  })

  it('searches the tenant after a pause, and the totals follow the search', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await ready()
    await user.type(screen.getByLabelText('Search bills by tenant'), 'sterling')
    expect(searchOf(router)).toBe('')
    await waitFor(() => expect(searchOf(router)).toBe('?q=sterling'), { timeout: 2000 })
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(await screen.findByText('$1,724.84')).toBeInTheDocument() // billable of both Sterling bills
    expect(requests(/\/bills\/summary\?q=sterling/)).not.toHaveLength(0)
  })

  it('filters by status, and the totals do not follow the status', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await ready()
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'overdue')
    expect(searchOf(router)).toBe('?status=overdue')
    await waitFor(() => expect(rows()).toHaveLength(1))
    expect(screen.getByText('$33,512.40')).toBeInTheDocument() // still the full billable total
    expect(requests(/\/bills\/summary\?.*status/)).toHaveLength(0)
    expect(within(screen.getByLabelText('Filter by status')).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'All statuses',
      'Overdue',
      'Pending',
      'Paid',
    ])
  })

  it('filters by month, and the totals follow the month', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await ready()
    await user.type(screen.getByLabelText('Filter by month'), '2026-10')
    await waitFor(() => expect(searchOf(router)).toBe('?month=2026-10'))
    await waitFor(() => expect(rows()).toHaveLength(5))
    // this month's bills are all pending: Billable and Not yet paid are the same number
    await waitFor(() => expect(screen.getAllByText('$16,756.20', { selector: 'dd' })).toHaveLength(2))
    expect(requests(/\/bills\/summary\?month=2026-10/)).not.toHaveLength(0)
  })

  it('does not put a half-typed month in the address bar', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await ready()
    const month = screen.getByLabelText('Filter by month') as HTMLInputElement
    // a browser without a month picker shows a text box: typing "2026-" must wait for the full value
    await user.type(month, '2026-1')
    expect(searchOf(router)).toBe('')
  })

  it('goes back to page 1 when a filter changes', async () => {
    const user = userEvent.setup()
    const { router } = open('?pageSize=4&page=2')
    await waitFor(() => expect(rows()).toHaveLength(4))
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'paid')
    expect(searchOf(router)).toBe('?status=paid&pageSize=4')
  })

  it('pages through the list, and hides the pager when it fits on one page', async () => {
    const user = userEvent.setup()
    const { router } = open('?pageSize=4')
    await waitFor(() => expect(rows()).toHaveLength(4))
    const pager = screen.getByRole('navigation', { name: 'Pages' })
    expect(pager).toHaveTextContent('Showing 1 to 4 of 10')
    await user.click(within(pager).getByRole('button', { name: 'Next' }))
    expect(searchOf(router)).toBe('?page=2&pageSize=4')
    await waitFor(() => expect(pager).toHaveTextContent('Showing 5 to 8 of 10'))
  })

  it('falls back to the defaults for junk in the address bar', async () => {
    open('?status=late&month=2026-13&sort=id&page=abc')
    await ready()
    expect(screen.getByLabelText('Filter by status')).toHaveValue('all')
    expect(screen.getByLabelText('Filter by month')).toHaveValue('')
  })
})

describe('BillingPage: #overdue', () => {
  it('highlights the first overdue bill and scrolls to it', async () => {
    open('#overdue')
    await ready()
    const highlighted = rows().filter((r) => r.dataset.highlighted)
    expect(highlighted).toHaveLength(1)
    expect(within(highlighted[0]).getByText('Overdue')).toBeInTheDocument()
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled())
  })

  it('highlights nothing without the hash', async () => {
    open()
    await ready()
    expect(rows().filter((r) => r.dataset.highlighted)).toHaveLength(0)
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })
})

describe('BillingPage: the notice preview', () => {
  async function preview(tenant: string, status: string) {
    const user = userEvent.setup()
    await user.click(within(rowOf(tenant, status)).getByRole('button', { name: `Preview the bill notice ${tenant} sees` }))
    return { user, dialog: await screen.findByRole('dialog', { name: 'What the tenant sees' }) }
  }

  it('shows what the tenant sees: the server\'s message, the amount and the payment methods', async () => {
    open()
    await ready()
    const { dialog } = await preview('Arkadios Home Office', 'Pending')
    expect(within(dialog).getByText("The notice shown at the top of Arkadios Home Office’s workspace.")).toBeInTheDocument()
    expect(await within(dialog).findByTestId('notice-message')).toHaveTextContent(/^Your bill for October 2026 is ready\. Pay your bill before \w{3} \d{1,2}, \d{4}\.$/)
    expect(within(dialog).getByText('Amount due $1,780.48. The tenant picks Stripe or PayPal on the payment page.')).toBeInTheDocument()
  })

  it('works for an overdue bill too', async () => {
    open()
    await ready()
    const { dialog } = await preview('Sterling Hollow Family Office', 'Overdue')
    expect(await within(dialog).findByTestId('notice-message')).toHaveTextContent('Your bill for September 2026 is ready.')
    expect(within(dialog).getByText(/Amount due \$862\.42/)).toBeInTheDocument()
  })

  it('labels Pay now as Preview only, and it does nothing', async () => {
    open()
    await ready()
    const { user, dialog } = await preview('Arkadios Home Office', 'Pending')
    const pay = await within(dialog).findByRole('button', { name: 'Pay now' })
    expect(within(dialog).getByText('Preview only')).toBeInTheDocument()
    expect(pay).toHaveAttribute('aria-disabled', 'true')
    expect(pay).toHaveAccessibleDescription('Preview only')
    const before = fetchSpy.mock.calls.length
    await user.click(pay)
    await new Promise((r) => setTimeout(r, 150))
    expect(fetchSpy.mock.calls.length).toBe(before) // no request
    expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(0) // no toast either (the demo had one)
    expect(screen.getByRole('dialog', { name: 'What the tenant sees' })).toBeInTheDocument() // and it stays put
  })

  it('renders the message as plain text, never as HTML', async () => {
    server.use(
      http.get(`${API_BASE}/bills/:id/notice`, () =>
        HttpResponse.json({
          message: '<img src=x onerror="window.__pwned=1"><b>Pay now</b> <script>window.__pwned=1</script>',
          amountDue: { amountMinor: 1000, currency: 'USD' },
          paymentMethods: ['stripe'],
        }),
      ),
    )
    open()
    await ready()
    const { dialog } = await preview('Arkadios Home Office', 'Pending')
    const message = await within(dialog).findByTestId('notice-message')
    expect(message.textContent).toBe('<img src=x onerror="window.__pwned=1"><b>Pay now</b> <script>window.__pwned=1</script>')
    expect(message.querySelector('img, b, script')).toBeNull()
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })

  it('names the payment methods the server lists', async () => {
    server.use(
      http.get(`${API_BASE}/bills/:id/notice`, () =>
        HttpResponse.json({ message: 'Your bill is ready.', amountDue: { amountMinor: 500, currency: 'USD' }, paymentMethods: ['stripe', 'paypal', 'wire'] }),
      ),
    )
    open()
    await ready()
    const { dialog } = await preview('Arkadios Home Office', 'Pending')
    expect(await within(dialog).findByText('Amount due $5.00. The tenant picks Stripe, PayPal or wire on the payment page.')).toBeInTheDocument()
  })

  it('shows an error with Try again when the notice cannot be loaded', async () => {
    server.use(http.get(`${API_BASE}/bills/:id/notice`, () => problem(500, 'server', 'Server error'), { once: true }))
    open()
    await ready()
    const { user, dialog } = await preview('Arkadios Home Office', 'Pending')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not load the notice.')
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }))
    expect(await within(dialog).findByTestId('notice-message')).toBeInTheDocument()
  })

  it('says so when the bill was paid in the meantime', async () => {
    server.use(http.get(`${API_BASE}/bills/:id/notice`, () => problem(409, 'conflict', 'Conflict', { detail: 'This bill is already paid.' })))
    open()
    await ready()
    const { dialog } = await preview('Arkadios Home Office', 'Pending')
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This bill is already paid.')
    expect(within(dialog).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('closes with Close and with Escape', async () => {
    open()
    await ready()
    const { user, dialog } = await preview('Arkadios Home Office', 'Pending')
    expect(within(dialog).getAllByRole('button', { name: 'Close' })).toHaveLength(1) // one Close, not two
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await preview('Arkadios Home Office', 'Pending')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('BillingPage: extending a deadline', () => {
  async function extendDialog(tenant = 'Sterling Hollow Family Office', status = 'Overdue') {
    const user = userEvent.setup()
    await user.click(within(rowOf(tenant, status)).getByRole('button', { name: `Extend deadline for ${tenant}` }))
    return { user, dialog: await screen.findByRole('dialog', { name: 'Extend the deadline' }) }
  }

  it('opens with the bill described and 14 days chosen', async () => {
    open()
    await ready()
    const { dialog } = await extendDialog()
    expect(within(dialog).getByText(/^Sterling Hollow Family Office, September 2026 bill\. Currently due \w{3} \d{1,2}, \d{4}\.$/)).toBeInTheDocument()
    expect(within(dialog).getByRole('radiogroup', { name: 'Extend by' })).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: '14 days' })).toBeChecked()
    expect(within(dialog).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['7', '14', '30'])
  })

  it('extends by the chosen days, says so, and the overdue bill is pending again', async () => {
    open()
    await ready()
    const { user, dialog } = await extendDialog()
    await user.click(within(dialog).getByRole('radio', { name: '30 days' }))
    await user.click(within(dialog).getByRole('button', { name: 'Extend deadline' }))

    expect(await screen.findByText('Deadline extended by 30 days')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(posts()).toHaveLength(1)
    expect(posts()[0].url).toMatch(/\/bills\/[0-9a-f-]{36}\/extend$/)
    expect(posts()[0].body).toEqual({ days: 30 })
    // the list and the totals are refreshed: nothing is overdue now
    await waitFor(() => expect(screen.queryByText('Overdue', { selector: 'span' })).not.toBeInTheDocument())
    expect(await screen.findByText('$17,618.62')).toBeInTheDocument() // not yet paid: 16,756.20 + 862.42
    const overdueTile = screen.getByText('Overdue', { selector: 'dt' }).closest('div')!
    expect(within(overdueTile).getByText('$0.00')).toBeInTheDocument()
    expect(overdueTile.className).not.toContain('bg-red-tint')
  })

  it.each([7, 14])('sends %d days when that is chosen', async (days) => {
    open()
    await ready()
    const { user, dialog } = await extendDialog('Arkadios Home Office', 'Pending')
    await user.click(within(dialog).getByRole('radio', { name: `${days} days` }))
    await user.click(within(dialog).getByRole('button', { name: 'Extend deadline' }))
    await screen.findByText(`Deadline extended by ${days} days`)
    expect(posts()[0].body).toEqual({ days })
  })

  it('keeps the button off while the request runs, so it cannot be sent twice', async () => {
    server.use(
      http.post(`${API_BASE}/bills/:id/extend`, async () => {
        await new Promise((r) => setTimeout(r, 400))
        return problem(500, 'server', 'Server error')
      }),
    )
    open()
    await ready()
    const { user, dialog } = await extendDialog()
    const extend = within(dialog).getByRole('button', { name: 'Extend deadline' })
    await user.click(extend)
    await waitFor(() => expect(extend).toBeDisabled())
    expect(within(dialog).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument() // no X while it runs
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    for (const r of within(dialog).getAllByRole('radio')) expect(r).toBeDisabled()
    await user.click(extend) // a second click while it runs does nothing
    await user.keyboard('{Escape}') // and neither does Escape
    expect(screen.getByRole('dialog', { name: 'Extend the deadline' })).toBeInTheDocument()
    expect(posts()).toHaveLength(1)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not extend the deadline. Try again.')
    expect(extend).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument() // the drawer's own X is back
  })

  it('sends one request even when the button is clicked twice in the same instant', async () => {
    open()
    await ready()
    const { dialog } = await extendDialog()
    const extend = within(dialog).getByRole('button', { name: 'Extend deadline' })
    fireEvent.click(extend) // both clicks land before the page has re-rendered the button as disabled
    fireEvent.click(extend)
    fireEvent.click(extend)
    expect(await screen.findByText('Deadline extended by 14 days')).toBeInTheDocument()
    expect(posts()).toHaveLength(1)
  })

  it('shows the server\'s reason when the bill was paid in the meantime', async () => {
    server.use(http.post(`${API_BASE}/bills/:id/extend`, () => problem(409, 'conflict', 'Conflict', { detail: 'This bill is already paid.' })))
    open()
    await ready()
    const { user, dialog } = await extendDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Extend deadline' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This bill is already paid.')
    expect(screen.queryByText(/Deadline extended/)).not.toBeInTheDocument()
  })

  it('closes with Cancel without sending anything, and opens fresh next time', async () => {
    open()
    await ready()
    const first = await extendDialog()
    await first.user.click(within(first.dialog).getByRole('radio', { name: '30 days' }))
    await first.user.click(within(first.dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(posts()).toHaveLength(0)

    const second = await extendDialog()
    expect(within(second.dialog).getByRole('radio', { name: '14 days' })).toBeChecked()
  })

  it('closes with Escape when nothing is running', async () => {
    open()
    await ready()
    const { user } = await extendDialog()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('BillingPage: invoices', () => {
  let saved: Array<{ href: string; download: string }>

  beforeEach(() => {
    saved = []
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:invoice'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ href: this.getAttribute('href') ?? '', download: this.download })
    })
  })

  const invoiceButton = (tenant: string) => within(rowOf(tenant, 'Paid')).getByRole('button', { name: new RegExp(`^Download invoice for ${tenant}, September 2026`) })

  it('downloads a paid bill\'s invoice under the name the server gives it', async () => {
    const user = userEvent.setup()
    open()
    await ready()
    await user.click(invoiceButton('Arkadios Home Office'))
    expect(await screen.findByText('Invoice downloaded')).toBeInTheDocument()
    expect(saved).toHaveLength(1)
    expect(saved[0].download).toMatch(/^invoice-\d{4}-\d{2}-[0-9a-f-]{36}\.html$/)
    expect(saved[0].href).toBe('blob:invoice')
    expect(requests(/\/invoice$/)).toHaveLength(1)
  })

  it('has the file name from Content-Disposition, and a fallback when there is none', async () => {
    server.use(http.get(`${API_BASE}/bills/:id/invoice`, () => new HttpResponse('<html></html>', { headers: { 'Content-Type': 'text/html' } })))
    const user = userEvent.setup()
    open()
    await ready()
    await user.click(invoiceButton('Cobalt Ridge Wealth'))
    await screen.findByText('Invoice downloaded')
    expect(saved[0].download).toMatch(/^invoice-\d{4}-\d{2}$/)
  })

  it('keeps that button off while the file is being fetched', async () => {
    server.use(
      http.get(`${API_BASE}/bills/:id/invoice`, async () => {
        await new Promise((r) => setTimeout(r, 300))
        return new HttpResponse('<html></html>', { headers: { 'Content-Type': 'text/html' } })
      }),
    )
    const user = userEvent.setup()
    open()
    await ready()
    const button = invoiceButton('Quillon Trust Company')
    await user.click(button)
    await waitFor(() => expect(button).toBeDisabled())
    await user.click(button)
    await screen.findByText('Invoice downloaded')
    expect(button).toBeEnabled()
    expect(requests(/\/invoice$/)).toHaveLength(1)
  })

  it('fetches the file once when the button is clicked twice in the same instant', async () => {
    open()
    await ready()
    const button = invoiceButton('Arkadios Home Office')
    fireEvent.click(button)
    fireEvent.click(button)
    await screen.findByText('Invoice downloaded')
    expect(requests(/\/invoice$/)).toHaveLength(1)
    expect(saved).toHaveLength(1)
  })

  it('says so when the invoice cannot be downloaded', async () => {
    server.use(http.get(`${API_BASE}/bills/:id/invoice`, () => problem(500, 'server', 'Server error')))
    const user = userEvent.setup()
    open()
    await ready()
    await user.click(invoiceButton('Arkadios Home Office'))
    expect(await screen.findByText('Could not download the invoice. Try again.')).toBeInTheDocument()
    expect(saved).toHaveLength(0)
  })
})

describe('BillingPage: permissions', () => {
  it('lets a role with billing.manage extend, preview and download', async () => {
    open('', 'billing')
    await ready()
    expect(screen.getAllByRole('button', { name: /^Extend deadline for/ })).toHaveLength(6)
    expect(screen.getAllByRole('button', { name: /^Preview the bill notice/ })).toHaveLength(6)
    expect(screen.getAllByRole('button', { name: /^Download invoice for/ })).toHaveLength(4)
  })

  it.each<Role>(['support', 'auditor'])('%s can preview and download but not extend', async (role) => {
    open('', role)
    await ready()
    await permissionsLoaded()
    expect(screen.getAllByRole('button', { name: /^Preview the bill notice/ })).toHaveLength(6)
    expect(screen.getAllByRole('button', { name: /^Download invoice for/ })).toHaveLength(4)
    expect(screen.queryByRole('button', { name: /^Extend/ })).not.toBeInTheDocument()
  })
})
