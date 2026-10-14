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
import { makeSession, renderRoutes } from '@/test/render'
import TenantsPage from './TenantsPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const USER_ID: Record<Role, string> = { admin: 'u1', support: 'u2', billing: 'u3', auditor: 'u4' }
const NAMES = [
  'Arkadios Home Office',
  'Cobalt Ridge Wealth',
  'Marlow & Finch Partners',
  'Northwind Advisory Group',
  'Quillon Trust Company',
  'Sterling Hollow Family Office',
]

function open(search = '', role: Role = 'admin') {
  const session = makeSession(role)
  sessionStore.setSession({ ...session, accessToken: `mock-access.${USER_ID[role]}`, user: { ...session.user, id: USER_ID[role] } })
  return renderRoutes([{ path: '/tenants', element: <TenantsPage /> }], '/tenants' + search)
}

/** Names of the tenants in the table, in order. */
const shown = () => screen.queryAllByRole('row').slice(1).map((r) => within(r).queryByRole('strong')?.textContent).filter(Boolean)
const rowCount = () => document.querySelectorAll('#t-body tr[data-id]').length
const searchOf = (router: { state: { location: { search: string } } }) => router.state.location.search

describe('TenantsPage list', () => {
  beforeEach(() => sessionStore.reset())

  it('shows the heading, the description and the six tenants sorted by name', async () => {
    open()
    expect(screen.getByRole('heading', { name: 'Tenants' })).toBeInTheDocument()
    expect(screen.getByText('Each tenant has its own domain, database, plan, and user limit.')).toBeInTheDocument()
    await waitFor(() => expect(rowCount()).toBe(6))
    expect(shown()).toEqual(NAMES)
  })

  it('shows each tenant as the demo does', async () => {
    open()
    const row = (await screen.findByText('Cobalt Ridge Wealth', { selector: 'strong' })).closest('tr')!
    expect(within(row).getByText(/^Created \w{3} \d{1,2}, \d{4}$/)).toBeInTheDocument()
    expect(within(row).getByText('cobalt-ridge.platform.example')).toBeInTheDocument()
    expect(within(row).getByText('tenant_cobalt_ridge')).toBeInTheDocument()
    expect(within(row).getByText('Professional')).toBeInTheDocument()
    expect(within(row).getByText('47 of 50')).toBeInTheDocument()
    expect(within(row).getByText('Active')).toBeInTheDocument()
  })

  it('shows loading rows first, then the data', async () => {
    open()
    expect(screen.getAllByTestId('tenant-skeleton')).toHaveLength(5)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    await waitFor(() => expect(rowCount()).toBe(6))
    expect(screen.queryByTestId('tenant-skeleton')).not.toBeInTheDocument()
  })
})

describe('TenantsPage states', () => {
  beforeEach(() => sessionStore.reset())

  it('shows an error with the reference and retries', async () => {
    server.use(
      http.get(`${API_BASE}/tenants`, () => problem(500, 'server', 'Server error', { detail: 'The database is not available.' }), { once: true }),
    )
    const user = userEvent.setup()
    open()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load tenants.')
    expect(alert).toHaveTextContent('The database is not available.')
    expect(alert).toHaveTextContent(/Reference: [0-9a-f-]{36}/)
    expect(screen.queryByTestId('tenant-skeleton')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(rowCount()).toBe(6))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a plain message when the server cannot be reached', async () => {
    server.use(http.get(`${API_BASE}/tenants`, () => HttpResponse.error(), { once: true }))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Check your connection and try again.')
  })

  it('says so when a search or status matches nothing', async () => {
    open('?q=zzz')
    expect(await screen.findByText('No tenants match. Clear the search or choose another status.')).toBeInTheDocument()
    expect(rowCount()).toBe(0)
  })

  it('says so when there are no tenants at all', async () => {
    server.use(http.get(`${API_BASE}/tenants`, () => HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 25 })))
    open()
    expect(await screen.findByText('There are no tenants yet.')).toBeInTheDocument()
  })

  it('falls back to the defaults for junk in the address bar', async () => {
    open('?sort=id&status=bad&page=abc&pageSize=500&q=')
    await waitFor(() => expect(rowCount()).toBe(6))
    expect(screen.getByLabelText('Filter by status')).toHaveValue('all')
    expect(shown()).toEqual(NAMES)
  })
})

