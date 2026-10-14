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

beforeEach(() => {
  sessionStore.reset()
  resetMockStaff()
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})
afterEach(() => {
  fetchSpy.mockRestore()
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

const writes = (method: string) =>
  fetchSpy.mock.calls
    .filter(([, init]) => init?.method === method)
    .map(([url, init]) => ({ url: String(url), body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined }))
const staffRows = () => Array.from(document.querySelectorAll<HTMLElement>('tr[data-staff]'))
const rowOf = (name: string) => staffRows().find((r) => r.textContent?.includes(name))!
const roleSelect = (name: string) => screen.getByLabelText(`Role for ${name}`) as HTMLSelectElement
/** Staff rows, the roles, and (for a manager) the row buttons, which wait for the roles and the permissions. */
const loaded = async () => {
  await waitFor(() => expect(staffRows()).toHaveLength(5))
  await screen.findByRole('columnheader', { name: /Super admin/ })
  await screen.findAllByRole('button', { name: /^Deactivate/ })
}
const dialog = () => screen.findByRole('alertdialog')

describe('row actions', () => {
  it('gives a manager a role select per person, buttons that fit each status, and nothing on their own row', async () => {
    open()
    await loaded()
    expect(roleSelect('Dana Whitfield')).toBeDisabled() // yourself
    expect(within(rowOf('Dana Whitfield')).queryByRole('button')).not.toBeInTheDocument()
    expect(roleSelect('Omar Haddad')).toBeEnabled()
    expect(within(rowOf('Omar Haddad')).getByRole('button', { name: 'Deactivate Omar Haddad' })).toBeInTheDocument()
    expect(within(rowOf('Omar Haddad')).getByRole('button', { name: 'Remove Omar Haddad' })).toBeInTheDocument()
    expect(within(rowOf('Omar Haddad')).queryByRole('button', { name: /Reactivate|Resend/ })).not.toBeInTheDocument()
    const sofia = within(rowOf('Sofia Reyes'))
    expect(sofia.getByRole('button', { name: 'Resend invite Sofia Reyes' })).toBeInTheDocument()
    expect(sofia.queryByRole('button', { name: /Deactivate/ })).not.toBeInTheDocument()
    expect(sofia.getByRole('button', { name: 'Remove Sofia Reyes' })).toBeInTheDocument()
  })

  it('shows a read-only role the table with every control off', async () => {
    open('auditor')
    await waitFor(() => expect(staffRows()).toHaveLength(5))
    await screen.findByRole('columnheader', { name: /Super admin/ })
    await waitFor(() => expect(roleSelect('Omar Haddad')).toBeDisabled())
    expect(screen.queryByRole('button', { name: /Deactivate|Remove|Resend|Reactivate/ })).not.toBeInTheDocument()
  })

  it('changes a role at once when it takes nothing away, and says so', async () => {
    permissions.auditor = ['tenants.view'] // everything an Auditor holds, the Support lead holds too
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(roleSelect('Liam Carter'), 'support')
    expect(await screen.findByText('Liam Carter is now Support lead')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(writes('PATCH')).toEqual([{ url: `${API_BASE}/staff/u4`, body: { role: 'support', version: 1 } }])
    await waitFor(() => expect(roleSelect('Liam Carter')).toHaveValue('support'))
  })

  it('resends an invitation without asking, and says so', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Resend invite Sofia Reyes' }))
    expect(await screen.findByText('Invitation sent again to sofia.reyes@platform.example')).toBeInTheDocument()
    expect(writes('POST').map((w) => w.url)).toEqual([`${API_BASE}/staff/u5/resend-invite`])
  })

  it('reactivates without asking', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Deactivate Liam Carter' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Deactivate' }))
    await user.click(await screen.findByRole('button', { name: 'Reactivate Liam Carter' }))
    expect(await screen.findByText('Liam Carter is active again')).toBeInTheDocument()
    expect(writes('PATCH')[1].body).toEqual({ status: 'active', version: 2 })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('demoting asks first', () => {
  const pickBillingToAuditor = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.selectOptions(roleSelect('Priya Nair'), 'auditor')
    return dialog()
  }

  it('names the person, the new role and what they lose, with Cancel focused first', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    const confirm = await pickBillingToAuditor(user)
    expect(within(confirm).getByRole('heading', { name: 'Change Priya Nair to Auditor?' })).toBeInTheDocument()
    expect(within(confirm).getByText('Priya Nair will lose:')).toBeInTheDocument()
    expect(within(confirm).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Change billing', 'Change transactions'])
    expect(within(confirm).getByText(/signed out when you confirm/)).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(writes('PATCH')).toEqual([])
  })

  it('changes nothing on Cancel, and the select goes back', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    const confirm = await pickBillingToAuditor(user)
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(roleSelect('Priya Nair')).toHaveValue('billing')
    expect(writes('PATCH')).toEqual([])
  })

  it('changes nothing on Escape', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await pickBillingToAuditor(user)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(writes('PATCH')).toEqual([])
  })

  it('saves on confirm with the version it loaded, and says so', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    const confirm = await pickBillingToAuditor(user)
    await user.click(within(confirm).getByRole('button', { name: 'Change role' }))
    expect(await screen.findByText('Priya Nair is now Auditor')).toBeInTheDocument()
    expect(writes('PATCH')).toEqual([{ url: `${API_BASE}/staff/u3`, body: { role: 'auditor', version: 1 } }])
    await waitFor(() => expect(roleSelect('Priya Nair')).toHaveValue('auditor'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('sends one request when Change role is clicked twice in the same instant', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    const confirm = await pickBillingToAuditor(user)
    const button = within(confirm).getByRole('button', { name: 'Change role' })
    act(() => {
      fireEvent.click(button) // one act: React renders nothing between the clicks, so the button is still enabled
      fireEvent.click(button)
    })
    await screen.findByText('Priya Nair is now Auditor')
    expect(writes('PATCH')).toHaveLength(1)
  })

  it('writes the audit entry with the old and the new role', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    const confirm = await pickBillingToAuditor(user)
    await user.click(within(confirm).getByRole('button', { name: 'Change role' }))
    await screen.findByText('Priya Nair is now Auditor')
    expect(platformAuditLog()[0]).toMatchObject({ actorName: 'Dana Whitfield', action: 'staff.role-changed', changes: [{ field: 'role', old: 'billing', new: 'auditor' }] })
  })
})

