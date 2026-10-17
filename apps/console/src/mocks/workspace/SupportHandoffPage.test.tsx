import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { handlers } from '../handlers'
import { staff } from '../db'
import { platformAuditLog } from '../audit'
import { resetMockStaff } from '../staff'
import { activeSessionOf, allTenantUsers, endSession, resetMockSupport, startSession } from '../support'
import { resetMockTenants } from '../tenantCreate'
import { tenantRecords } from '../tenants'
import { handoffLoader } from './loader'
import { POLL_MS, SupportHandoffPage } from './SupportHandoffPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const PATH = '/mock-workspace/support-handoff'
let fetchSpy: MockInstance<typeof fetch>
let hashWhenAsked: string[]

beforeEach(() => {
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
  hashWhenAsked = []
  const real = globalThis.fetch.bind(globalThis)
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    if (String(input).endsWith('/auth/support-exchange')) hashWhenAsked.push(window.location.hash)
    return real(input, init)
  })
})
afterEach(() => {
  fetchSpy.mockRestore()
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
})

function begin(over: Record<string, unknown> = {}) {
  const tenant = tenantRecords.find((t) => t.name === 'Northwind Advisory Group')!
  const who = allTenantUsers(tenant.id).find((u) => u.name === 'Elena Marsh')!
  const result = startSession(staff.find((u) => u.id === 'u2')!, { tenantId: tenant.id, tenantUserId: who.id, reason: 'Checklist did not create tasks after a stage move', durationMinutes: 30, mode: 'read', ...over }, 'http://localhost')
  if (!result.ok) throw new Error(result.detail)
  return result.value
}

/** Opens the page the way a new tab does: at the path, with the code in the fragment. */
function openAt(hash: string) {
  window.history.replaceState(null, '', PATH + hash)
  const router = createMemoryRouter([{ path: '/', loader: handoffLoader, Component: SupportHandoffPage, HydrateFallback: () => null }], { initialEntries: ['/'] })
  return render(<RouterProvider router={router} />)
}

describe('the stand-in workspace: opening with a code', () => {
  it('clears the fragment before it asks for anything, so the code is gone from the address', async () => {
    const { handoff } = begin()
    openAt(`#code=${handoff.code}`)
    await screen.findByRole('status')
    expect(hashWhenAsked).toEqual([''])
    expect(window.location.hash).toBe('')
    expect(window.location.href).not.toContain(handoff.code)
  })

  it('trades the code once and shows who is acting, as whom, why, for how long, and an End session button', async () => {
    const { handoff } = begin()
    openAt(`#code=${handoff.code}`)
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Omar Haddad is signed in as Elena Marsh (Read only). Reason: Checklist did not create tasks after a stage move')
    expect(banner).toHaveTextContent(/Time left (29|30):\d\d/)
    expect(screen.getByRole('button', { name: 'End session' })).toBeInTheDocument()
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith('/auth/support-exchange'))).toHaveLength(1)
    expect(platformAuditLog().map((e) => e.action)).toEqual(['support.started'])
  })

  it('shows the reason as plain text, whatever it contains', async () => {
    const reason = 'The <b>report</b> page shows <img src=x onerror=alert(1)> for one user'
    const { handoff } = begin({ reason })
    openAt(`#code=${handoff.code}`)
    expect(await screen.findByTestId('reason')).toHaveTextContent(reason)
    expect(document.querySelector('[role="status"] b, [role="status"] img')).toBeNull()
  })

  it('keeps the token out of every address and out of storage', async () => {
    const { handoff } = begin()
    openAt(`#code=${handoff.code}`)
    await screen.findByRole('status')
    expect(window.location.href).not.toMatch(/mock-support|token/)
    expect(JSON.stringify({ ...localStorage })).not.toMatch(/mock-support|mock-handoff/)
    expect(JSON.stringify({ ...sessionStorage })).not.toMatch(/mock-support|mock-handoff/)
    const sent = fetchSpy.mock.calls.map(([url]) => String(url))
    expect(sent.some((url) => url.includes('mock-handoff') || url.includes('mock-support'))).toBe(false) // never in a URL
  })

  it('shows Can edit for an edit session', async () => {
    const { handoff } = begin({ mode: 'edit' })
    openAt(`#code=${handoff.code}`)
    expect(await screen.findByRole('status')).toHaveTextContent('(Can edit)')
  })
})

describe('the stand-in workspace: a link that does not work', () => {
  it('says one thing for a wrong code', async () => {
    openAt('#code=mock-handoff.nope')
    expect(await screen.findByRole('alert')).toHaveTextContent('This support link is invalid or has expired.')
    expect(window.location.hash).toBe('')
  })

  it('says the same for no code at all, and asks for nothing', async () => {
    openAt('')
    expect(await screen.findByRole('alert')).toHaveTextContent('This support link is invalid or has expired.')
    expect(hashWhenAsked).toEqual([])
  })

  it('says the same for a code that was used, and the session ends', async () => {
    const { session, handoff } = begin()
    openAt(`#code=${handoff.code}`)
    await screen.findByRole('status')
    document.body.innerHTML = ''
    openAt(`#code=${handoff.code}`) // a second tab with the same code
    expect(await screen.findByRole('alert')).toHaveTextContent('This support link is invalid or has expired.')
    expect(activeSessionOf('u2')).toBeNull()
    expect(platformAuditLog().map((e) => e.action)).toContain('support.revoked')
    expect(session.id).toBeDefined()
  })

  it('says the same for a code that is older than 60 seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { handoff } = begin()
    vi.setSystemTime(Date.now() + 61_000)
    openAt(`#code=${handoff.code}`)
    expect(await screen.findByRole('alert')).toHaveTextContent('This support link is invalid or has expired.')
  })
})

describe('the stand-in workspace: while the session runs', () => {
  it('ends the session from the banner, and the console sees it ended by its owner', async () => {
    const { handoff } = begin()
    const user = userEvent.setup()
    openAt(`#code=${handoff.code}`)
    await user.click(await screen.findByRole('button', { name: 'End session' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('This support session has ended. You can close this tab.'))
    expect(activeSessionOf('u2')).toBeNull()
    expect(platformAuditLog().at(-1)).toMatchObject({ action: 'support.ended', actorName: 'Omar Haddad' })
  })

  it('ends once when End session is clicked twice in the same instant', async () => {
    const { handoff } = begin()
    openAt(`#code=${handoff.code}`)
    const button = await screen.findByRole('button', { name: 'End session' })
    act(() => {
      button.click()
      button.click()
    })
    await screen.findByText(/This support session has ended/)
    expect(fetchSpy.mock.calls.filter(([url]) => String(url).endsWith('/support/session/end'))).toHaveLength(1)
  })

  it('stops when the session is revoked from the console: the token no longer works', async () => {
    const { session, handoff } = begin()
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    openAt(`#code=${handoff.code}`)
    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Omar Haddad is signed in'))
    endSession(staff.find((u) => u.id === 'u1')!, session.id) // Dana revokes it
    await act(async () => void vi.advanceTimersByTime(POLL_MS))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('This support session has ended.'))
    expect(screen.queryByRole('button', { name: 'End session' })).not.toBeInTheDocument()
  })

  it('says the time is up when the countdown reaches zero', async () => {
    const { handoff } = begin({ durationMinutes: 15 })
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    openAt(`#code=${handoff.code}`)
    await vi.waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('is signed in'))
    await act(async () => void vi.advanceTimersByTime(15 * 60_000 + 1000))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('The time for this support session is up. You can close this tab.'))
  })
})
