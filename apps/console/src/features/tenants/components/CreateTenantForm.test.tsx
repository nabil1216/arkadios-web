import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoutes } from '@/test/render'
import type { TenantOptions } from '../api/types'
import { CreateTenantForm } from './CreateTenantForm'

const options: TenantOptions = {
  plans: [
    { id: 'essentials', name: 'Essentials', blurb: 'Directory and service history', trialDays: 14 },
    { id: 'professional', name: 'Professional', blurb: 'Adds workflows, reports, AI', trialDays: 30 },
    { id: 'enterprise', name: 'Enterprise', blurb: 'Adds integrations and audit', trialDays: 30 },
  ],
  regions: [
    { id: 'us-east', name: 'US East' },
    { id: 'us-west', name: 'US West' },
    { id: 'eu-frankfurt', name: 'EU Frankfurt' },
  ],
  baseDomain: 'platform.example',
}

let fetchMock: ReturnType<typeof vi.fn>
const problem = (status: number, body: object) =>
  new Response(JSON.stringify({ status, ...body }), { status, headers: { 'Content-Type': 'application/problem+json' } })
const accepted = () =>
  new Response(JSON.stringify({ id: '11111111-2222-4333-8444-555555555555' }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })

function setup() {
  const onAccepted = vi.fn()
  const onCancel = vi.fn()
  renderRoutes([{ path: '/', element: <CreateTenantForm options={options} onAccepted={onAccepted} onCancel={onCancel} /> }], '/')
  return { onAccepted, onCancel, user: userEvent.setup() }
}

const field = (label: string) => screen.getByLabelText(label)
const submit = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Create tenant' }))

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(field('Company name'), 'Harbor Lane Advisors')
  await user.type(field('First admin email'), 'it@harborlane.example')
}