describe('TenantsPage filters and URL', () => {
  beforeEach(() => sessionStore.reset())

  it('reads the filters from the address bar', async () => {
    open('?q=o&status=active&sort=-usersUsed')
    await waitFor(() => expect(rowCount()).toBe(4))
    expect(screen.getByLabelText('Search tenants')).toHaveValue('o')
    expect(screen.getByLabelText('Filter by status')).toHaveValue('active')
    expect(shown()).toEqual(['Northwind Advisory Group', 'Quillon Trust Company', 'Arkadios Home Office', 'Cobalt Ridge Wealth'])
  })

  it('searches after a pause, keeps what was typed, and writes q to the URL', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await waitFor(() => expect(rowCount()).toBe(6))
    await user.type(screen.getByLabelText('Search tenants'), 'north')
    expect(searchOf(router)).toBe('') // not yet: the person is still typing
    await waitFor(() => expect(searchOf(router)).toBe('?q=north'), { timeout: 2000 })
    await waitFor(() => expect(shown()).toEqual(['Northwind Advisory Group']))
    expect(screen.getByLabelText('Search tenants')).toHaveValue('north')
  })

  it('searches at once on Enter', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await waitFor(() => expect(rowCount()).toBe(6))
    await user.type(screen.getByLabelText('Search tenants'), 'quillon{Enter}')
    expect(searchOf(router)).toBe('?q=quillon')
  })

  it('clearing the search restores the list and leaves no q in the URL', async () => {
    const user = userEvent.setup()
    const { router } = open('?q=zzz')
    await screen.findByText(/No tenants match/)
    await user.clear(screen.getByLabelText('Search tenants'))
    await waitFor(() => expect(searchOf(router)).toBe(''), { timeout: 2000 })
    await waitFor(() => expect(rowCount()).toBe(6))
  })

  it('follows the back button: the box shows the URL again', async () => {
    const user = userEvent.setup()
    const { router } = open('?q=north')
    await waitFor(() => expect(rowCount()).toBe(1))
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'suspended')
    expect(searchOf(router)).toBe('?q=north&status=suspended')
    await router.navigate(-1)
    await waitFor(() => expect(screen.getByLabelText('Filter by status')).toHaveValue('all'))
    expect(screen.getByLabelText('Search tenants')).toHaveValue('north')
  })

  it('filters by status and writes it to the URL', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await waitFor(() => expect(rowCount()).toBe(6))
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'suspended')
    expect(searchOf(router)).toBe('?status=suspended')
    await waitFor(() => expect(shown()).toEqual(['Sterling Hollow Family Office']))
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'all')
    expect(searchOf(router)).toBe('')
    await waitFor(() => expect(rowCount()).toBe(6))
  })

  it('offers every status', async () => {
    open()
    const options = within(screen.getByLabelText('Filter by status')).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['All statuses', 'Active', 'Trial', 'Suspended', 'Offboarding'])
  })

  it('keeps the old rows on screen, marked busy, while new ones load', async () => {
    const user = userEvent.setup()
    open()
    await waitFor(() => expect(rowCount()).toBe(6))
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'trial')
    expect(rowCount()).toBe(6)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    await waitFor(() => expect(rowCount()).toBe(1))
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })
})

describe('TenantsPage sorting', () => {
  beforeEach(() => sessionStore.reset())

  const header = (name: string) => screen.getByRole('columnheader', { name })

  it('marks the sorted column with aria-sort, and only that one', async () => {
    open()
    await waitFor(() => expect(rowCount()).toBe(6))
    expect(header('Tenant')).toHaveAttribute('aria-sort', 'ascending')
    for (const name of ['Plan', 'Users', 'Status']) expect(header(name)).toHaveAttribute('aria-sort', 'none')
    expect(header('Domain')).not.toHaveAttribute('aria-sort')
    expect(header('Database')).not.toHaveAttribute('aria-sort')
  })

  it('flips the direction of the same column', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await waitFor(() => expect(rowCount()).toBe(6))
    await user.click(within(header('Tenant')).getByRole('button'))
    expect(searchOf(router)).toBe('?sort=-name')
    await waitFor(() => expect(shown()).toEqual([...NAMES].reverse()))
    expect(header('Tenant')).toHaveAttribute('aria-sort', 'descending')
    await user.click(within(header('Tenant')).getByRole('button'))
    expect(searchOf(router)).toBe('')
    await waitFor(() => expect(shown()).toEqual(NAMES))
  })

  it('starts a new column ascending, then descending', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await waitFor(() => expect(rowCount()).toBe(6))
    await user.click(within(header('Users')).getByRole('button'))
    expect(searchOf(router)).toBe('?sort=usersUsed')
    await waitFor(() => expect(shown()?.[0]).toBe('Marlow & Finch Partners')) // 18 users
    expect(header('Users')).toHaveAttribute('aria-sort', 'ascending')
    expect(header('Tenant')).toHaveAttribute('aria-sort', 'none')
    await user.click(within(header('Users')).getByRole('button'))
    expect(searchOf(router)).toBe('?sort=-usersUsed')
    await waitFor(() => expect(shown()?.[0]).toBe('Northwind Advisory Group')) // 212 users
  })

  it('sorts by plan and by status', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await waitFor(() => expect(rowCount()).toBe(6))
    await user.click(within(header('Status')).getByRole('button'))
    expect(searchOf(router)).toBe('?sort=status')
    await user.click(within(header('Plan')).getByRole('button'))
    expect(searchOf(router)).toBe('?sort=plan')
  })

  it('goes back to page 1 when the sort changes', async () => {
    const user = userEvent.setup()
    const { router } = open('?pageSize=2&page=2')
    await waitFor(() => expect(rowCount()).toBe(2))
    await user.click(within(header('Plan')).getByRole('button'))
    expect(searchOf(router)).toBe('?sort=plan&pageSize=2')
  })
})

