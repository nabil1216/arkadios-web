import { screen, waitFor, within } from '@testing-library/react'
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
import { handlers } from '@/mocks/handlers'
import { listPlans, resetMockPlans, updatePlan as updateStoredPlan } from '@/mocks/plans'
import { problem } from '@/mocks/problem'
import { makeSession, renderRoutes } from '@/test/render'
import PlansPage from './PlansPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const USER_ID: Record<Role, string> = { admin: 'u1', support: 'u2', billing: 'u3', auditor: 'u4' }
const PLAN_NAME = { essentials: 'Essentials', professional: 'Professional', enterprise: 'Enterprise' } as const
type PlanId = keyof typeof PLAN_NAME

let fetchSpy: MockInstance<typeof fetch>

beforeEach(() => {
  sessionStore.reset()
  resetMockPlans()
  fetchSpy = vi.spyOn(globalThis, 'fetch')
})
afterEach(() => {
  fetchSpy.mockRestore()
  resetMockPlans()
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
        path: '/plans',
        element: (
          <>
            <PlansPage />
            <Toaster />
          </>
        ),
      },
    ],
    '/plans',
  )
}

const sw = (module: string, plan: PlanId) => document.querySelector(`input[data-mod="${module}"][data-plan="${plan}"]`) as HTMLInputElement
const trial = (plan: PlanId) => screen.getByLabelText(`Trial days for ${PLAN_NAME[plan]}`) as HTMLInputElement
const save = () => screen.getByRole('button', { name: 'Save changes' })
const discard = () => screen.getByRole('button', { name: 'Discard' })
/** The matrix is on screen and, for a role that can edit, so are Save and Discard (they wait for permissions). */
const loaded = async () => {
  const header = await screen.findByRole('columnheader', { name: /Essentials/ })
  if (currentRole === 'admin') await screen.findByRole('button', { name: 'Save changes' })
  return header
}
const puts = () =>
  fetchSpy.mock.calls
    .filter(([, init]) => init?.method === 'PUT')
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) as { trialDays: number; version: number; modules: Record<string, boolean> } }))

