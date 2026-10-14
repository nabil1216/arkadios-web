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
import { permissions } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { problem } from '@/mocks/problem'
import { platformAuditLog, resetMockStaff } from '@/mocks/staff'
import { makeSession, renderRoutes } from '@/test/render'
import AccessPage from './AccessPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const USER_ID: Record<Role, string> = { admin: 'u1', support: 'u2', billing: 'u3', auditor: 'u4' }
let fetchSpy: MockInstance<typeof fetch>
let info: MockInstance<typeof console.info>

beforeEach(() => {
  sessionStore.reset()
  resetMockStaff()
  fetchSpy = vi.spyOn(globalThis, 'fetch')
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  fetchSpy.mockRestore()
  info.mockRestore()
  resetMockStaff()
  toast.dismiss() // sonner keeps its toasts between tests
})

function open(role: Role = 'admin') {
  const session = makeSession(role)
  sessionStore.setSession({ ...session, accessToken: `mock-access.${USER_ID[role]}`, user: { ...session.user, id: USER_ID[role] } })
  return renderRoutes(
    [
      {
        path: '/access',
        element: (
          <>
            <AccessPage />
            <Toaster />
          </>
        ),
      },
    ],
    '/access',
  )
}

const posts = () =>
  fetchSpy.mock.calls
    .filter(([url, init]) => init?.method === 'POST' && String(url).endsWith('/staff'))
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)
const staffRows = () => Array.from(document.querySelectorAll<HTMLElement>('tr[data-staff]'))
const inviteButton = () => screen.getByRole('button', { name: 'Invite staff member' })
const loaded = async () => {
  await waitFor(() => expect(staffRows()).toHaveLength(5))
  await waitFor(() => expect(inviteButton()).toBeEnabled()) // waits for the roles
}
const name = () => screen.getByLabelText('Full name')
const email = () => screen.getByLabelText('Work email')
const role = () => screen.getByLabelText('Role') as HTMLSelectElement
const send = () => screen.getByRole('button', { name: 'Send invitation' })

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await loaded()
  await user.click(inviteButton())
  return screen.findByRole('dialog', { name: 'Invite a staff member' })
}

async function fill(user: ReturnType<typeof userEvent.setup>, person = { name: 'Test Person', email: 'test.person@platform.example' }) {
  await user.type(name(), person.name)
  await user.type(email(), person.email)
}

describe('Invite staff member: the dialog', () => {
  it('is there for a manager and not for a read-only role', async () => {
    open('auditor')
    await waitFor(() => expect(staffRows()).toHaveLength(5))
    await screen.findByRole('columnheader', { name: /Super admin/ })
    expect(screen.queryByRole('button', { name: 'Invite staff member' })).not.toBeInTheDocument()
  })

  it('has name, email and role, Support lead preselected, and the demo\'s description', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    expect(within(dialog).getByText('They get an email with a link to set up their sign-in.')).toBeInTheDocument()
    expect(name()).toHaveValue('')
    expect(email()).toHaveValue('')
    expect(email()).toHaveAttribute('type', 'email')
    expect(role()).toHaveValue('support')
    expect(Array.from(role().options).map((o) => o.textContent)).toEqual(['Super admin', 'Support lead', 'Billing manager', 'Auditor'])
  })

  it('has no password field and no way to set one', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    expect(dialog.querySelector('input[type="password"]')).toBeNull()
    expect(within(dialog).queryByLabelText(/password/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/mfa/i)).not.toBeInTheDocument()
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(2) // name and email only
  })

  it('focuses Cancel first', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('closes on Cancel and Escape without asking the server, and gives focus back to the button', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(inviteButton()).toHaveFocus()
    await user.click(inviteButton())
    await screen.findByRole('dialog', { name: 'Invite a staff member' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(posts()).toEqual([])
  })

  it('starts empty again after it was closed with something typed', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(inviteButton())
    await screen.findByRole('dialog', { name: 'Invite a staff member' })
    expect(name()).toHaveValue('')
    expect(email()).toHaveValue('')
  })
})

