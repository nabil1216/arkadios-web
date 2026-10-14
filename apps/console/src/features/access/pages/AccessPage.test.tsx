import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@/features/auth/api/auth' // wires the bearer token into the API client
import type { Role } from '@/features/auth/api/types'
import { sessionStore } from '@/features/auth/hooks/session'
import { API_BASE } from '@/lib/api'
import { handlers } from '@/mocks/handlers'
import { problem } from '@/mocks/problem'
import { resetMockStaff } from '@/mocks/staff'
import { makeSession, renderRoutes } from '@/test/render'
import AccessPage from './AccessPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const USER_ID: Record<Role, string> = { admin: 'u1', support: 'u2', billing: 'u3', auditor: 'u4' }

beforeEach(() => {
  sessionStore.reset()
  resetMockStaff()
})
afterEach(resetMockStaff)

function open(role: Role = 'admin') {
  const session = makeSession(role)
  sessionStore.setSession({ ...session, accessToken: `mock-access.${USER_ID[role]}`, user: { ...session.user, id: USER_ID[role] } })
  return renderRoutes([{ path: '/access', element: <AccessPage /> }], '/access')
}

const staffRows = () => Array.from(document.querySelectorAll<HTMLElement>('tr[data-staff]'))
const rowOf = (name: string) => staffRows().find((r) => r.textContent?.includes(name))!
const loaded = async () => {
  await waitFor(() => expect(staffRows()).toHaveLength(5))
  await screen.findByRole('columnheader', { name: /Super admin/ })
}

