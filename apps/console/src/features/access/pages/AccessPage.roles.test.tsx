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

let currentRole: Role = 'admin'

function open(role: Role = 'admin') {
  currentRole = role
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

const puts = () =>
  fetchSpy.mock.calls
    .filter(([, init]) => init?.method === 'PUT')
    .map(([url, init]) => ({ url: String(url).replace(API_BASE, ''), body: JSON.parse(String(init?.body)) as { permissions: string[]; version: number } }))
const permissionReads = () => fetchSpy.mock.calls.filter(([url, init]) => String(url).endsWith('/permissions') && (init?.method ?? 'GET') === 'GET').length
const cell = (area: string, role: string) => screen.getByLabelText(`${area} for ${role}`) as HTMLSelectElement
const save = () => screen.getByRole('button', { name: 'Save changes' })
const discard = () => screen.getByRole('button', { name: 'Discard' })
const loaded = async () => {
  await screen.findByRole('columnheader', { name: /Super admin/ })
  if (currentRole === 'admin' || currentRole === 'support') await screen.findByRole('button', { name: 'Save changes' })
}
const dialog = () => screen.findByRole('alertdialog')

describe('role matrix: editing', () => {
  it('lets a manager edit every column but the locked Super admin one', async () => {
    open()
    await loaded()
    expect(cell('Billing', 'Super admin')).toBeDisabled()
    for (const area of ['Tenants', 'Plans and modules', 'Billing', 'Transactions', 'SMS', 'Support access', 'Access control']) {
      expect(cell(area, 'Super admin')).toBeDisabled()
      expect(cell(area, 'Support lead')).toBeEnabled()
      expect(cell(area, 'Billing manager')).toBeEnabled()
      expect(cell(area, 'Auditor')).toBeEnabled()
    }
    expect(screen.getByRole('columnheader', { name: /Super admin/ })).toHaveTextContent('Locked')
  })

  it('keeps every cell off, and has no Save or Discard, for a read-only role', async () => {
    open('auditor')
    await loaded()
    await waitFor(() => expect(cell('Billing', 'Support lead')).toBeDisabled())
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument()
  })

  it('keeps Save and Discard off until something changes, and off again when it is put back', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    expect(save()).toBeDisabled()
    expect(discard()).toBeDisabled()
    await user.selectOptions(cell('SMS', 'Billing manager'), 'view')
    expect(save()).toBeEnabled()
    expect(discard()).toBeEnabled()
    await user.selectOptions(cell('SMS', 'Billing manager'), 'none')
    expect(save()).toBeDisabled()
  })

  it('discards the edits and says so', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('SMS', 'Billing manager'), 'view')
    await user.selectOptions(cell('Tenants', 'Auditor'), 'manage')
    await user.click(discard())
    expect(await screen.findByText('Changes discarded')).toBeInTheDocument()
    expect(cell('SMS', 'Billing manager')).toHaveValue('none')
    expect(cell('Tenants', 'Auditor')).toHaveValue('view')
    expect(save()).toBeDisabled()
    expect(puts()).toEqual([])
  })

  it('saves a change that takes nothing away at once: only the changed role, the highest key per area, the version it loaded', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('SMS', 'Billing manager'), 'view')
    await user.click(save())
    expect(await screen.findByText('Role changes saved')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(puts()).toEqual([
      { url: '/roles/billing/permissions', body: { permissions: ['tenants.view', 'plans.view', 'billing.manage', 'transactions.manage', 'sms.view'], version: 1 } },
    ])
    await waitFor(() => expect(save()).toBeDisabled())
    expect(cell('SMS', 'Billing manager')).toHaveValue('view')
  })

  it('sends the next version on the next save', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('SMS', 'Billing manager'), 'view')
    await user.click(save())
    await screen.findByText('Role changes saved')
    await user.selectOptions(cell('SMS', 'Billing manager'), 'manage')
    await user.click(save())
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(puts()[1].body.version).toBe(2)
  })

  it('reads the permission map again after a save, because what the signed-in role can do may have changed', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    const before = permissionReads()
    await user.selectOptions(cell('SMS', 'Billing manager'), 'view')
    await user.click(save())
    await screen.findByText('Role changes saved')
    await waitFor(() => expect(permissionReads()).toBeGreaterThan(before))
  })

  it('turns the whole matrix off while a save runs', async () => {
    server.use(
      http.put(`${API_BASE}/roles/:role/permissions`, async () => {
        await new Promise((r) => setTimeout(r, 300))
        return problem(500, 'server', 'Server error')
      }),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('SMS', 'Billing manager'), 'view')
    await user.click(save())
    await waitFor(() => expect(save()).toBeDisabled())
    expect(cell('SMS', 'Billing manager')).toBeDisabled()
    expect(discard()).toBeDisabled()
    expect(await screen.findByText(/Billing manager: could not be saved/)).toBeInTheDocument()
    expect(cell('SMS', 'Billing manager')).toBeEnabled()
    expect(cell('SMS', 'Billing manager')).toHaveValue('view') // the edit is still there to try again
  })

  it('sends once when Save changes is clicked twice in the same instant', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('SMS', 'Billing manager'), 'view')
    act(() => {
      fireEvent.click(save()) // one act: React renders nothing between the clicks, so Save is still enabled
      fireEvent.click(save())
    })
    await screen.findByText('Role changes saved')
    expect(puts()).toHaveLength(1)
  })

  it('writes the audit entry with the old and the new keys', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('SMS', 'Billing manager'), 'view')
    await user.click(save())
    await screen.findByText('Role changes saved')
    expect(platformAuditLog()[0]).toMatchObject({
      actorName: 'Dana Whitfield',
      action: 'role.permissions-changed',
      entityId: 'billing',
      changes: [{ field: 'permissions', old: ['tenants.view', 'plans.view', 'billing.manage', 'transactions.manage'], new: expect.arrayContaining(['sms.view']) }],
    })
  })
})