describe('handing out access.manage asks first', () => {
  it('says what the role can do, even though nothing is lost', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(roleSelect('Omar Haddad'), 'admin')
    const confirm = await dialog()
    expect(within(confirm).getByRole('heading', { name: 'Change Omar Haddad to Super admin?' })).toBeInTheDocument()
    expect(within(confirm).getByText(/Super admin can change who has access to this console and what every role can do\. Omar Haddad will be able to do that too\./)).toBeInTheDocument()
    expect(within(confirm).queryByText(/will lose/)).not.toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(confirm).getByRole('button', { name: 'Change role' }))
    expect(await screen.findByText('Omar Haddad is now Super admin')).toBeInTheDocument()
  })
})

describe('deactivating and removing ask first', () => {
  it('asks before deactivating, naming the person and everything their role lets them do', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Deactivate Omar Haddad' }))
    const confirm = await dialog()
    expect(within(confirm).getByRole('heading', { name: 'Deactivate Omar Haddad?' })).toBeInTheDocument()
    expect(within(confirm).getByText(/can no longer sign in, and is signed out when you confirm/)).toBeInTheDocument()
    expect(within(confirm).getByText('Omar Haddad will lose, as Support lead:')).toBeInTheDocument()
    expect(within(confirm).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'View tenants',
      'View plans and modules',
      'View billing',
      'Change sms',
      'Change support access',
    ])
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(writes('PATCH')).toEqual([])
    await user.click(within(confirm).getByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByText('Omar Haddad was deactivated')).toBeInTheDocument()
    expect(writes('PATCH')).toEqual([{ url: `${API_BASE}/staff/u2`, body: { status: 'deactivated', version: 1 } }])
    await waitFor(() => expect(within(rowOf('Omar Haddad')).getByText('Deactivated')).toBeInTheDocument())
    expect(roleSelect('Omar Haddad')).toBeDisabled()
    expect(within(rowOf('Omar Haddad')).getByRole('button', { name: 'Reactivate Omar Haddad' })).toBeInTheDocument()
  })

  it('does nothing when deactivating is cancelled', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Deactivate Omar Haddad' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(writes('PATCH')).toEqual([])
    expect(within(rowOf('Omar Haddad')).getByText('Active')).toBeInTheDocument()
  })

  it('asks before removing, then removes the person with the version it loaded', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Remove Priya Nair' }))
    const confirm = await dialog()
    expect(within(confirm).getByRole('heading', { name: 'Remove Priya Nair?' })).toBeInTheDocument()
    expect(within(confirm).getByText(/loses access to this console for good/)).toBeInTheDocument()
    expect(within(confirm).getByText('Priya Nair will lose, as Billing manager:')).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }))
    expect(await screen.findByText('Priya Nair was removed')).toBeInTheDocument()
    expect(writes('DELETE')).toEqual([{ url: `${API_BASE}/staff/u3?version=1`, body: undefined }])
    await waitFor(() => expect(staffRows()).toHaveLength(4))
    expect(screen.getByText('4 people')).toBeInTheDocument()
  })

  it('says an invited person has not signed in, rather than listing what they would lose', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Remove Sofia Reyes' }))
    const confirm = await dialog()
    expect(within(confirm).getByText(/has not signed in yet\. The invitation stops working/)).toBeInTheDocument()
    expect(within(confirm).queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('sends one request when Remove is clicked twice in the same instant', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Remove Priya Nair' }))
    const button = within(await dialog()).getByRole('button', { name: 'Remove' })
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    await screen.findByText('Priya Nair was removed')
    expect(writes('DELETE')).toHaveLength(1)
  })

  it('keeps the dialog off while the request runs, so it cannot be closed or sent again', async () => {
    server.use(
      http.delete(`${API_BASE}/staff/:id`, async () => {
        await new Promise((r) => setTimeout(r, 300))
        return problem(500, 'server', 'Server error')
      }),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Remove Priya Nair' }))
    const confirm = await dialog()
    const remove = within(confirm).getByRole('button', { name: 'Remove' })
    await user.click(remove)
    await waitFor(() => expect(remove).toBeDisabled())
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(await within(confirm).findByRole('alert')).toHaveTextContent('Could not make the change. Try again.')
    expect(remove).toBeEnabled()
    expect(writes('DELETE')).toHaveLength(1)
  })
})