describe('Invite staff member: checks before sending', () => {
  it('shows both errors at once for an empty form, focuses the first, and sends nothing', async () => {
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    await user.click(send())
    expect(await within(dialog).findByText('Enter their name.')).toBeInTheDocument()
    expect(within(dialog).getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(within(dialog).getAllByRole('alert')).toHaveLength(2)
    expect(name()).toHaveFocus()
    expect(name()).toHaveAttribute('aria-invalid', 'true')
    expect(posts()).toEqual([])
  })

  it('refuses an email that is not an email', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await fill(user, { name: 'Test Person', email: 'nope' })
    await user.click(send())
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(posts()).toEqual([])
  })

  it('refuses an email that already has access, ignoring case, before asking the server', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await fill(user, { name: 'Test Person', email: 'LIAM.CARTER@platform.example' })
    await user.click(send())
    expect(await screen.findByText('This person already has access.')).toBeInTheDocument()
    expect(email()).toHaveFocus()
    expect(posts()).toEqual([])
  })

  it('shows the server\'s field errors under the fields', async () => {
    server.use(
      http.post(`${API_BASE}/staff`, () =>
        problem(400, 'validation', 'One or more validation errors occurred.', { errors: { name: ['Use 100 characters or fewer.'], email: ['Enter a valid email address.'] } }),
      ),
    )
    const user = userEvent.setup()
    open()
    await openForm(user)
    await fill(user)
    await user.click(send())
    expect(await screen.findByText('Use 100 characters or fewer.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Invite a staff member' })).toBeInTheDocument()
  })

  it('shows a duplicate the server finds (someone invited it a moment ago) under the email', async () => {
    server.use(
      http.post(`${API_BASE}/staff`, () =>
        problem(409, 'conflict', 'Conflict', { detail: 'This person already has access.', errors: { email: ['This person already has access.'] } }),
      ),
    )
    const user = userEvent.setup()
    open()
    await openForm(user)
    await fill(user)
    await user.click(send())
    expect(await screen.findByText('This person already has access.')).toBeInTheDocument()
    expect(email()).toHaveFocus()
  })
})

describe('Invite staff member: sending', () => {
  it('sends name, email and role only, trimmed, and adds an invited row', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await user.type(name(), '  Test Person ')
    await user.type(email(), ' test.person@platform.example ')
    await user.selectOptions(role(), 'billing')
    await user.click(send())

    expect(await screen.findByText('Invitation sent to test.person@platform.example')).toBeInTheDocument()
    expect(posts()).toEqual([{ name: 'Test Person', email: 'test.person@platform.example', role: 'billing' }])
    await waitFor(() => expect(staffRows()).toHaveLength(6))
    const row = staffRows().find((r) => r.textContent?.includes('Test Person'))!
    expect(within(row).getByText('Invited')).toBeInTheDocument()
    expect(within(row).getByText('MFA not set')).toBeInTheDocument()
    expect(within(row).getByLabelText('Role for Test Person')).toHaveValue('billing')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('6 people')).toBeInTheDocument()
    await waitFor(() => expect(inviteButton()).toHaveFocus())
  })

  it('sends a set-password link and no password, and audits the invitation', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await fill(user)
    await user.click(send())
    await screen.findByText('Invitation sent to test.person@platform.example')
    const mail = info.mock.calls.map((c) => String(c[0])).find((l) => l.includes('test.person@platform.example'))!
    expect(mail).toContain('/reset-password#token=')
    expect(JSON.stringify(posts())).not.toMatch(/password/i)
    expect(platformAuditLog()[0]).toMatchObject({ actorName: 'Dana Whitfield', action: 'staff.invited', entityName: 'Test Person' })
  })

  it('sends once when Send invitation is clicked twice in the same instant', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await fill(user)
    act(() => {
      fireEvent.click(send()) // one act: React renders nothing between the clicks, so the button is still enabled
      fireEvent.click(send())
    })
    await screen.findByText('Invitation sent to test.person@platform.example')
    expect(posts()).toHaveLength(1)
  })

  it('keeps the dialog shut and the buttons off while the request runs', async () => {
    server.use(
      http.post(`${API_BASE}/staff`, async () => {
        await new Promise((r) => setTimeout(r, 300))
        return problem(500, 'server', 'Server error')
      }),
    )
    const user = userEvent.setup()
    open()
    const dialog = await openForm(user)
    await fill(user)
    await user.click(send())
    await waitFor(() => expect(send()).toBeDisabled())
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Invite a staff member' })).toBeInTheDocument()
    expect(await within(dialog).findByText('Could not send the invitation. Try again.')).toBeInTheDocument()
    expect(send()).toBeEnabled()
    expect(name()).toHaveValue('Test Person') // what was typed is still there
  })
})

