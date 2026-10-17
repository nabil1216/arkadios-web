import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@/features/auth/api/auth' // wires the bearer token into the API client
import type { Role } from '@/features/auth/api/types'
import { sessionStore } from '@/features/auth/hooks/session'
import { API_BASE } from '@/lib/api'
import { staff } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { problem } from '@/mocks/problem'
import { resetMockStaff } from '@/mocks/staff'
import { allTenantUsers, endSession, resetMockSupport, startSession } from '@/mocks/support'
import { resetMockTenants } from '@/mocks/tenantCreate'
import { tenantRecords } from '@/mocks/tenants'
import { makeSession, renderRoutes } from '@/test/render'
import SupportPage from './SupportPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const USER_ID: Record<Role, string> = { admin: 'u1', support: 'u2', billing: 'u3', auditor: 'u4' }

beforeEach(() => {
  sessionStore.reset()
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
})
afterEach(() => {
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
})

function open(role: Role = 'support', search = '') {
  const session = makeSession(role)
  sessionStore.setSession({ ...session, accessToken: `mock-access.${USER_ID[role]}`, user: { ...session.user, id: USER_ID[role] } })
  return renderRoutes([{ path: '/support', element: <SupportPage /> }], '/support' + search)
}

const rows = () => Array.from(document.querySelectorAll<HTMLElement>('tr[data-session]'))
const loaded = () => waitFor(() => expect(rows().length).toBeGreaterThan(0))

/** Starts a session through the mock, as a staff member, with the first eligible user of a tenant. */
function begin(staffId: string, tenantName: string, userName: string, reason = 'Checklist did not create tasks after a stage move', over: Record<string, unknown> = {}) {
  const tenant = tenantRecords.find((t) => t.name === tenantName)!
  const user = allTenantUsers(tenant.id).find((u) => u.name === userName)!
  const result = startSession(staff.find((u) => u.id === staffId)!, { tenantId: tenant.id, tenantUserId: user.id, reason, durationMinutes: 30, mode: 'read', ...over }, 'http://localhost')
  if (!result.ok) throw new Error(result.detail)
  return result.value.session
}

