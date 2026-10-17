import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
const REASON = 'Checklist did not create tasks after a stage move'
let fetchSpy: MockInstance<typeof fetch>
let opened: MockInstance<typeof window.open>

beforeEach(() => {
  sessionStore.reset()
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
  fetchSpy = vi.spyOn(globalThis, 'fetch')
  opened = vi.spyOn(window, 'open').mockImplementation(() => null)
})
afterEach(() => {
  fetchSpy.mockRestore()
  opened.mockRestore()
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
  toast.dismiss() // sonner keeps its toasts between tests
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

const posts = () =>
  fetchSpy.mock.calls
    .filter(([url, init]) => init?.method === 'POST' && String(url).endsWith('/support-sessions'))
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)
const startButton = () => screen.getByRole('button', { name: 'Start support session' })
const submit = () => within(screen.getByRole('dialog', { name: 'Start a support session' })).getByRole('button', { name: 'Start support session' })
const tenantSelect = () => screen.getByLabelText('Tenant') as HTMLSelectElement
const userSelect = () => screen.getByLabelText('Sign in as') as HTMLSelectElement
const reasonBox = () => screen.getByLabelText('Reason') as HTMLTextAreaElement
const names = (select: HTMLSelectElement) => Array.from(select.options).map((o) => o.textContent)
const tenantId = (name: string) => tenantRecords.find((t) => t.name === name)!.id

/** Opens the dialog and waits until the tenants and the first tenant's users are in. */
async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(startButton()).toBeEnabled())
  await user.click(startButton())
  const dialog = await screen.findByRole('dialog', { name: 'Start a support session' })
  await waitFor(() => expect(submit()).toBeEnabled())
  return dialog
}
async function typeReason(user: ReturnType<typeof userEvent.setup>, text = REASON) {
  await user.click(reasonBox())
  await user.paste(text)
}

function ownSession(over: Record<string, unknown> = {}) {
  const tenant = tenantRecords.find((t) => t.name === 'Northwind Advisory Group')!
  const who = allTenantUsers(tenant.id).find((u) => u.name === 'Elena Marsh')!
  const result = startSession(staff.find((u) => u.id === 'u2')!, { tenantId: tenant.id, tenantUserId: who.id, reason: REASON, durationMinutes: 30, mode: 'read', ...over }, 'http://localhost')
  if (!result.ok) throw new Error(result.detail)
  return result.value
}