describe('when the server says no', () => {
  const type = (slug: string) => `https://errors.arkadious.example/${slug}`

  it('shows the server\'s sentence for the last admin in the dialog, which stays open, and changes nothing', async () => {
    server.use(
      http.patch(`${API_BASE}/staff/:id`, () =>
        problem(409, 'access/last-admin', 'Not allowed', {
          detail: 'This is the last active person with access to Access control. Make someone else a Super admin first.',
        }),
      ),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Deactivate Omar Haddad' }))
    const confirm = await dialog()
    await user.click(within(confirm).getByRole('button', { name: 'Deactivate' }))
    expect(await within(confirm).findByRole('alert')).toHaveTextContent(
      'This is the last active person with access to Access control. Make someone else a Super admin first.',
    )
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(within(rowOf('Omar Haddad')).getByText('Active')).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('shows the server\'s sentence for changing your own access', async () => {
    server.use(
      http.patch(`${API_BASE}/staff/:id`, () =>
        problem(409, 'access/self-lockout', 'Not allowed', { detail: 'You cannot remove your own access to Access control. Ask another Super admin to do it.' }),
      ),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Deactivate Omar Haddad' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You cannot remove your own access to Access control. Ask another Super admin to do it.')
  })

  it('refuses to hand out a role the person does not hold (escalation), from the real rules', async () => {
    permissions.support = [...permissions.support, 'access.manage'] // Omar can manage access, but not as a Super admin
    const user = userEvent.setup()
    open('support')
    await waitFor(() => expect(staffRows()).toHaveLength(5))
    await screen.findAllByRole('button', { name: /^Deactivate/ })
    await user.selectOptions(roleSelect('Liam Carter'), 'admin')
    const confirm = await dialog()
    await user.click(within(confirm).getByRole('button', { name: 'Change role' }))
    const alert = await within(confirm).findByRole('alert')
    expect(alert).toHaveTextContent('You cannot grant what you do not hold yourself')
    expect(alert).toHaveTextContent('tenants.manage')
    expect(roleSelect('Liam Carter')).toHaveValue('auditor')
    expect(platformAuditLog()).toEqual([])
  })

  it('shows a refusal without a question in the banner, and the select goes back', async () => {
    permissions.auditor = ['tenants.view']
    server.use(
      http.patch(`${API_BASE}/staff/:id`, () => problem(409, 'access/escalation', 'Not allowed', { detail: 'You cannot grant what you do not hold yourself (x).' }),
      ),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(roleSelect('Liam Carter'), 'support')
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('You cannot grant what you do not hold yourself (x).')
    await waitFor(() => expect(roleSelect('Liam Carter')).toHaveValue('auditor'))
    await user.click(within(banner).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('closes the dialog and says it was changed by someone else when the version is stale', async () => {
    server.use(
      http.patch(`${API_BASE}/staff/:id`, () =>
        problem(409, 'conflict', 'Conflict', { detail: 'This person was changed by someone else.', errors: { version: ['This person was changed by someone else. Reload to see the latest.'] } }),
      ),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Deactivate Omar Haddad' }))
    await user.click(within(await dialog()).getByRole('button', { name: 'Deactivate' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('alert')).toHaveTextContent('This was changed by someone else. The list now shows the latest')
    expect(type('conflict')).toContain('conflict')
  })

  it('shows a plain line when the server cannot be reached', async () => {
    server.use(http.post(`${API_BASE}/staff/:id/resend-invite`, () => problem(500, 'server', 'Server error')))
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(screen.getByRole('button', { name: 'Resend invite Sofia Reyes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send the invitation again. Try again.')
  })
})
