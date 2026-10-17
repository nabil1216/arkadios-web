import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/auth/api/auth' // wires the bearer token into the API client
import { sessionStore } from '@/features/auth/hooks/session'
import { handlers } from '@/mocks/handlers'
import { resetMockTenants } from '@/mocks/tenantCreate'
import { makeSession, renderRoutes } from '@/test/render'
import TenantsPage from './TenantsPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function open(search = '') {
  const session = makeSession('admin')
  sessionStore.setSession({ ...session, accessToken: 'mock-access.u1', user: { ...session.user, id: 'u1' } })
  return renderRoutes([{ path: '/tenants', element: <TenantsPage /> }], '/tenants' + search)
}

const params = (router: { state: { location: { search: string } } }) => Object.fromEntries(new URLSearchParams(router.state.location.search))
const searchBox = () => screen.getByLabelText('Search tenants') as HTMLInputElement
const statusBox = () => screen.getByLabelText('Filter by status') as HTMLSelectElement
const rowCount = () => document.querySelectorAll('#t-body tr[data-id]').length
const names = () => Array.from(document.querySelectorAll('#t-body tr[data-id] strong')).map((e) => e.textContent)

beforeEach(() => {
  sessionStore.reset()
  resetMockTenants()
})
afterEach(() => vi.useRealTimers())

describe('Tenants: a search and a status filter keep each other', () => {
  it('keeps both when the status is changed before the search has been applied', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await waitFor(() => expect(rowCount()).toBe(6))
    await user.type(searchBox(), 'o')
    await user.selectOptions(statusBox(), 'suspended') // well inside the 300 ms the search waits
    await waitFor(() => expect(params(router)).toEqual({ status: 'suspended', q: 'o' }))
    await waitFor(() => expect(names()).toEqual(['Sterling Hollow Family Office']))
  })

  it('keeps both when the search is applied in the same moment the status changes (the timer fires before the new status has been seen)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { router } = open()
    await vi.waitFor(() => expect(rowCount()).toBe(6))
    fireEvent.change(searchBox(), { target: { value: 'o' } })
    act(() => {
      fireEvent.change(statusBox(), { target: { value: 'suspended' } })
      vi.advanceTimersByTime(300) // the search's timer fires with the status change not yet rendered
    })
    act(() => void vi.advanceTimersByTime(300))
    expect(params(router)).toEqual({ status: 'suspended', q: 'o' })
  })

  it('keeps both when the status is chosen first and the search typed after', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await waitFor(() => expect(rowCount()).toBe(6))
    await user.selectOptions(statusBox(), 'active')
    await user.type(searchBox(), 'north')
    await waitFor(() => expect(params(router)).toEqual({ status: 'active', q: 'north' }))
    await waitFor(() => expect(names()).toEqual(['Northwind Advisory Group']))
  })

  it('applies a pending search together with the status in one step, so the list is asked for once', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { router } = open()
    await vi.waitFor(() => expect(rowCount()).toBe(6))
    fireEvent.change(searchBox(), { target: { value: 'o' } })
    act(() => void fireEvent.change(statusBox(), { target: { value: 'suspended' } }))
    expect(params(router)).toEqual({ status: 'suspended', q: 'o' }) // at once, without waiting for the timer
    act(() => void vi.advanceTimersByTime(1000))
    expect(params(router)).toEqual({ status: 'suspended', q: 'o' })
  })
})
