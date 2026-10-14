import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toaster } from '@/components/ui/sonner'
import { ForgotPasswordDialog, RESET_REQUESTED } from './ForgotPasswordDialog'

// The real request code runs; only the network is stubbed.
let fetchMock: ReturnType<typeof vi.fn>
const problem = (status: number, body: object) =>
  new Response(JSON.stringify({ status, ...body }), { status, headers: { 'Content-Type': 'application/problem+json' } })

function setup(defaultEmail?: string) {
  const onOpenChange = vi.fn()
  render(
    <>
      <ForgotPasswordDialog open onOpenChange={onOpenChange} defaultEmail={defaultEmail} />
      <Toaster />
    </>,
  )
  return { onOpenChange, user: userEvent.setup() }
}

describe('ForgotPasswordDialog', () => {
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('explains what will happen', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Reset your password' })).toBeInTheDocument()
    expect(screen.getByText(/If it matches a staff account, we send a link/)).toBeInTheDocument()
  })

  it('validates the email before calling the server', async () => {
    const { user } = setup()
    await user.type(screen.getByLabelText('Work email'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the request, closes, and shows the same message for any account', async () => {
    const { user, onOpenChange } = setup()
    await user.type(screen.getByLabelText('Work email'), '  priya.nair@platform.example ')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/platform/v1/auth/forgot-password')
    expect(JSON.parse(init.body)).toEqual({ email: 'priya.nair@platform.example' })
    expect(init.headers.Authorization).toBeUndefined()
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(await screen.findByText(RESET_REQUESTED)).toBeInTheDocument()
  })

  it('pre-fills the email from the sign-in form', () => {
    setup('liam.carter@platform.example')
    expect(screen.getByLabelText('Work email')).toHaveValue('liam.carter@platform.example')
  })

  it('shows server field errors on the field', async () => {
    fetchMock.mockResolvedValue(problem(400, { title: 'Validation', errors: { email: ['Enter a valid email address.'] } }))
    const { user } = setup()
    await user.type(screen.getByLabelText('Work email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a valid email address.')
  })

  it('shows a retry message and stays open when the server fails', async () => {
    fetchMock.mockResolvedValue(problem(429, { title: 'Too many requests' }))
    const { user, onOpenChange } = setup()
    await user.type(screen.getByLabelText('Work email'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send the reset link. Try again.')
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('closes on Cancel', async () => {
    const { user, onOpenChange } = setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
