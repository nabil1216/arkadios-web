import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { setupServer } from 'msw/node'
import { toast } from 'sonner'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import '@/features/auth/api/auth' // wires the bearer token into the API client
import type { Role } from '@/features/auth/api/types'
import { sessionStore } from '@/features/auth/hooks/session'
import { Toaster } from '@/components/ui/sonner'
import { API_BASE } from '@/lib/api'
import { staff } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { platformAuditLog } from '@/mocks/audit'
import { problem } from '@/mocks/problem'
import { resetMockStaff } from '@/mocks/staff'
import { allTenantUsers, resetMockSupport, startSession } from '@/mocks/support'
import { resetMockTenants } from '@/mocks/tenantCreate'
import { tenantRecords } from '@/mocks/tenants'
import { makeSession, renderRoutes } from '@/test/render'
import SupportPage from './SupportPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const USER_ID: Record<Role, string> = { admin: 'u1', support: 'u2', billing: 'u3', auditor: 'u4' }
let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
  sessionStore.reset()
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})
afterEach(() => {
  fetchSpy.mockRestore()
  toast.dismiss() // sonner keeps its toasts between tests
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
})

function open(role: Role = 'support') {
  const session = makeSession(role)
  sessionStore.setSession({ ...session, accessToken: `mock-access.${USER_ID[role]}`, user: { ...session.user, id: USER_ID[role] } })
  return renderRoutes(
    [
      {
        path: '/support',
        element: (
          <>
            <SupportPage />
            <Toaster />
          </>
        ),
      },
    ],
    '/support',
  )
}

function begin(staffId: string, tenantName: string, userName: string) {
  const tenant = tenantRecords.find((t) => t.name === tenantName)!
  const who = allTenantUsers(tenant.id).find((u) => u.name === userName)!
  const result = startSession(staff.find((u) => u.id === staffId)!, { tenantId: tenant.id, tenantUserId: who.id, reason: 'Checklist did not create tasks after a stage move', durationMinutes: 30, mode: 'read' }, 'http://localhost')
  if (!result.ok) throw new Error(result.detail)
  return result.value.session
}

const rows = () => Array.from(document.querySelectorAll<HTMLElement>('tr[data-session]'))
const active = () => document.querySelector<HTMLElement>('tr[data-status="active"]')!
const ends = () => fetchSpy.mock.calls.filter(([url, init]) => String(url).endsWith('/end') && init?.method === 'POST')
const loaded = async () => {
  await waitFor(() => expect(rows().length).toBeGreaterThan(2))
  await waitFor(() => expect(screen.queryByTestId('sessions-skeleton')).not.toBeInTheDocument())
}

describe('End session: your own', () => {
  it('is on your own open session, and nowhere else', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    open('support') // Omar
    await loaded()
    expect(within(active()).getByRole('button', { name: 'End session on Northwind Advisory Group' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^End session/ })).toHaveLength(1) // ended sessions have none
    expect(screen.queryByRole('button', { name: /^Revoke/ })).not.toBeInTheDocument()
  })

  it('ends it at once without asking, and says so', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'End session on Northwind Advisory Group' }))
    expect(await screen.findByText('Support session ended')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(ends()).toHaveLength(1)
    await waitFor(() => expect(document.querySelector('tr[data-status="active"]')).toBeNull())
    expect(screen.getAllByText('Ended by Omar Haddad')).toHaveLength(3)
    expect(platformAuditLog().map((e) => e.action)).toEqual(['support.started', 'support.ended'])
  })

  it('ends it once when End session is clicked twice in the same instant', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    open()
    await loaded()
    const button = screen.getByRole('button', { name: 'End session on Northwind Advisory Group' })
    act(() => {
      fireEvent.click(button) // one act: React renders nothing between the clicks, so the button is still enabled
      fireEvent.click(button)
    })
    await screen.findByText('Support session ended')
    expect(ends()).toHaveLength(1)
  })

  it('shows the server\'s sentence if the session was already over, and reads the list again', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    server.use(http.post(`${API_BASE}/support-sessions/:id/end`, () => problem(409, 'support/not-active', 'Conflict', { detail: 'This support session is already over.' })))
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'End session on Northwind Advisory Group' }))
    expect(await screen.findByText('This support session is already over.')).toBeInTheDocument()
  })
})

describe('Revoke: someone else\'s', () => {
  it('is for a manager on a colleague\'s open session, named for the colleague, and not on their own', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh') // Omar's
    begin('u1', 'Cobalt Ridge Wealth', 'Jonas Weir') // Dana's
    open('admin') // Dana
    await loaded()
    expect(screen.getByRole('button', { name: 'Revoke of Omar Haddad on Northwind Advisory Group' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'End session on Cobalt Ridge Wealth' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^(End session|Revoke)/ })).toHaveLength(2)
  })

  it('asks first, naming the person, the user and the tenant, with Cancel focused', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    const user = userEvent.setup()
    open('admin')
    await loaded()
    await user.click(screen.getByRole('button', { name: /^Revoke/ }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('heading', { name: "Revoke Omar Haddad's session?" })).toBeInTheDocument()
    expect(within(dialog).getByText(/Omar Haddad is signed in as Elena Marsh at Northwind Advisory Group\. Their access stops at once/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(ends()).toEqual([])
  })

  it('does nothing on Cancel and on Escape', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    const user = userEvent.setup()
    open('admin')
    await loaded()
    await user.click(screen.getByRole('button', { name: /^Revoke/ }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^Revoke/ }))
    await screen.findByRole('alertdialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(ends()).toEqual([])
    expect(document.querySelector('tr[data-status="active"]')).not.toBeNull()
  })

  it('revokes on confirm: the row says who did it, and the audit entry has their name', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    const user = userEvent.setup()
    open('admin')
    await loaded()
    await user.click(screen.getByRole('button', { name: /^Revoke/ }))
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revoke session' }))
    expect(await screen.findByText("Omar Haddad's session was revoked")).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('tr[data-status="revoked"]')).not.toBeNull())
    expect(within(document.querySelector<HTMLElement>('tr[data-status="revoked"]')!).getByText('Revoked by Dana Whitfield')).toBeInTheDocument()
    expect(platformAuditLog().at(-1)).toMatchObject({ actorName: 'Dana Whitfield', action: 'support.revoked' })
  })

  it('revokes once when the confirm button is clicked twice in the same instant', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    const user = userEvent.setup()
    open('admin')
    await loaded()
    await user.click(screen.getByRole('button', { name: /^Revoke/ }))
    const button = within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Revoke session' })
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    await screen.findByText("Omar Haddad's session was revoked")
    expect(ends()).toHaveLength(1)
  })

  it('shows the server\'s sentence in the dialog if the session was already over', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    server.use(http.post(`${API_BASE}/support-sessions/:id/end`, () => problem(409, 'support/not-active', 'Conflict', { detail: 'This support session is already over.' })))
    const user = userEvent.setup()
    open('admin')
    await loaded()
    await user.click(screen.getByRole('button', { name: /^Revoke/ }))
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke session' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This support session is already over.')
  })
})

describe('End and revoke: who is offered what', () => {
  it('offers a read-only role neither', async () => {
    begin('u2', 'Northwind Advisory Group', 'Elena Marsh')
    open('auditor')
    await loaded()
    expect(screen.queryByRole('button', { name: /^(End session|Revoke)/ })).not.toBeInTheDocument()
  })

  it('offers a manager neither on a session that is over', async () => {
    open('admin')
    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(screen.queryByRole('button', { name: /^(End session|Revoke)/ })).not.toBeInTheDocument()
  })
})
