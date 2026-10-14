import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRoutes } from '@/test/render'
import { clearResetToken } from '../hooks/resetToken'
import ResetPasswordPage from './ResetPasswordPage'

const routes = [
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/login', element: <p>Sign in page</p> },
]

const GOOD = 'correct horse battery'
let fetchMock: ReturnType<typeof vi.fn>
const problem = (status: number, body: object) =>
  new Response(JSON.stringify({ status, ...body }), { status, headers: { 'Content-Type': 'application/problem+json' } })

function open(hash = '#token=tok-123') {
  window.history.replaceState(null, '', '/reset-password' + hash)
  return renderRoutes(routes, '/reset-password' + hash)
}

async function fill(newPassword: string, confirm = newPassword) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('New password'), newPassword)
  await user.type(screen.getByLabelText('Confirm new password'), confirm)
  await user.click(screen.getByRole('button', { name: 'Set new password' }))
  return user
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    clearResetToken()
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    window.history.replaceState(null, '', '/')
  })

  it('shows the form when the link has a token, and removes the token from the address bar', () => {
    open()
    expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('type', 'password')
    expect(window.location.hash).toBe('')
    expect(window.location.href).not.toContain('tok-123')
  })

  it('shows a generic invalid-link state when there is no token', () => {
    open('')
    expect(screen.getByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.')
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login')
  })

  it('requires at least 12 characters', async () => {
    open()
    await fill('short-pass')
    expect(await screen.findByRole('alert')).toHaveTextContent('Use at least 12 characters.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('accepts exactly 12 characters', async () => {
    open()
    await fill('abcdefghijkl')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
  })

  it('requires the two passwords to match', async () => {
    open()
    await fill(GOOD, GOOD + 'x')
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends only the token and the new password, without credentials or the CSRF header', async () => {
    open('#token=tok-123')
    await fill(GOOD)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/platform/v1/auth/reset-password')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ token: 'tok-123', newPassword: GOOD })
    expect(init.headers.Authorization).toBeUndefined()
    expect(init.headers['X-Requested-With']).toBeUndefined()
  })

  it('shows a success state with a link to sign in, and does not sign the user in', async () => {
    open()
    await fill(GOOD)
    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument()
    expect(screen.getByText(/still be asked for an authentication code/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    expect(fetchMock).toHaveBeenCalledTimes(1) // no sign-in or refresh call
  })

  it('forgets the token after success', async () => {
    const { unmount } = open()
    await fill(GOOD)
    await screen.findByRole('heading', { name: 'Password changed' })
    unmount()
    window.history.replaceState(null, '', '/reset-password')
    renderRoutes(routes, '/reset-password')
    expect(screen.getByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.')
  })

  it('shows a weak-password error from the server on the new password field', async () => {
    fetchMock.mockResolvedValue(
      problem(400, { title: 'Validation', errors: { newPassword: ['This password has appeared in a data breach. Choose another.'] } }),
    )
    open()
    await fill('password1234')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('This password has appeared in a data breach.')
    expect(screen.getByLabelText('New password')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeInTheDocument() // form stays
  })

  it('shows the generic invalid-link state when the server rejects the token', async () => {
    fetchMock.mockResolvedValue(problem(400, { title: 'Invalid reset link', detail: 'This reset link is invalid or has expired.' }))
    open()
    await fill(GOOD)
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.')
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })

  it('shows a retry message and keeps the form when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    open()
    await fill(GOOD)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the password. Try again.')
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
  })
})
