import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/auth/api/auth' // wires the bearer token into the API client
import { sessionStore } from '@/features/auth/hooks/session'
import { API_BASE } from '@/lib/api'
import { handlers } from '@/mocks/handlers'
import { problem } from '@/mocks/problem'
import { resetMockTenants, setProvisionStepMs } from '@/mocks/tenantCreate'
import { makeSession, renderRoutes } from '@/test/render'
import { CreateTenantDrawer } from './CreateTenantDrawer'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const FLOW = { timeout: 5000 }

beforeEach(() => {
  sessionStore.reset()
  resetMockTenants()
  setProvisionStepMs(30)
  const session = makeSession('admin')
  sessionStore.setSession({ ...session, accessToken: 'mock-access.u1', user: { ...session.user, id: 'u1' } })
})
afterEach(() => {
  resetMockTenants()
  setProvisionStepMs(850)
})

function open() {
  const onOpenChange = vi.fn()
  renderRoutes([{ path: '/', element: <CreateTenantDrawer open onOpenChange={onOpenChange} /> }], '/')
  return { onOpenChange, user: userEvent.setup() }
}

const drawer = () => screen.getByRole('dialog')
const field = (label: string) => within(drawer()).getByLabelText(label)
const closed = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.some(([next]) => next === false)

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, domain?: string) {
  await screen.findByLabelText('Company name')
  await user.type(field('Company name'), 'Harbor Lane Advisors')
  if (domain) {
    await user.clear(field('Domain'))
    await user.type(field('Domain'), domain)
  }
  await user.selectOptions(field('Plan'), 'enterprise')
  await user.clear(field('User limit'))
  await user.type(field('User limit'), '80')
  await user.type(field('First admin email'), 'it@harborlane.example')
  await user.click(within(drawer()).getByRole('button', { name: 'Create tenant' }))
}

describe('CreateTenantDrawer: opening', () => {
  it('shows the title and description, loads the options, then the form', async () => {
    open()
    expect(screen.getByRole('dialog', { name: 'Create tenant' })).toBeInTheDocument()
    expect(screen.getByText('Each tenant gets its own domain and its own database.')).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Loading the form' })).toBeInTheDocument()

    await screen.findByLabelText('Company name')
    expect(screen.queryByRole('status', { name: 'Loading the form' })).not.toBeInTheDocument()
    // plans, regions and the base domain all come from the server
    expect(within(field('Plan')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Essentials', 'Professional', 'Enterprise'])
    expect(within(field('Hosting region')).getAllByRole('option').map((o) => o.textContent)).toEqual(['US East', 'US West', 'EU Frankfurt'])
    expect(within(drawer()).getByText('.platform.example')).toBeInTheDocument()
  })

  it('shows an error with Try again when the options cannot be loaded', async () => {
    server.use(http.get(`${API_BASE}/tenants/options`, () => problem(500, 'server', 'Server error'), { once: true }))
    const { user } = open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the plans and regions.')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Company name')).toBeInTheDocument()
  })

  it('closes through Cancel and through Escape before anything is sent', async () => {
    const { user, onOpenChange } = open()
    await screen.findByLabelText('Company name')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(closed(onOpenChange)).toBe(true)
    onOpenChange.mockClear()
    await user.keyboard('{Escape}')
    expect(closed(onOpenChange)).toBe(true)
  })
})