describe('CreateTenantForm', () => {
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(accepted())
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  describe('fields', () => {
    it('has the demo fields with their defaults: Professional, 50 users, first region', () => {
      setup()
      expect(field('Company name')).toHaveValue('')
      expect(field('Domain')).toHaveValue('')
      expect(field('Plan')).toHaveValue('professional')
      expect(field('User limit')).toHaveValue(50)
      expect(field('Hosting region')).toHaveValue('us-east')
      expect(field('First admin email')).toHaveValue('')
      expect(field('First admin email')).toHaveAttribute('type', 'email')
    })

    it('lists the plans and regions it was given', () => {
      setup()
      const optionsOf = (label: string) => Array.from((field(label) as HTMLSelectElement).options).map((o) => o.textContent)
      expect(optionsOf('Plan')).toEqual(['Essentials', 'Professional', 'Enterprise'])
      expect(optionsOf('Hosting region')).toEqual(['US East', 'US West', 'EU Frankfurt'])
    })

    it('shows the base domain after the domain field, and the demo hints', () => {
      setup()
      expect(screen.getByText('.platform.example')).toBeInTheDocument()
      expect(screen.getByText('The tenant signs in here. It also names the database.')).toBeInTheDocument()
      expect(screen.getByText("Where this tenant's database is hosted.")).toBeInTheDocument()
      expect(field('Domain')).toHaveAccessibleDescription('The tenant signs in here. It also names the database.')
    })

    it('updates the plan hint when the plan changes', async () => {
      const { user } = setup()
      expect(screen.getByText('Adds workflows, reports, AI. Starts with a 30-day trial.')).toBeInTheDocument()
      await user.selectOptions(field('Plan'), 'essentials')
      expect(screen.getByText('Directory and service history. Starts with a 14-day trial.')).toBeInTheDocument()
      await user.selectOptions(field('Plan'), 'enterprise')
      expect(screen.getByText('Adds integrations and audit. Starts with a 30-day trial.')).toBeInTheDocument()
    })
  })

  describe('domain', () => {
    it('follows the company name until it is edited', async () => {
      const { user } = setup()
      await user.type(field('Company name'), 'Marlow & Finch Partners')
      expect(field('Domain')).toHaveValue('marlow-and-finch-partners')
      await user.type(field('Company name'), ' Ltd')
      expect(field('Domain')).toHaveValue('marlow-and-finch-partners-ltd'.slice(0, 30).replace(/-$/, ''))
    })

    it('stops following once the person types in it, and lowercases what they type', async () => {
      const { user } = setup()
      await user.type(field('Company name'), 'Harbor Lane')
      await user.clear(field('Domain'))
      await user.type(field('Domain'), 'My-Firm')
      expect(field('Domain')).toHaveValue('my-firm')
      await user.type(field('Company name'), ' Advisors')
      expect(field('Domain')).toHaveValue('my-firm')
    })

    it('keeps the suggestion within 30 characters', async () => {
      const { user } = setup()
      await user.type(field('Company name'), 'Sterling Hollow Family Office Trust Company')
      expect((field('Domain') as HTMLInputElement).value.length).toBeLessThanOrEqual(30)
    })
  })

  describe('validation', () => {
    it('shows every message from the demo and sends nothing', async () => {
      const { user } = setup()
      await user.clear(field('User limit'))
      await submit(user)
      expect(await screen.findByText('Enter the company name.')).toBeInTheDocument()
      expect(screen.getByText('Use 3 to 30 lowercase letters, numbers, or hyphens.')).toBeInTheDocument()
      expect(screen.getByText('Enter a number from 1 to 1000.')).toBeInTheDocument()
      expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('marks the bad fields invalid, links the message to the field, and focuses the first one', async () => {
      const { user } = setup()
      await submit(user)
      await screen.findByText('Enter the company name.')
      expect(field('Company name')).toHaveAttribute('aria-invalid', 'true')
      expect(field('Company name')).toHaveAccessibleDescription('Enter the company name.')
      expect(field('Company name')).toHaveFocus()
      expect(field('Plan')).not.toHaveAttribute('aria-invalid')
      expect(screen.getAllByRole('alert').length).toBeGreaterThanOrEqual(3)
    })

    it.each([0, 1001, 2.5])('rejects a user limit of %s', async (limit) => {
      const { user } = setup()
      await fillValid(user)
      await user.clear(field('User limit'))
      await user.type(field('User limit'), String(limit))
      await submit(user)
      expect(await screen.findByText('Enter a number from 1 to 1000.')).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it.each([1, 1000])('accepts a user limit of %s', async (limit) => {
      const { user } = setup()
      await fillValid(user)
      await user.clear(field('User limit'))
      await user.type(field('User limit'), String(limit))
      await submit(user)
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    })

    it.each(['ab', 'a'.repeat(31), 'with_underscore', 'with space', '-leading'])('rejects the domain %j', async (domain) => {
      const { user } = setup()
      await fillValid(user)
      await user.clear(field('Domain'))
      await user.type(field('Domain'), domain)
      await submit(user)
      expect(await screen.findByText('Use 3 to 30 lowercase letters, numbers, or hyphens.')).toBeInTheDocument()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects a name over 100 characters', async () => {
      const { user } = setup()
      await user.type(field('Company name'), 'x'.repeat(101))
      await user.type(field('First admin email'), 'it@harborlane.example')
      await submit(user)
      expect(await screen.findByText('Use 100 characters or fewer.')).toBeInTheDocument()
    })
  })

  describe('submit', () => {
    it('sends one request even when the button is clicked twice in the same instant', async () => {
      fetchMock.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(accepted()), 100))) // still running at the second click
      const { user, onAccepted } = setup()
      await fillValid(user)
      const button = screen.getByRole('button', { name: 'Create tenant' })
      act(() => {
        fireEvent.click(button) // one act: React renders nothing between the clicks, so the button is still enabled
        fireEvent.click(button)
      })
      await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1))
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('sends the ids and numbers the server expects, then tells the parent', async () => {
      const { user, onAccepted } = setup()
      await user.type(field('Company name'), '  Harbor Lane Advisors ')
      await user.selectOptions(field('Plan'), 'enterprise')
      await user.clear(field('User limit'))
      await user.type(field('User limit'), '80')
      await user.selectOptions(field('Hosting region'), 'us-west')
      await user.type(field('First admin email'), ' it@harborlane.example ')
      await submit(user)

      await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1))
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/platform/v1/tenants')
      expect(init.method).toBe('POST')
      const body = JSON.parse(init.body)
      expect(body).toEqual({
        name: 'Harbor Lane Advisors',
        domain: 'harbor-lane-advisors',
        planId: 'enterprise',
        userLimit: 80,
        region: 'us-west',
        adminEmail: 'it@harborlane.example',
      })
      expect(typeof body.userLimit).toBe('number')
      expect(onAccepted).toHaveBeenCalledWith({ id: '11111111-2222-4333-8444-555555555555', input: body })
    })

    it('disables the button while the request is in flight', async () => {
      fetchMock.mockReturnValue(new Promise(() => {}))
      const { user } = setup()
      await fillValid(user)
      await submit(user)
      await waitFor(() => expect(screen.getByRole('button', { name: 'Create tenant' })).toBeDisabled())
    })

    it('closes through Cancel', async () => {
      const { user, onCancel } = setup()
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('server errors', () => {
    it('puts a taken domain on the domain field', async () => {
      fetchMock.mockResolvedValue(problem(409, { title: 'Conflict', errors: { domain: ['This domain is already taken.'] } }))
      const { user, onAccepted } = setup()
      await fillValid(user)
      await submit(user)
      expect(await screen.findByText('This domain is already taken.')).toBeInTheDocument()
      expect(field('Domain')).toHaveAttribute('aria-invalid', 'true')
      expect(field('Domain')).toHaveFocus()
      expect(onAccepted).not.toHaveBeenCalled()
    })

    it('maps every field error from a 400', async () => {
      fetchMock.mockResolvedValue(
        problem(400, {
          title: 'Validation',
          errors: { name: ['Server says no to the name.'], userLimit: ['Server says no to the limit.'], region: ['Choose a hosting region.'] },
        }),
      )
      const { user } = setup()
      await fillValid(user)
      await submit(user)
      expect(await screen.findByText('Server says no to the name.')).toBeInTheDocument()
      expect(screen.getByText('Server says no to the limit.')).toBeInTheDocument()
      expect(screen.getByText('Choose a hosting region.')).toBeInTheDocument()
      expect(field('Company name')).toHaveFocus()
    })

    it('lets the person fix the form and send it again', async () => {
      fetchMock.mockResolvedValueOnce(problem(409, { title: 'Conflict', errors: { domain: ['This domain is already taken.'] } }))
      const { user, onAccepted } = setup()
      await fillValid(user)
      await submit(user)
      await screen.findByText('This domain is already taken.')
      await user.clear(field('Domain'))
      await user.type(field('Domain'), 'harbor-lane-2')
      await submit(user)
      await waitFor(() => expect(onAccepted).toHaveBeenCalledTimes(1))
      expect(JSON.parse(fetchMock.mock.calls[1][1].body).domain).toBe('harbor-lane-2')
    })

    it('says so when the role cannot create tenants', async () => {
      fetchMock.mockResolvedValue(problem(403, { title: 'Forbidden', detail: 'Your role cannot change Tenants.' }))
      const { user } = setup()
      await fillValid(user)
      await submit(user)
      expect(await screen.findByRole('alert')).toHaveTextContent('Your role cannot create tenants.')
    })

    it('shows a retry message for any other failure, and keeps what was typed', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const { user } = setup()
      await fillValid(user)
      await submit(user)
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the tenant. Try again.')
      expect(field('Company name')).toHaveValue('Harbor Lane Advisors')
      expect(screen.getByRole('button', { name: 'Create tenant' })).toBeEnabled()
    })
  })
})