describe('Invite staff member: a role that holds access.manage asks first', () => {
  async function pickSuperAdmin(user: ReturnType<typeof userEvent.setup>) {
    await openForm(user)
    await fill(user)
    await user.selectOptions(role(), 'admin')
    await user.click(send())
    return screen.findByRole('alertdialog')
  }

  it('names the person and the role, with Cancel focused first, and sends nothing yet', async () => {
    const user = userEvent.setup()
    open()
    const confirm = await pickSuperAdmin(user)
    expect(within(confirm).getByRole('heading', { name: 'Invite Test Person as Super admin?' })).toBeInTheDocument()
    expect(within(confirm).getByText(/Super admin can change who has access to this console and what every role can do\. Test Person will be able to do that too\./)).toBeInTheDocument()
    expect(within(confirm).getByText(/You never see or set it/)).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(posts()).toEqual([])
  })

  it('goes back to the form with what was typed when it is cancelled', async () => {
    const user = userEvent.setup()
    open()
    const confirm = await pickSuperAdmin(user)
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await screen.findByRole('dialog', { name: 'Invite a staff member' })
    expect(name()).toHaveValue('Test Person')
    expect(email()).toHaveValue('test.person@platform.example')
    expect(role()).toHaveValue('admin')
    expect(posts()).toEqual([])
  })

  it('sends on confirm', async () => {
    const user = userEvent.setup()
    open()
    const confirm = await pickSuperAdmin(user)
    await user.click(within(confirm).getByRole('button', { name: 'Send invitation' }))
    expect(await screen.findByText('Invitation sent to test.person@platform.example')).toBeInTheDocument()
    expect(posts()).toEqual([{ name: 'Test Person', email: 'test.person@platform.example', role: 'admin' }])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sends once when the confirm button is clicked twice in the same instant', async () => {
    const user = userEvent.setup()
    open()
    const confirm = await pickSuperAdmin(user)
    const button = within(confirm).getByRole('button', { name: 'Send invitation' })
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    await screen.findByText('Invitation sent to test.person@platform.example')
    expect(posts()).toHaveLength(1)
  })

  it('does not ask for a role without access.manage', async () => {
    const user = userEvent.setup()
    open()
    await openForm(user)
    await fill(user)
    await user.selectOptions(role(), 'auditor')
    await user.click(send())
    await screen.findByText('Invitation sent to test.person@platform.example')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks for any role the server says holds access.manage, not only Super admin', async () => {
    permissions.billing = [...permissions.billing, 'access.manage']
    const user = userEvent.setup()
    open()
    await openForm(user)
    await fill(user)
    await user.selectOptions(role(), 'billing')
    await user.click(send())
    expect(await screen.findByRole('heading', { name: 'Invite Test Person as Billing manager?' })).toBeInTheDocument()
  })

  it('refuses to invite into a role the inviter does not hold (escalation), back in the form', async () => {
    permissions.support = [...permissions.support, 'access.manage'] // Omar manages access, but is not a Super admin
    const user = userEvent.setup()
    open('support')
    const confirm = await pickSuperAdmin(user)
    await user.click(within(confirm).getByRole('button', { name: 'Send invitation' }))
    const alert = await screen.findByText(/You cannot grant what you do not hold yourself/)
    expect(alert.closest('[role="alert"]')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Invite a staff member' })).toBeInTheDocument()
    expect(staffRows()).toHaveLength(5)
    expect(platformAuditLog()).toEqual([])
  })
})