describe('AccessPage: the staff list', () => {
  it('shows the heading and the demo description', async () => {
    open()
    expect(screen.getByRole('heading', { level: 1, name: 'Access control' })).toBeInTheDocument()
    expect(screen.getByText('Who can use the platform console, and what each role can do.')).toBeInTheDocument()
    await loaded()
  })

  it('shows each person with email, role, MFA, last active and status, and says which row is you', async () => {
    open()
    await loaded()
    expect(screen.getByText('5 people')).toBeInTheDocument()
    const dana = rowOf('Dana Whitfield')
    expect(within(dana).getByText('(you)')).toBeInTheDocument()
    expect(within(dana).getByText('dana.whitfield@platform.example')).toBeInTheDocument()
    expect(within(dana).getByLabelText('Role for Dana Whitfield')).toHaveValue('admin')
    expect(within(dana).getByText('MFA on')).toBeInTheDocument()
    expect(within(dana).getByText('Active')).toBeInTheDocument()
    expect(within(dana).getByText('12 minutes ago')).toBeInTheDocument()
    expect(within(rowOf('Omar Haddad')).queryByText('(you)')).not.toBeInTheDocument()
    expect(within(rowOf('Omar Haddad')).getByLabelText('Role for Omar Haddad')).toHaveValue('support')
  })

  it('shows an invited person as Invited, MFA not set, never active', async () => {
    open()
    await loaded()
    const sofia = rowOf('Sofia Reyes')
    expect(within(sofia).getByText('Invited')).toBeInTheDocument()
    expect(within(sofia).getByText('MFA not set')).toBeInTheDocument()
    expect(within(sofia).getByText('Not yet')).toBeInTheDocument()
  })

  it('names the roles the way the server does', async () => {
    open()
    await loaded()
    const select = within(rowOf('Priya Nair')).getByLabelText('Role for Priya Nair') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Super admin', 'Support lead', 'Billing manager', 'Auditor'])
  })

  it('shows loading rows first', async () => {
    open()
    expect(screen.getAllByTestId('staff-skeleton')).toHaveLength(5)
    await loaded()
    expect(screen.queryByTestId('staff-skeleton')).not.toBeInTheDocument()
  })

  it('shows an error with the reference, and Try again loads the list', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/staff`, () => {
        calls += 1
        if (calls === 1) return problem(500, 'server', 'Server error', { detail: 'Something broke.' })
        return HttpResponse.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } })
      }),
    )
    const user = userEvent.setup()
    open()
    const alert = await screen.findByText('Could not load the staff.')
    expect(alert.closest('[role="alert"]')).toHaveTextContent('Something broke.')
    expect(alert.closest('[role="alert"]')).toHaveTextContent(/Reference: /)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('There is no one with access yet.')).toBeInTheDocument()
  })

  it('says so when the network is down', async () => {
    server.use(http.get(`${API_BASE}/staff`, () => HttpResponse.error()))
    open()
    expect(await screen.findByText('Could not load the staff.')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong. Check your connection and try again.')).toBeInTheDocument()
  })

  it('says so when there is no one yet', async () => {
    server.use(http.get(`${API_BASE}/staff`, () => HttpResponse.json({ items: [] })))
    open()
    expect(await screen.findByText('There is no one with access yet.')).toBeInTheDocument()
    expect(screen.getByText('0 people')).toBeInTheDocument()
  })
})

describe('AccessPage: what each role can do', () => {
  it('shows a column per role with how many people are in it, and a row per area', async () => {
    open()
    await loaded()
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(heads).toEqual(expect.arrayContaining(['Super admin1 person', 'Support lead2 people', 'Billing manager1 person', 'Auditor1 person']))
    const areas = screen.getAllByRole('rowheader').map((h) => h.textContent)
    expect(areas).toEqual(['Tenants', 'Plans and modules', 'Billing', 'Transactions', 'SMS', 'Support access', 'Access control'])
  })

  it('reads every cell from the keys the server sent, not from a table in the app', async () => {
    open()
    await loaded()
    const cell = (area: string, role: string) => screen.getByLabelText(`${area} for ${role}`)
    expect(cell('Billing', 'Billing manager')).toHaveValue('manage')
    expect(cell('Billing', 'Support lead')).toHaveValue('view')
    expect(cell('Transactions', 'Support lead')).toHaveValue('none')
    expect(cell('Access control', 'Auditor')).toHaveValue('view')
    expect(cell('Access control', 'Super admin')).toHaveValue('manage')
    expect(cell('SMS', 'Support lead')).toHaveValue('manage')
  })

  it('offers No access, View only and Can change', async () => {
    open()
    await loaded()
    const select = screen.getByLabelText('Billing for Auditor') as HTMLSelectElement
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['No access', 'View only', 'Can change'])
  })

  it('follows the server when a role changes', async () => {
    server.use(
      http.get(`${API_BASE}/roles`, () =>
        HttpResponse.json({
          items: [
            { id: 'admin', name: 'Owner', locked: true, permissions: ['access.manage'], staffCount: 1, version: 1 },
            { id: 'support', name: 'Helper', locked: false, permissions: ['sms.view'], staffCount: 3, version: 4 },
          ],
        }),
      ),
    )
    open()
    expect(await screen.findByRole('columnheader', { name: /Owner/ })).toBeInTheDocument()
    expect(screen.getByLabelText('SMS for Helper')).toHaveValue('view')
    expect(screen.getByRole('columnheader', { name: /Helper/ })).toHaveTextContent('3 people')
  })

  it('shows loading cells first', async () => {
    open()
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    await loaded()
  })

  it('shows its own error with Try again, while the staff still show', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/roles`, () => {
        calls += 1
        if (calls === 1) return problem(500, 'server', 'Server error')
        return HttpResponse.json({ items: [{ id: 'admin', name: 'Super admin', locked: true, permissions: [], staffCount: 1, version: 1 }] })
      }),
    )
    const user = userEvent.setup()
    open()
    await screen.findByText('Could not load what each role can do.')
    await waitFor(() => expect(staffRows()).toHaveLength(5))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('columnheader', { name: /Super admin/ })).toBeInTheDocument()
  })
})

describe('AccessPage: sign-in security', () => {
  it('says MFA is required for everyone and gives no way to turn it off', async () => {
    open()
    await loaded()
    const panel = screen.getByRole('region', { name: 'Sign-in security' })
    expect(within(panel).getByText('MFA is required for every staff member')).toBeInTheDocument()
    expect(within(panel).getByText('Required')).toBeInTheDocument()
    expect(within(panel).queryByRole('switch')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(panel).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/require mfa/i)).not.toBeInTheDocument()
  })

  it('shows the inactivity time the server gave, read only', async () => {
    open()
    await loaded()
    const panel = screen.getByRole('region', { name: 'Sign-in security' })
    expect(within(panel).getByText('30 minutes')).toBeInTheDocument()
    expect(within(panel).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(panel).getByText('Always on')).toBeInTheDocument()
  })
})

describe('AccessPage: read only', () => {
  it('shows an auditor the same page with every control off', async () => {
    open('auditor')
    await loaded()
    for (const select of screen.getAllByRole('combobox')) expect(select).toBeDisabled()
    expect(screen.queryByRole('button', { name: /invite/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deactivate|remove|resend/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /save|discard/i })).not.toBeInTheDocument()
  })
})