describe('Start a support session: the form', () => {
  it('is there for a manager and not for a read-only role', async () => {
    open('auditor')
    await waitFor(() => expect(document.querySelector('tr[data-session]')).not.toBeNull())
    expect(screen.queryByRole('button', { name: 'Start support session' })).not.toBeInTheDocument()
  })

  it('has the demo\'s fields and wording, and Cancel is focused first', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    expect(within(dialog).getByText('Troubleshoot as a tenant user. Every action is logged.')).toBeInTheDocument()
    expect(within(dialog).getByText("You act with this user's permissions, without their password.")).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('offers active and trial tenants only, and the users of the first one', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    expect(names(tenantSelect())).toEqual(['Arkadios Home Office', 'Cobalt Ridge Wealth', 'Marlow & Finch Partners', 'Northwind Advisory Group', 'Quillon Trust Company'])
    expect(names(userSelect())).toEqual(['Alex Park', 'Mara Vance', 'Priya Okafor']) // no Dana Whitfield: she is platform staff
  })

  it('shows the users of the tenant you choose, never a disabled one', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await user.selectOptions(tenantSelect(), tenantId('Northwind Advisory Group'))
    await waitFor(() => expect(names(userSelect())).toEqual(['Elena Marsh', 'Tom Hadley'])) // Ruth Calder is disabled
    expect(userSelect()).toHaveValue(allTenantUsers(tenantId('Northwind Advisory Group')).find((u) => u.name === 'Elena Marsh')!.id)
  })

  it('shows the notice about passwords and personal data, and a count out of 500', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    expect(within(dialog).getByText(/Do not type passwords or client personal data\. The client's admins will see this reason\./)).toBeInTheDocument()
    expect(reasonBox()).toHaveAccessibleDescription(/Do not type passwords or client personal data\. The client's admins will see this reason\./)
    expect(within(dialog).getByText('0 / 500')).toBeInTheDocument()
    await typeReason(user, '  twelve chars  ')
    expect(within(dialog).getByText('12 / 500')).toBeInTheDocument() // counted after trimming
  })

  it('offers 15, 30 and 60 minutes, 30 chosen, and no custom time', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    const group = within(dialog).getByRole('radiogroup', { name: 'Length' })
    expect(within(group).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['15', '30', '60'])
    expect(within(group).getByRole('radio', { name: '30 minutes' })).toBeChecked()
    expect(within(dialog).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/custom|minutes\b.*enter/i)).not.toBeInTheDocument()
  })

  it('starts in read only, with changes as a separate choice', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    const group = within(dialog).getByRole('radiogroup', { name: 'Access' })
    expect(within(group).getByRole('radio', { name: 'Read only' })).toBeChecked()
    expect(within(group).getByRole('radio', { name: 'Can make changes' })).not.toBeChecked()
    expect(within(group).getByRole('radio', { name: 'Can make changes' })).toHaveAccessibleDescription(/Passwords, users, exports, deletes and approvals stay blocked/)
  })

  it('closes on Cancel and Escape without asking the server', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(startButton())
    await screen.findByRole('dialog', { name: 'Start a support session' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(posts()).toEqual([])
    expect(startButton()).toHaveFocus()
  })

  it('starts empty again after it was closed with something typed', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(startButton())
    await screen.findByRole('dialog', { name: 'Start a support session' })
    expect(reasonBox()).toHaveValue('')
  })

  it('says so when no tenant can be signed in to, and when the tenants cannot be loaded', async () => {
    server.use(http.get(`${API_BASE}/support/tenants`, () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 100 })))
    const user = userEvent.setup()
    open()
    await waitFor(() => expect(startButton()).toBeEnabled())
    await user.click(startButton())
    expect(await screen.findByText(/No tenant can be signed in to right now/)).toBeInTheDocument()
    expect(submit()).toBeDisabled()
  })

  it('shows an error with Try again when the tenants cannot be loaded', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/support/tenants`, () => {
        calls += 1
        return calls === 1 ? problem(500, 'server', 'Server error', { detail: 'Something broke.' }) : HttpResponse.json({ items: [{ id: 't', name: 'Only Tenant', domain: 'only.platform.example', status: 'active' }], total: 1, page: 1, pageSize: 100 })
      }),
    )
    const user = userEvent.setup()
    open()
    await waitFor(() => expect(startButton()).toBeEnabled())
    await user.click(startButton())
    expect(await screen.findByText('Something broke.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(names(tenantSelect())).toEqual(['Only Tenant']))
  })
})

describe('Start a support session: finding a user', () => {
  const userRequests = () =>
    fetchSpy.mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/support-users')).map((url) => new URL(url, location.href).searchParams)
  const search = () => screen.getByLabelText('Search users') as HTMLInputElement

  /** A tenant with 60 users, served 25 at a time, filtered by q. */
  function manyUsers() {
    const all = Array.from({ length: 60 }, (_, i) => ({ id: `user-${i + 1}`, name: `Person ${String(i + 1).padStart(2, '0')}`, roleName: 'Advisor' }))
    server.use(
      http.get(`${API_BASE}/tenants/:id/support-users`, ({ request }) => {
        const p = new URL(request.url).searchParams
        const q = (p.get('q') ?? '').toLowerCase()
        const page = Number(p.get('page') ?? 1)
        const pageSize = Number(p.get('pageSize') ?? 25)
        const matches = all.filter((u) => u.name.toLowerCase().includes(q))
        return HttpResponse.json({ items: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, pageSize })
      }),
    )
  }

  it('has a search box next to the user list', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    expect(search()).toHaveValue('')
    expect(search()).toHaveAttribute('placeholder', "Search this tenant's users")
  })

  it('narrows the list as you type, picks the first match, and starts the session as that user', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await user.selectOptions(tenantSelect(), tenantId('Northwind Advisory Group'))
    await waitFor(() => expect(names(userSelect())).toEqual(['Elena Marsh', 'Tom Hadley']))
    await user.type(search(), 'tom')
    await waitFor(() => expect(names(userSelect())).toEqual(['Tom Hadley']))
    expect(userSelect()).toHaveValue(allTenantUsers(tenantId('Northwind Advisory Group')).find((u) => u.name === 'Tom Hadley')!.id)
    await typeReason(user)
    await user.click(submit())
    await screen.findByText(/Support session started on/)
    expect(posts()[0].tenantUserId).toBe(allTenantUsers(tenantId('Northwind Advisory Group')).find((u) => u.name === 'Tom Hadley')!.id)
  })

  it('waits for the typing to pause: one request for what was typed, not one per key', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    const before = userRequests().length
    await user.type(search(), 'priya')
    await waitFor(() => expect(names(userSelect())).toEqual(['Priya Okafor']))
    const sent = userRequests().slice(before).map((p) => p.get('q'))
    expect(sent).toEqual(['priya'])
  })

  it('ignores case and spaces around the words', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await user.type(search(), '  MARA  ')
    await waitFor(() => expect(names(userSelect())).toEqual(['Mara Vance']))
  })

  it('says when no one matches, turns Start off, and brings the list back when the box is cleared', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await user.type(search(), 'zzz')
    await waitFor(() => expect(names(userSelect())).toEqual(['No users match']))
    expect(submit()).toBeDisabled()
    await user.clear(search())
    await waitFor(() => expect(names(userSelect())).toEqual(['Alex Park', 'Mara Vance', 'Priya Okafor']))
    await waitFor(() => expect(submit()).toBeEnabled())
  })

  it('does not start the session when Enter is pressed in the box', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.type(search(), 'mara{Enter}')
    await waitFor(() => expect(names(userSelect())).toEqual(['Mara Vance']))
    expect(posts()).toEqual([])
    expect(screen.getByRole('dialog', { name: 'Start a support session' })).toBeInTheDocument()
  })

  it('pages a long list from the server, 25 at a time, and picks the first of the new page', async () => {
    manyUsers()
    const user = userEvent.setup()
    open()
    await openForm(user)
    await waitFor(() => expect(userSelect().options).toHaveLength(25))
    const pages = () => screen.getByRole('navigation', { name: 'Pages' })
    expect(pages()).toHaveTextContent('Showing 1 to 25 of 60')
    expect(userSelect()).toHaveValue('user-1')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(userSelect()).toHaveValue('user-26'))
    expect(userRequests().at(-1)!.get('page')).toBe('2')
    expect(pages()).toHaveTextContent('Showing 26 to 50 of 60')
    expect(posts()).toEqual([]) // the pager buttons do not submit the form
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    await waitFor(() => expect(userSelect()).toHaveValue('user-1'))
  })

  it('searches across all the pages, and starts again from page 1', async () => {
    manyUsers()
    const user = userEvent.setup()
    open()
    await openForm(user)
    await user.click(await screen.findByRole('button', { name: 'Next' }))
    await waitFor(() => expect(userSelect()).toHaveValue('user-26'))
    await user.type(search(), '5')
    await waitFor(() => expect(userSelect().options).toHaveLength(15)) // Person 05, 15, 25, 35, 45 and 50 to 59: they fit on one page
    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
    expect(userRequests().at(-1)!.get('page')).toBeNull() // page 1
    expect(userRequests().at(-1)!.get('q')).toBe('5')
    expect(names(userSelect())[0]).toBe('Person 05')
  })

  it('starts the search over when you choose another tenant, and when the dialog is opened again', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await user.type(search(), 'priya')
    await waitFor(() => expect(names(userSelect())).toEqual(['Priya Okafor']))
    await user.selectOptions(tenantSelect(), tenantId('Northwind Advisory Group'))
    expect(search()).toHaveValue('')
    await waitFor(() => expect(names(userSelect())).toEqual(['Elena Marsh', 'Tom Hadley']))
    await user.type(search(), 'tom')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(startButton())
    await screen.findByRole('dialog', { name: 'Start a support session' })
    expect(search()).toHaveValue('')
  })

  it('keeps the search box off while the request runs', async () => {
    server.use(
      http.post(`${API_BASE}/support-sessions`, async () => {
        await new Promise((r) => setTimeout(r, 300))
        return problem(500, 'server', 'Server error')
      }),
    )
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.click(submit())
    await waitFor(() => expect(search()).toBeDisabled())
    await within(screen.getByRole('dialog')).findByText('Could not start the session. Try again.')
    expect(search()).toBeEnabled()
  })
})

describe('Start a support session: checks before sending', () => {
  it('needs a reason of at least 20 characters, focuses it, and sends nothing', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    await user.click(submit())
    expect(await within(dialog).findByText('Describe why you need access, in at least 20 characters.')).toBeInTheDocument()
    expect(reasonBox()).toHaveFocus()
    expect(reasonBox()).toHaveAttribute('aria-invalid', 'true')
    await typeReason(user, 'x'.repeat(19))
    await user.click(submit())
    expect(await within(dialog).findByText('Describe why you need access, in at least 20 characters.')).toBeInTheDocument()
    expect(posts()).toEqual([])
  })

  it('does not count spaces around the reason', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user, `     ${'x'.repeat(19)}     `)
    await user.click(submit())
    expect(await screen.findByText('Describe why you need access, in at least 20 characters.')).toBeInTheDocument()
    expect(posts()).toEqual([])
  })

  it('refuses more than 500 characters', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user, 'x'.repeat(501))
    await user.click(submit())
    expect(await screen.findByText('Use 500 characters or fewer.')).toBeInTheDocument()
    expect(posts()).toEqual([])
  })

  it('refuses control characters', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    fireEvent.change(reasonBox(), { target: { value: `${REASON}\u0007` } })
    await user.click(submit())
    expect(await screen.findByText('Use plain text only.')).toBeInTheDocument()
    expect(posts()).toEqual([])
  })
})

describe('Start a support session: sending', () => {
  it('sends the five fields, opens the workspace with the one-time code in the fragment, and says so', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await user.selectOptions(tenantSelect(), tenantId('Northwind Advisory Group'))
    await waitFor(() => expect(names(userSelect())).toEqual(['Elena Marsh', 'Tom Hadley']))
    await user.selectOptions(userSelect(), allTenantUsers(tenantId('Northwind Advisory Group')).find((u) => u.name === 'Tom Hadley')!.id)
    await typeReason(user, `  ${REASON}  `)
    await user.click(screen.getByRole('radio', { name: '60 minutes' }))
    await user.click(submit())

    expect(await screen.findByText('Support session started on Northwind Advisory Group')).toBeInTheDocument()
    expect(posts()).toEqual([
      {
        tenantId: tenantId('Northwind Advisory Group'),
        tenantUserId: allTenantUsers(tenantId('Northwind Advisory Group')).find((u) => u.name === 'Tom Hadley')!.id,
        reason: REASON,
        durationMinutes: 60,
        mode: 'read',
      },
    ])
    expect(opened).toHaveBeenCalledTimes(1)
    const [url, target, features] = opened.mock.calls[0]
    expect(new URL(String(url)).hash).toMatch(/^#code=mock-handoff\./)
    expect(new URL(String(url)).search).toBe('')
    expect([target, features]).toEqual(['_blank', 'noopener,noreferrer'])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('tr[data-status="active"]')).not.toBeNull())
  })

  it('writes the audit entry with who, the tenant, the tenant user and the reason', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.click(submit())
    await screen.findByText(/Support session started on/)
    expect(platformAuditLog()[0]).toMatchObject({
      actorName: 'Omar Haddad',
      action: 'support.started',
      details: expect.objectContaining({ tenantName: 'Arkadios Home Office', tenantUserName: 'Alex Park', reason: REASON, mode: 'read' }),
    })
  })

  it('sends the reason as typed: markup is plain text', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    const reason = 'The <b>report</b> page shows <script>alert(1)</script> for one user'
    await typeReason(user, reason)
    await user.click(submit())
    await screen.findByText(/Support session started on/)
    expect(posts()[0].reason).toBe(reason)
    await waitFor(() => expect(screen.getByText(reason)).toBeInTheDocument())
    expect(document.querySelector('tbody b, tbody script')).toBeNull()
  })

  it('sends once when Start support session is clicked twice in the same instant', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    act(() => {
      fireEvent.click(submit()) // one act: React renders nothing between the clicks, so the button is still enabled
      fireEvent.click(submit())
    })
    await screen.findByText(/Support session started on/)
    expect(posts()).toHaveLength(1)
  })

  it('keeps the dialog shut and the buttons off while the request runs', async () => {
    server.use(
      http.post(`${API_BASE}/support-sessions`, async () => {
        await new Promise((r) => setTimeout(r, 300))
        return problem(500, 'server', 'Server error')
      }),
    )
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    await typeReason(user)
    await user.click(submit())
    await waitFor(() => expect(submit()).toBeDisabled())
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Start a support session' })).toBeInTheDocument()
    expect(await within(dialog).findByText('Could not start the session. Try again.')).toBeInTheDocument()
    expect(submit()).toBeEnabled()
    expect(reasonBox()).toHaveValue(REASON) // what was typed is still there
  })
})

describe('Start a support session: can make changes', () => {
  async function chooseEdit(user: ReturnType<typeof userEvent.setup>) {
    await openForm(user)
    await typeReason(user)
    await user.click(screen.getByRole('radio', { name: 'Can make changes' }))
    await user.click(submit())
    return screen.findByRole('alertdialog')
  }

  it('asks first: names the tenant, the user and the length, and what stays blocked, with Cancel focused', async () => {
    const user = userEvent.setup()
    open()
    const confirm = await chooseEdit(user)
    expect(within(confirm).getByRole('heading', { name: 'Start a session that can make changes?' })).toBeInTheDocument()
    expect(within(confirm).getByText('You will be signed in as Alex Park at Arkadios Home Office for 30 minutes, and can change their data.')).toBeInTheDocument()
    expect(within(confirm).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Changing passwords or MFA',
      'Creating or changing users, roles or permissions',
      'Exporting data',
      'Deleting anything',
      'Approving or signing anything',
      'Changing billing or integration settings',
    ])
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(posts()).toEqual([])
  })

  it('goes back to the form with what was typed when cancelled, and sends nothing', async () => {
    const user = userEvent.setup()
    open()
    const confirm = await chooseEdit(user)
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await screen.findByRole('dialog', { name: 'Start a support session' })
    expect(reasonBox()).toHaveValue(REASON)
    expect(screen.getByRole('radio', { name: 'Can make changes' })).toBeChecked()
    expect(posts()).toEqual([])
  })

  it('starts the session with mode edit on confirm', async () => {
    const user = userEvent.setup()
    open()
    const confirm = await chooseEdit(user)
    await user.click(within(confirm).getByRole('button', { name: 'Start with edit access' }))
    expect(await screen.findByText(/Support session started on/)).toBeInTheDocument()
    expect(posts()[0]).toMatchObject({ mode: 'edit', durationMinutes: 30 })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('sends once when the confirm button is clicked twice in the same instant', async () => {
    const user = userEvent.setup()
    open()
    const confirm = await chooseEdit(user)
    const button = within(confirm).getByRole('button', { name: 'Start with edit access' })
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    await screen.findByText(/Support session started on/)
    expect(posts()).toHaveLength(1)
  })

  it('does not ask for a read only session', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.click(submit())
    await screen.findByText(/Support session started on/)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('Start a support session: one at a time', () => {
  it('asks to end the one that is open before starting another, with Cancel focused first', async () => {
    ownSession()
    const user = userEvent.setup()
    open()
    await waitFor(() => expect(startButton()).toBeEnabled())
    await waitFor(() => expect(document.querySelector('tr[data-status="active"]')).not.toBeNull())
    await user.click(startButton())
    const dialog = await screen.findByRole('dialog', { name: 'Start a support session' })
    expect(within(dialog).getByText(/A support session is already open on/)).toHaveTextContent('Northwind Advisory Group')
    expect(within(dialog).getByText(/End it before starting another/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(screen.queryByLabelText('Reason')).not.toBeInTheDocument()
  })

  it('ends that session and carries on with the form', async () => {
    ownSession()
    const user = userEvent.setup()
    open()
    await waitFor(() => expect(document.querySelector('tr[data-status="active"]')).not.toBeNull())
    await user.click(startButton())
    await user.click(await screen.findByRole('button', { name: 'End that session' }))
    expect(await screen.findByText('Support session ended')).toBeInTheDocument()
    await screen.findByLabelText('Reason')
    await waitFor(() => expect(document.querySelector('tr[data-status="active"]')).toBeNull())
    expect(document.querySelector('tr[data-status="ended"]')).not.toBeNull()
  })

  it('ends it once when End that session is clicked twice in the same instant', async () => {
    ownSession()
    const user = userEvent.setup()
    open()
    await waitFor(() => expect(document.querySelector('tr[data-status="active"]')).not.toBeNull())
    await user.click(startButton())
    const button = await screen.findByRole('button', { name: 'End that session' })
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    await screen.findByText('Support session ended')
    const ends = fetchSpy.mock.calls.filter(([url]) => String(url).endsWith('/end'))
    expect(ends).toHaveLength(1)
  })

  it('closes on Cancel and changes nothing', async () => {
    ownSession()
    const user = userEvent.setup()
    open()
    await waitFor(() => expect(document.querySelector('tr[data-status="active"]')).not.toBeNull())
    await user.click(startButton())
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.querySelector('tr[data-status="active"]')).not.toBeNull()
  })

  it('shows the server\'s sentence if it says one is open though the page did not know', async () => {
    server.use(http.get(`${API_BASE}/support-sessions/active`, () => HttpResponse.json({ session: null })))
    ownSession()
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.click(submit())
    expect(await screen.findByText(/You already have a support session open on Northwind Advisory Group/)).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Start a support session' })).toBeInTheDocument()
  })
})

describe('Start a support session: when the server says no', () => {
  it('shows the field errors under the fields', async () => {
    server.use(http.post(`${API_BASE}/support-sessions`, () => problem(400, 'validation', 'One or more validation errors occurred.', { errors: { reason: ['Use plain text only.'], durationMinutes: ['Choose 15, 30 or 60 minutes.'] } })))
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.click(submit())
    expect(await screen.findByText('Use plain text only.')).toBeInTheDocument()
    expect(screen.getByText('Choose 15, 30 or 60 minutes.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Start a support session' })).toBeInTheDocument()
  })

  it('shows the rate limit in the server\'s words, and keeps what was typed', async () => {
    server.use(http.post(`${API_BASE}/support-sessions`, () => problem(429, 'rate-limited', 'Too many requests', { detail: 'You have started too many support sessions this hour. Try again later.' })))
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.click(submit())
    expect(await screen.findByText('You have started too many support sessions this hour. Try again later.')).toBeInTheDocument()
    expect(reasonBox()).toHaveValue(REASON)
  })

  it('shows a refusal for a tenant that is not eligible', async () => {
    server.use(http.post(`${API_BASE}/support-sessions`, () => problem(409, 'support/not-eligible', 'Not allowed', { detail: 'Northwind Advisory Group is suspended. Support sessions are only available for active and trial tenants.' })))
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.click(submit())
    expect(await screen.findByText(/Support sessions are only available for active and trial tenants/)).toBeInTheDocument()
    expect(opened).not.toHaveBeenCalled()
  })

  it('shows the refusal when a support token is used to start one (no chaining), and opens nothing', async () => {
    server.use(http.post(`${API_BASE}/support-sessions`, () => problem(403, 'support/no-chaining', 'Not allowed', { detail: 'A support session cannot start another support session.' })))
    const user = userEvent.setup()
    open()
    await openForm(user)
    await typeReason(user)
    await user.click(submit())
    expect(await screen.findByText('A support session cannot start another support session.')).toBeInTheDocument()
    expect(opened).not.toHaveBeenCalled()
  })
})