describe('TenantsPage paging', () => {
  beforeEach(() => sessionStore.reset())

  it('hides the pager when everything fits on one page', async () => {
    open()
    await waitFor(() => expect(rowCount()).toBe(6))
    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
  })

  it('pages through the list', async () => {
    const user = userEvent.setup()
    const { router } = open('?pageSize=4')
    await waitFor(() => expect(rowCount()).toBe(4))
    const pager = screen.getByRole('navigation', { name: 'Pages' })
    expect(pager).toHaveTextContent('Showing 1 to 4 of 6')
    expect(pager).toHaveTextContent('Page 1 of 2')
    expect(within(pager).getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(within(pager).getByRole('button', { name: 'Next' }))
    expect(searchOf(router)).toBe('?page=2&pageSize=4')
    await waitFor(() => expect(shown()).toEqual(['Quillon Trust Company', 'Sterling Hollow Family Office']))
    expect(pager).toHaveTextContent('Showing 5 to 6 of 6')
    expect(within(pager).getByRole('button', { name: 'Next' })).toBeDisabled()

    await user.click(within(pager).getByRole('button', { name: 'Previous' }))
    expect(searchOf(router)).toBe('?pageSize=4')
    await waitFor(() => expect(rowCount()).toBe(4))
  })

  it('goes back to page 1 when the filter changes', async () => {
    const user = userEvent.setup()
    const { router } = open('?pageSize=2&page=2')
    await waitFor(() => expect(rowCount()).toBe(2))
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'active')
    expect(searchOf(router)).toBe('?status=active&pageSize=2')
  })

  it('moves to the last page when the address bar asks for one past the end', async () => {
    const { router } = open('?page=9&pageSize=4')
    await waitFor(() => expect(searchOf(router)).toBe('?page=2&pageSize=4'))
    await waitFor(() => expect(rowCount()).toBe(2))
  })

  it('hides the pager when a filter leaves one page', async () => {
    open('?pageSize=4&status=active')
    await waitFor(() => expect(rowCount()).toBe(4))
    expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
  })
})

describe('TenantsPage permissions', () => {
  beforeEach(() => sessionStore.reset())

  it('offers Manage and Create tenant to a role with tenants.manage', async () => {
    open('', 'admin')
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Manage / })).toHaveLength(6))
    expect(screen.getByRole('button', { name: 'Manage Northwind Advisory Group' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create tenant/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^View / })).not.toBeInTheDocument()
  })

  it.each<Role>(['support', 'billing', 'auditor'])('%s sees View, and no Create tenant', async (role) => {
    open('', role)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(6))
    expect(screen.queryByRole('button', { name: /^Manage / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create tenant/ })).not.toBeInTheDocument()
  })

  it('does not render Sign in as', async () => {
    open('', 'support')
    await waitFor(() => expect(rowCount()).toBe(6))
    expect(screen.queryByRole('button', { name: /Sign in as/i })).not.toBeInTheDocument()
  })

  it('marks Manage and Create tenant as coming in a later step, and they do nothing', async () => {
    const user = userEvent.setup()
    const { router } = open('', 'admin')
    const create = await screen.findByRole('button', { name: /Create tenant/ })
    const manage = await screen.findByRole('button', { name: 'Manage Cobalt Ridge Wealth' })
    for (const button of [create, manage]) {
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).toHaveAttribute('title', 'Coming in a later step')
      expect(button).toHaveAccessibleDescription('Coming in a later step')
      await user.click(button)
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(searchOf(router)).toBe('')
  })
})