describe('role matrix: taking permissions away asks first', () => {
  it('names each role, how many people are in it and what they lose, with Cancel focused first', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Billing', 'Support lead'), 'none')
    await user.selectOptions(cell('SMS', 'Support lead'), 'view')
    await user.selectOptions(cell('Transactions', 'Billing manager'), 'none')
    await user.click(save())
    const confirm = await dialog()
    expect(within(confirm).getByRole('heading', { name: 'Take permissions away from these roles?' })).toBeInTheDocument()
    expect(within(confirm).getByText('Support lead (2 people) will lose:')).toBeInTheDocument()
    expect(within(confirm).getByText('Billing manager (1 person) will lose:')).toBeInTheDocument()
    expect(within(confirm).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['View billing', 'Change sms', 'Change transactions'])
    expect(within(confirm).getByText(/Nobody is signed out/)).toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(puts()).toEqual([])
  })

  it('saves nothing on Cancel and keeps the edit', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Billing', 'Support lead'), 'none')
    await user.click(save())
    await user.click(within(await dialog()).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(puts()).toEqual([])
    expect(cell('Billing', 'Support lead')).toHaveValue('none')
    expect(save()).toBeEnabled()
  })

  it('saves nothing on Escape', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Billing', 'Support lead'), 'none')
    await user.click(save())
    await dialog()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(puts()).toEqual([])
  })

  it('saves on confirm', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Billing', 'Support lead'), 'none')
    await user.click(save())
    await user.click(within(await dialog()).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Role changes saved')).toBeInTheDocument()
    expect(puts()).toEqual([{ url: '/roles/support/permissions', body: { permissions: ['tenants.view', 'plans.view', 'sms.manage', 'support.manage'], version: 1 } }])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('sends once when the confirm button is clicked twice in the same instant', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Billing', 'Support lead'), 'none')
    await user.click(save())
    const button = within(await dialog()).getByRole('button', { name: 'Save changes' })
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    await screen.findByText('Role changes saved')
    expect(puts()).toHaveLength(1)
  })

  it('does not ask for a change that only adds', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Billing', 'Auditor'), 'manage')
    await user.click(save())
    await screen.findByText('Role changes saved')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('counts a manage that becomes a view as losing the manage', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Billing', 'Billing manager'), 'view')
    await user.click(save())
    expect(within(await dialog()).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Change billing'])
  })
})