describe('PlansPage: the matrix', () => {
  it('shows the heading and the demo description', async () => {
    open()
    expect(screen.getByRole('heading', { name: 'Plans and modules' })).toBeInTheDocument()
    expect(
      screen.getByText('Switch modules on or off per plan. Tenants see only what their plan includes; the rest shows locked with an upgrade prompt.'),
    ).toBeInTheDocument()
    await loaded()
  })

  it('shows each plan with its tenant count', async () => {
    open()
    const header = (name: RegExp) => screen.findByRole('columnheader', { name })
    expect(await header(/Essentials/)).toHaveTextContent('1 tenant')
    expect(await header(/Professional/)).toHaveTextContent('3 tenants')
    expect(await header(/Enterprise/)).toHaveTextContent('2 tenants')
  })

  it('shows the trial length for each plan', async () => {
    open()
    await loaded()
    expect(screen.getByText('Days before the first bill')).toBeInTheDocument()
    expect(trial('essentials')).toHaveValue(14)
    expect(trial('professional')).toHaveValue(30)
    expect(trial('enterprise')).toHaveValue(30)
    expect(trial('essentials')).toHaveAttribute('min', '0')
    expect(trial('essentials')).toHaveAttribute('max', '90')
  })

  it('lists the 11 modules with their notes, and a switch per plan labelled for screen readers', async () => {
    open()
    await loaded()
    const rows = screen.getAllByRole('row').slice(2) // header and trial length
    expect(rows).toHaveLength(11)
    expect(within(rows[0]).getByText('Firm and advisor directory')).toBeInTheDocument()
    expect(within(rows[0]).getByText('Firms, advisors, staff, custom fields')).toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(33)
    expect(screen.getByRole('switch', { name: 'Report builder on Professional' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Integrations on Professional' })).not.toBeChecked()
  })

  it('switches on what each plan includes, as the demo does', async () => {
    open()
    await loaded()
    const on = (plan: PlanId) =>
      Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-plan="${plan}"]`)).filter((i) => i.checked).map((i) => i.dataset.mod)
    expect(on('essentials')).toEqual(['directory', 'lifetime'])
    expect(on('professional')).toEqual(['directory', 'lifetime', 'workstreams', 'reports', 'dashboards', 'ai', 'sso', 'audit'])
    expect(on('enterprise')).toEqual([...on('professional'), 'integrations'])
  })

  it('shows Ticketing and Documents as coming later, with disabled switches that are off', async () => {
    open()
    await loaded()
    expect(screen.getAllByText('Coming later')).toHaveLength(2)
    for (const module of ['ticketing', 'documents']) {
      for (const plan of ['essentials', 'professional', 'enterprise'] as const) {
        expect(sw(module, plan)).toBeDisabled()
        expect(sw(module, plan)).not.toBeChecked()
      }
    }
  })
})

describe('PlansPage: states', () => {
  it('shows a loading matrix first', async () => {
    open()
    expect(screen.getAllByTestId('plans-skeleton')).toHaveLength(6)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    await loaded()
    expect(screen.queryByTestId('plans-skeleton')).not.toBeInTheDocument()
  })

  it('shows an error with the reference, and Try again loads the matrix', async () => {
    server.use(http.get(`${API_BASE}/plans`, () => problem(500, 'server', 'Server error', { detail: 'The database is not available.' }), { once: true }))
    const user = userEvent.setup()
    open()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load plans and modules.')
    expect(alert).toHaveTextContent('The database is not available.')
    expect(alert).toHaveTextContent(/Reference: [0-9a-f-]{36}/)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await loaded()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a plain message when the server cannot be reached', async () => {
    server.use(http.get(`${API_BASE}/plans`, () => HttpResponse.error(), { once: true }))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Check your connection and try again.')
  })

  it('says so when there are no plans', async () => {
    server.use(http.get(`${API_BASE}/plans`, () => HttpResponse.json({ modules: listPlans().modules, plans: [] })))
    open()
    expect(await screen.findByText('There are no plans yet.')).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })
})

describe('PlansPage: editing', () => {
  it('keeps Save and Discard off until something changes, and off again when it is put back', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    expect(save()).toBeDisabled()
    expect(discard()).toBeDisabled()
    await user.click(sw('integrations', 'professional'))
    expect(sw('integrations', 'professional')).toBeChecked()
    expect(save()).toBeEnabled()
    expect(discard()).toBeEnabled()
    await user.click(sw('integrations', 'professional'))
    expect(save()).toBeDisabled()
    expect(discard()).toBeDisabled()
  })

  it('turns Save on for a trial length change too', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.clear(trial('essentials'))
    await user.type(trial('essentials'), '21')
    expect(save()).toBeEnabled()
  })

  it('discards every change and says so', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('integrations', 'professional'))
    await user.click(sw('directory', 'essentials'))
    await user.clear(trial('essentials'))
    await user.type(trial('essentials'), '21')
    await user.click(discard())
    expect(sw('integrations', 'professional')).not.toBeChecked()
    expect(sw('directory', 'essentials')).toBeChecked()
    expect(trial('essentials')).toHaveValue(14)
    expect(save()).toBeDisabled()
    expect(await screen.findByText('Changes discarded')).toBeInTheDocument()
    expect(puts()).toHaveLength(0)
  })

  it('refuses a trial length outside 0 to 90, with a message, and blocks Save until it is fixed', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    for (const bad of ['', '91', '-1']) {
      await user.clear(trial('essentials'))
      if (bad) await user.type(trial('essentials'), bad)
      expect(await screen.findByText('Enter a number from 0 to 90.')).toBeInTheDocument()
      expect(trial('essentials')).toHaveAttribute('aria-invalid', 'true')
      expect(trial('essentials')).toHaveAccessibleDescription('Enter a number from 0 to 90.')
      expect(save()).toBeDisabled()
    }
    await user.clear(trial('essentials'))
    await user.type(trial('essentials'), '0')
    expect(screen.queryByText('Enter a number from 0 to 90.')).not.toBeInTheDocument()
    expect(save()).toBeEnabled()
  })
})

describe('PlansPage: saving', () => {
  it('sends only the plans that changed, with the version they were loaded at, and says it saved', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('integrations', 'professional'))
    await user.clear(trial('essentials'))
    await user.type(trial('essentials'), '21')
    await user.click(save())

    expect(await screen.findByText('Plan changes saved')).toBeInTheDocument()
    const sent = puts()
    expect(sent.map((p) => p.url).sort()).toEqual(['/api/platform/v1/plans/essentials', '/api/platform/v1/plans/professional'])
    const essentials = sent.find((p) => p.url.endsWith('/essentials'))!.body
    expect(essentials).toMatchObject({ trialDays: 21, version: 1, modules: { directory: true, lifetime: true, reports: false } })
    const professional = sent.find((p) => p.url.endsWith('/professional'))!.body
    expect(professional).toMatchObject({ trialDays: 30, version: 1, modules: { integrations: true, reports: true } })
    expect(Object.keys(professional.modules)).toHaveLength(11)
    expect(sent.some((p) => p.url.endsWith('/enterprise'))).toBe(false)
  })

  it('shows what was saved, turns Save off, and sends the next version next time', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('integrations', 'professional'))
    await user.click(save())
    await screen.findByText('Plan changes saved')
    expect(sw('integrations', 'professional')).toBeChecked()
    await waitFor(() => expect(save()).toBeDisabled())
    expect(discard()).toBeDisabled()

    await user.click(sw('integrations', 'professional'))
    await user.click(save()) // integrations off again: confirm first
    await user.click(await screen.findByRole('button', { name: 'Switch off and save' }))
    await waitFor(() => expect(puts()).toHaveLength(2))
    expect(puts()[1].body.version).toBe(2)
  })

  it('disables the page while a save is running', async () => {
    server.use(
      http.put(`${API_BASE}/plans/:id`, async () => {
        await new Promise((r) => setTimeout(r, 300))
        return problem(500, 'server', 'Server error')
      }),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('integrations', 'professional'))
    await user.click(save())
    await waitFor(() => expect(save()).toBeDisabled())
    expect(sw('integrations', 'professional')).toBeDisabled()
    expect(discard()).toBeDisabled()
    await screen.findByText(/Could not save Professional/)
    expect(sw('integrations', 'professional')).toBeEnabled()
  })

  it('keeps what was saved when the page is opened again (navigate away and back)', async () => {
    const user = userEvent.setup()
    const first = open()
    await loaded()
    await user.click(sw('integrations', 'professional'))
    await user.clear(trial('essentials'))
    await user.type(trial('essentials'), '21')
    await user.click(save())
    await screen.findByText('Plan changes saved')
    first.unmount()

    open()
    await loaded()
    expect(sw('integrations', 'professional')).toBeChecked()
    expect(trial('essentials')).toHaveValue(21)
    expect(save()).toBeDisabled()
  })

  it('reports a plan that could not be saved and keeps its changes, while the others are saved', async () => {
    server.use(http.put(`${API_BASE}/plans/enterprise`, () => problem(500, 'server', 'Server error'), { once: true }))
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('integrations', 'professional'))
    await user.click(sw('ai', 'essentials'))
    await user.click(sw('integrations', 'enterprise')) // off: needs the confirm
    await user.click(save())
    await user.click(await screen.findByRole('button', { name: 'Switch off and save' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Some changes were not saved.')
    expect(alert).toHaveTextContent('Could not save Enterprise. Try again.')
    expect(alert).not.toHaveTextContent('Professional')
    expect(screen.queryByText('Plan changes saved')).not.toBeInTheDocument()
    expect(listPlans().plans.find((p) => p.id === 'professional')!.version).toBe(2) // saved
    expect(listPlans().plans.find((p) => p.id === 'enterprise')!.version).toBe(1) // not saved
    expect(sw('integrations', 'enterprise')).not.toBeChecked() // the change is still there
    expect(save()).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Reload plans' })).not.toBeInTheDocument()
  })

  it('says a plan was changed by someone else, and Reload plans shows the latest', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    // another staff member saves Professional after this page loaded
    const other = listPlans().plans.find((p) => p.id === 'professional')!
    updateStoredPlan('professional', { modules: other.modules, trialDays: 45, version: other.version })

    await user.click(sw('integrations', 'professional'))
    await user.click(save())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Professional was changed by someone else. Reload to see the latest.')
    expect(trial('professional')).toHaveValue(30) // still what this page loaded
    expect(listPlans().plans.find((p) => p.id === 'professional')!.trialDays).toBe(45) // nothing of ours applied

    await user.click(screen.getByRole('button', { name: 'Reload plans' }))
    await waitFor(() => expect(trial('professional')).toHaveValue(45))
    expect(sw('integrations', 'professional')).not.toBeChecked() // our edit is gone: start again
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(save()).toBeDisabled()
  })
})

describe('PlansPage: reloading after a conflict', () => {
  it('keeps the unsaved edits on plans that were not in conflict', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    const other = listPlans().plans.find((p) => p.id === 'professional')!
    updateStoredPlan('professional', { modules: other.modules, trialDays: 45, version: other.version })

    await user.click(sw('integrations', 'professional')) // will conflict
    await user.clear(trial('essentials')) // will not
    await user.type(trial('essentials'), '21')
    await user.click(save())
    await screen.findByText('Professional was changed by someone else. Reload to see the latest.')
    expect(listPlans().plans.find((p) => p.id === 'essentials')!.trialDays).toBe(21) // Essentials did save

    // the person edits Essentials again before reloading
    await user.clear(trial('essentials'))
    await user.type(trial('essentials'), '7')
    await user.click(screen.getByRole('button', { name: 'Reload plans' }))
    await waitFor(() => expect(trial('professional')).toHaveValue(45))
    expect(sw('integrations', 'professional')).not.toBeChecked()
    expect(trial('essentials')).toHaveValue(7) // still there
    expect(save()).toBeEnabled()
  })
})

describe('PlansPage: switching modules off', () => {
  it('asks first, naming the plan, its tenant count and the modules', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('reports', 'professional'))
    await user.click(sw('ai', 'professional'))
    await user.click(save())

    const dialog = await screen.findByRole('alertdialog', { name: 'Switch modules off for existing tenants?' })
    expect(within(dialog).getByText(/hidden and become read-only for these tenants/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Their data is not deleted/)).toBeInTheDocument()
    const item = within(dialog).getByText('Professional', { selector: 'strong' }).closest('li')!
    expect(item).toHaveTextContent('3 tenants will lose')
    expect(within(item).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Report builder', 'AI next steps'])
    expect(puts()).toHaveLength(0)
  })

  it('lists every plan that loses modules, with the right wording for one tenant', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('directory', 'essentials'))
    await user.click(sw('integrations', 'enterprise'))
    await user.click(save())
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Essentials', { selector: 'strong' }).closest('li')).toHaveTextContent('1 tenant will lose')
    expect(within(dialog).getByText('Enterprise', { selector: 'strong' }).closest('li')).toHaveTextContent('2 tenants will lose')
    expect(within(dialog).queryByText('Professional')).not.toBeInTheDocument()
  })

  it('saves nothing on Cancel, and keeps the change', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('reports', 'professional'))
    await user.click(save())
    const dialog = await screen.findByRole('alertdialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(puts()).toHaveLength(0)
    expect(sw('reports', 'professional')).not.toBeChecked()
    expect(save()).toBeEnabled()
  })

  it('cancels on Escape, with focus on Cancel first', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('reports', 'professional'))
    await user.click(save())
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(puts()).toHaveLength(0)
  })

  it('saves everything once the person confirms', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('reports', 'professional'))
    await user.click(sw('integrations', 'enterprise'))
    await user.click(save())
    await user.click(await screen.findByRole('button', { name: 'Switch off and save' }))
    expect(await screen.findByText('Plan changes saved')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(puts()).toHaveLength(2)
    expect(sw('reports', 'professional')).not.toBeChecked()
  })

  it('does not ask when a module is only switched on', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('integrations', 'professional'))
    await user.click(sw('reports', 'essentials'))
    await user.click(save())
    expect(await screen.findByText('Plan changes saved')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('does not ask for a trial length change alone', async () => {
    const user = userEvent.setup()
    open()
    await loaded()
    await user.clear(trial('professional'))
    await user.type(trial('professional'), '10')
    await user.click(save())
    expect(await screen.findByText('Plan changes saved')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('does not ask for a plan that has no tenants', async () => {
    const plans = listPlans()
    server.use(
      http.get(`${API_BASE}/plans`, () =>
        HttpResponse.json({ ...plans, plans: plans.plans.map((p) => (p.id === 'essentials' ? { ...p, tenantCount: 0 } : p)) }),
      ),
    )
    const user = userEvent.setup()
    open()
    expect(await loaded()).toHaveTextContent('0 tenants')
    await user.click(sw('directory', 'essentials'))
    await user.click(save())
    expect(await screen.findByText('Plan changes saved')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('asks only about the plans that have tenants when both kinds change', async () => {
    const plans = listPlans()
    server.use(
      http.get(`${API_BASE}/plans`, () =>
        HttpResponse.json({ ...plans, plans: plans.plans.map((p) => (p.id === 'essentials' ? { ...p, tenantCount: 0 } : p)) }),
      ),
    )
    const user = userEvent.setup()
    open()
    await loaded()
    await user.click(sw('directory', 'essentials'))
    await user.click(sw('reports', 'professional'))
    await user.click(save())
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Professional', { selector: 'strong' })).toBeInTheDocument()
    expect(within(dialog).queryByText('Essentials')).not.toBeInTheDocument()
  })
})

describe('PlansPage: permissions', () => {
  it('lets a role with plans.manage edit', async () => {
    open('admin')
    await loaded()
    expect(save()).toBeInTheDocument()
    expect(discard()).toBeInTheDocument()
    expect(sw('reports', 'professional')).toBeEnabled()
    expect(trial('essentials')).toBeEnabled()
    expect(sw('ticketing', 'professional')).toBeDisabled() // coming later stays off for everyone
  })

  it.each<Role>(['support', 'billing', 'auditor'])('%s sees the plans read-only: no Save, no Discard, every input disabled', async (role) => {
    open(role)
    await loaded()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument()
    for (const input of screen.getAllByRole('switch')) expect(input).toBeDisabled()
    for (const plan of ['essentials', 'professional', 'enterprise'] as const) expect(trial(plan)).toBeDisabled()
    // they still see what is on
    expect(sw('reports', 'professional')).toBeChecked()
    expect(sw('integrations', 'professional')).not.toBeChecked()
    expect(trial('professional')).toHaveValue(30)
  })

  it('shows the matrix to a read-only role as soon as permissions load, without an edit window', async () => {
    open('billing')
    await loaded()
    expect(screen.getAllByRole('switch').every((s) => (s as HTMLInputElement).disabled)).toBe(true)
  })
})