describe('SupportPage: the page', () => {
  it('shows the heading, the demo\'s description and the rules', async () => {
    open()
    expect(screen.getByRole('heading', { level: 1, name: 'Support access' })).toBeInTheDocument()
    expect(screen.getByText('Platform staff can sign in as a tenant user to troubleshoot, without ever seeing a password.')).toBeInTheDocument()
    expect(screen.getByText(/A reason is required, and it is saved with the session\. The client's admins can see it\./)).toBeInTheDocument()
    expect(screen.getByText('A banner stays on screen for the whole session.')).toBeInTheDocument()
    expect(screen.getByText(/cannot be extended\. Signing out of the console does not end it\./)).toBeInTheDocument()
    await loaded()
  })

  it('lists the demo\'s two past sessions with who, tenant, user, reason, access, when it ended and how', async () => {
    open()
    await loaded()
    expect(rows()).toHaveLength(2)
    const first = within(rows()[0])
    expect(first.getByText('Omar Haddad')).toBeInTheDocument()
    expect(first.getByText('Arkadios Home Office')).toBeInTheDocument()
    expect(first.getByText('Priya Okafor')).toBeInTheDocument()
    expect(first.getByText('Checklist not creating tasks after a stage move')).toBeInTheDocument()
    expect(first.getByText('Read only')).toBeInTheDocument()
    expect(first.getByText('30 min')).toBeInTheDocument()
    expect(first.getByText('Ended')).toBeInTheDocument()
    expect(first.getByText('Ended by Omar Haddad')).toBeInTheDocument()
    expect(within(rows()[1]).getByText('Northwind Advisory Group')).toBeInTheDocument()
    expect(within(rows()[1]).getByText('24 min')).toBeInTheDocument()
  })

  it('shows an active session and a revoked one by their words, with how it ended', async () => {
    begin('u1', 'Cobalt Ridge Wealth', 'Jonas Weir')
    const mine = begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    endSession(staff.find((u) => u.id === 'u1')!, mine.id) // Dana revokes Omar's
    open()
    await waitFor(() => expect(rows()).toHaveLength(4))
    const byStatus = (status: string) => rows().find((r) => r.dataset.status === status)!
    expect(within(byStatus('active')).getByText('Active')).toBeInTheDocument()
    expect(within(byStatus('active')).getByText(/^Until/)).toBeInTheDocument()
    expect(within(byStatus('revoked')).getByText('Revoked')).toBeInTheDocument()
    expect(within(byStatus('revoked')).getByText('Revoked by Dana Whitfield')).toBeInTheDocument()
  })

  it('shows an edit session as Can edit', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh', undefined, { mode: 'edit' })
    open()
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(within(rows().find((r) => r.dataset.status === 'active')!).getByText('Can edit')).toBeInTheDocument()
  })

  it('shows a reason as plain text, whatever it contains', async () => {
    const reason = 'The <b>report</b> page shows <img src=x onerror=alert(1)> for one user'
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh', reason)
    open()
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(screen.getByText(reason)).toBeInTheDocument()
    expect(document.querySelector('tbody b, tbody img')).toBeNull()
  })

  it('shows loading rows first', async () => {
    open()
    expect(screen.getAllByTestId('sessions-skeleton')).toHaveLength(5)
    await loaded()
    expect(screen.queryByTestId('sessions-skeleton')).not.toBeInTheDocument()
  })

  it('shows an error with the reference, and Try again loads the list', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/support-sessions`, () => {
        calls += 1
        return calls === 1 ? problem(500, 'server', 'Server error', { detail: 'Something broke.' }) : HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 25 })
      }),
    )
    const user = userEvent.setup()
    open()
    const alert = (await screen.findByText('Could not load support sessions.')).closest('[role="alert"]')!
    expect(alert).toHaveTextContent('Something broke.')
    expect(alert).toHaveTextContent(/Reference: /)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('There are no support sessions yet.')).toBeInTheDocument()
  })

  it('says so when the network is down', async () => {
    server.use(http.get(`${API_BASE}/support-sessions`, () => HttpResponse.error()))
    open()
    expect(await screen.findByText('Could not load support sessions.')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong. Check your connection and try again.')).toBeInTheDocument()
  })

  it('says so when there are no sessions, and when a filter matches none', async () => {
    server.use(http.get(`${API_BASE}/support-sessions`, ({ request }) => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 25, q: new URL(request.url).search })))
    open()
    expect(await screen.findByText('There are no support sessions yet.')).toBeInTheDocument()
  })
})

describe('SupportPage: the status filter and paging', () => {
  it('filters by status, keeps it in the address bar, and says when nothing matches', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await loaded()
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'revoked')
    expect(router.state.location.search).toBe('?status=revoked')
    expect(await screen.findByText('No sessions match. Choose another status.')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'all')
    expect(router.state.location.search).toBe('')
    await waitFor(() => expect(rows()).toHaveLength(2))
  })

  it('offers every status, and starts from the status in the address bar', async () => {
    open('support', '?status=ended')
    await loaded()
    const select = screen.getByLabelText('Filter by status') as HTMLSelectElement
    expect(select.value).toBe('ended')
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['All statuses', 'Active', 'Ended', 'Expired', 'Revoked'])
  })

  it('pages the list from the server', async () => {
    const requested: string[] = []
    server.use(
      http.get(`${API_BASE}/support-sessions`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'))
        requested.push(String(page))
        const item = (n: number) => ({ id: `s${n}`, staffId: 'u2', staffName: 'Omar Haddad', tenantId: 't', tenantName: `Tenant ${n}`, tenantUserId: 'u', tenantUserName: 'User', reasonId: 'r', reason: 'A reason long enough to count', mode: 'read', durationMinutes: 30, startedAt: '2026-10-14T12:00:00Z', expiresAt: '2026-10-14T12:30:00Z', endedAt: '2026-10-14T12:10:00Z', status: 'ended', endedById: 'u2', endedByName: 'Omar Haddad' })
        return HttpResponse.json({ items: [item(page)], total: 60, page, pageSize: 25 })
      }),
    )
    const user = userEvent.setup()
    open()
    expect(await screen.findByText('Tenant 1')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pages' })).toHaveTextContent('Page 1 of 3')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Tenant 2')).toBeInTheDocument()
    expect(requested).toContain('2')
  })
})

describe('SupportPage: read only', () => {
  it('shows an auditor the sessions and nothing to start or end', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    open('auditor')
    await waitFor(() => expect(rows()).toHaveLength(3))
    expect(screen.queryByRole('button', { name: /start support session/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /end session|revoke/i })).not.toBeInTheDocument()
  })
})