describe('role matrix: handing out access.manage asks first', () => {
  it('says the role will be able to change who has access, and how many people are in it', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Access control', 'Auditor'), 'manage')
    await user.click(save())
    const confirm = await dialog()
    expect(within(confirm).getByRole('heading', { name: 'Give these roles access to Access control?' })).toBeInTheDocument()
    expect(within(confirm).getByText('Auditor (1 person) will be able to change who has access to this console and what every role can do.')).toBeInTheDocument()
    expect(within(confirm).queryByText(/will lose/)).not.toBeInTheDocument()
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.click(within(confirm).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Role changes saved')).toBeInTheDocument()
    expect(puts()[0].body.permissions).toContain('access.manage')
  })
})

describe('role matrix: when the server says no', () => {
  it('shows the server\'s sentence when a role would be the last to hold access.manage, and keeps the edit', async () => {
    server.use(
      http.put(`${API_BASE}/roles/:role/permissions`, () =>
        problem(409, 'access/last-manager-role', 'Not allowed', { detail: 'This is the last role with access to Access control. Another role must keep it.' }),
      ),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Access control', 'Auditor'), 'manage')
    await user.click(save())
    await user.click(within(await dialog()).getByRole('button', { name: 'Save changes' }))
    const alert = await screen.findByText(/Auditor: This is the last role with access to Access control/)
    expect(alert.closest('[role="alert"]')).toHaveTextContent('Some changes were not saved.')
    expect(cell('Access control', 'Auditor')).toHaveValue('manage')
  })

  it('refuses to hand out a key the editor does not hold (escalation), from the real rules', async () => {
    permissions.support = [...permissions.support, 'access.manage'] // Omar manages access but cannot change tenants
    const user = userEvent.setup()
    open('support')
    await loaded()
    await user.selectOptions(cell('Tenants', 'Auditor'), 'manage')
    await user.click(save())
    const alert = await screen.findByText(/Auditor: You cannot grant what you do not hold yourself/)
    expect(alert.closest('[role="alert"]')).toBeInTheDocument()
    expect(permissions.auditor).not.toContain('tenants.manage')
    expect(platformAuditLog()).toEqual([])
  })

  it('refuses to take your own access.manage away (self lockout), from the real rules', async () => {
    permissions.support = [...permissions.support, 'access.manage']
    const user = userEvent.setup()
    open('support')
    await loaded()
    await user.selectOptions(cell('Access control', 'Support lead'), 'view')
    await user.click(save())
    await user.click(within(await dialog()).getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Support lead: You cannot remove your own access to Access control/)).toBeInTheDocument()
    expect(permissions.support).toContain('access.manage')
  })

  it('says a role was changed by someone else, and Reload roles shows the latest', async () => {
    let served = 0
    server.use(
      http.put(`${API_BASE}/roles/:role/permissions`, () =>
        problem(409, 'conflict', 'Conflict', { detail: 'This role was changed by someone else.', errors: { version: ['This role was changed by someone else. Reload to see the latest.'] } }),
      ),
      http.get(`${API_BASE}/roles`, () => {
        served += 1
        return HttpResponse.json({
          items: [
            { id: 'admin', name: 'Super admin', locked: true, permissions: ['access.manage'], staffCount: 1, version: 1 },
            { id: 'billing', name: 'Billing manager', locked: false, permissions: served > 1 ? ['sms.manage'] : ['sms.view'], staffCount: 1, version: served },
          ],
        })
      }),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.selectOptions(cell('Tenants', 'Billing manager'), 'view')
    await user.click(save())
    const alert = await screen.findByText('Billing manager was changed by someone else. Reload to see the latest.')
    await user.click(within(alert.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Reload roles' }))
    await waitFor(() => expect(cell('SMS', 'Billing manager')).toHaveValue('manage'))
    expect(cell('Tenants', 'Billing manager')).toHaveValue('none') // the old edit no longer applies to a role it was not made from
    expect(screen.queryByText(/changed by someone else/)).not.toBeInTheDocument()
  })
})