describe('CreateTenantDrawer: provisioning', () => {
  it('shows the five steps, then the ready note, and Done closes the drawer', async () => {
    const { user, onOpenChange } = open()
    await fillAndSubmit(user)

    const steps = await screen.findByRole('list')
    const items = within(steps).getAllByRole('listitem')
    expect(items.map((li) => li.textContent?.replace(/\s*\((done|in progress|waiting)\)$/, ''))).toEqual([
      'Creating the database tenant_harbor_lane_advisors',
      'Running migrations for release 2.4.0',
      'Seeding default stages, checklists, and roles',
      'Setting up the domain harbor-lane-advisors.platform.example',
      'Inviting it@harborlane.example as the first admin',
    ])
    expect(screen.queryByLabelText('Company name')).not.toBeInTheDocument()

    expect(await screen.findByRole('heading', { name: 'Harbor Lane Advisors is ready' }, FLOW)).toBeInTheDocument()
    const note = screen.getByRole('status')
    expect(note).toHaveTextContent('Workspace at harbor-lane-advisors.platform.example')
    expect(note).toHaveTextContent('An invitation went to it@harborlane.example')
    expect(note).toHaveTextContent('The trial runs for 30 days.')
    for (const li of within(screen.getByRole('list')).getAllByRole('listitem')) expect(li).toHaveAttribute('data-state', 'done')
    expect(within(drawer()).getAllByText('(done)')).toHaveLength(5)

    const manage = within(drawer()).getByRole('button', { name: 'Manage tenant' })
    expect(manage).toHaveAttribute('aria-disabled', 'true')
    expect(manage).toHaveAttribute('title', 'Coming in a later step')

    await user.click(within(drawer()).getByRole('button', { name: 'Done' }))
    expect(closed(onOpenChange)).toBe(true)
  }, 10_000)

  it('marks the first step as in progress right away', async () => {
    setProvisionStepMs(5000)
    const { user } = open()
    await fillAndSubmit(user)
    const first = (await screen.findAllByRole('listitem'))[0]
    expect(first).toHaveAttribute('data-state', 'running')
    expect(first).toHaveTextContent('(in progress)')
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('data-state', 'waiting')
  })

  it('cannot be closed while the server is still working, and can afterwards', async () => {
    setProvisionStepMs(250)
    const { user, onOpenChange } = open()
    await fillAndSubmit(user)
    await screen.findByRole('list')
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await user.click(document.querySelector('[data-slot="sheet-overlay"]')!)
    expect(closed(onOpenChange)).toBe(false)
    expect(drawer()).toBeInTheDocument()

    await screen.findByRole('heading', { name: /is ready/ }, FLOW)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(closed(onOpenChange)).toBe(true)
  }, 10_000)

  it('keeps the form when the domain is taken, and starts no provisioning', async () => {
    const { user } = open()
    await fillAndSubmit(user, 'northwind')
    expect(await screen.findByText('This domain is already taken.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(field('Company name')).toHaveValue('Harbor Lane Advisors')
  })

  it('shows a failed setup and lets the person close the panel', async () => {
    server.use(
      http.get(`${API_BASE}/tenants/:id/provisioning`, ({ params }) =>
        HttpResponse.json({
          id: params.id,
          status: 'failed',
          steps: [
            { key: 'database', label: 'Creating the database tenant_x', state: 'done' },
            { key: 'migrations', label: 'Running migrations for release 2.4.0', state: 'failed' },
            { key: 'seed', label: 'Seeding default stages, checklists, and roles', state: 'waiting' },
          ],
        }),
      ),
    )
    const { user, onOpenChange } = open()
    await fillAndSubmit(user)
    expect(await screen.findByRole('alert', {}, FLOW)).toHaveTextContent('Setting up this tenant did not finish.')
    expect(screen.getAllByRole('listitem')[1]).toHaveAttribute('data-state', 'failed')
    expect(screen.queryByRole('heading', { name: /is ready/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' })) // the drawer's own close button
    expect(closed(onOpenChange)).toBe(true)
  }, 10_000)

  it('says so when the progress cannot be read, and lets the person leave', async () => {
    server.use(http.get(`${API_BASE}/tenants/:id/provisioning`, () => problem(404, 'not-found', 'Not found')))
    const { user, onOpenChange } = open()
    await fillAndSubmit(user)
    expect(await screen.findByRole('alert', {}, FLOW)).toHaveTextContent('Could not check how far the setup got.')
    expect(within(drawer()).getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    await user.click(within(drawer()).getByRole('button', { name: 'Close' })) // the drawer's own close button
    expect(closed(onOpenChange)).toBe(true)
  }, 10_000)
})
