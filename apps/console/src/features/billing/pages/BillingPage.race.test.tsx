import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/auth/api/auth' // wires the bearer token into the API client
import { sessionStore } from '@/features/auth/hooks/session'
import { handlers } from '@/mocks/handlers'
import { resetMockBills } from '@/mocks/bills'
import { makeSession, renderRoutes } from '@/test/render'
import BillingPage from './BillingPage'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function open(search = '') {
  const session = makeSession('admin')
  sessionStore.setSession({ ...session, accessToken: 'mock-access.u1', user: { ...session.user, id: 'u1' } })
  return renderRoutes([{ path: '/billing', element: <BillingPage /> }], '/billing' + search)
}

const params = (router: { state: { location: { search: string } } }) => Object.fromEntries(new URLSearchParams(router.state.location.search))
const searchBox = () => screen.getByLabelText('Search bills by tenant') as HTMLInputElement
const statusBox = () => screen.getByLabelText('Filter by status') as HTMLSelectElement
const monthBox = () => screen.getByLabelText('Filter by month') as HTMLInputElement
const rowCount = () => document.querySelectorAll('#b-body tr[data-id]').length

beforeEach(() => {
  sessionStore.reset()
  resetMockBills()
})
afterEach(() => vi.useRealTimers())

describe('Billing: a search, a status and a month keep one another', () => {
  it('keeps all three when they are changed one after another within the wait', async () => {
    const user = userEvent.setup()
    const { router } = open()
    await waitFor(() => expect(rowCount()).toBeGreaterThan(0))
    await user.type(searchBox(), 'o')
    await user.selectOptions(statusBox(), 'paid')
    fireEvent.change(monthBox(), { target: { value: '2026-09' } })
    await waitFor(() => expect(params(router)).toEqual({ q: 'o', status: 'paid', month: '2026-09' }))
  })

  it('keeps the status when the search is applied in the same moment the status changes (the timer fires before the new status has been seen)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { router } = open()
    await vi.waitFor(() => expect(rowCount()).toBeGreaterThan(0))
    fireEvent.change(searchBox(), { target: { value: 'o' } })
    act(() => {
      fireEvent.change(statusBox(), { target: { value: 'overdue' } })
      vi.advanceTimersByTime(300)
    })
    act(() => void vi.advanceTimersByTime(300))
    expect(params(router)).toEqual({ status: 'overdue', q: 'o' })
  })

  it('keeps the month when the search is applied in the same moment the month changes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { router } = open()
    await vi.waitFor(() => expect(rowCount()).toBeGreaterThan(0))
    fireEvent.change(searchBox(), { target: { value: 'o' } })
    act(() => {
      fireEvent.change(monthBox(), { target: { value: '2026-09' } })
      vi.advanceTimersByTime(300)
    })
    act(() => void vi.advanceTimersByTime(300))
    expect(params(router)).toEqual({ month: '2026-09', q: 'o' })
  })

  it('applies a waiting search together with the status, in one step', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { router } = open()
    await vi.waitFor(() => expect(rowCount()).toBeGreaterThan(0))
    fireEvent.change(searchBox(), { target: { value: 'o' } })
    act(() => void fireEvent.change(statusBox(), { target: { value: 'overdue' } }))
    expect(params(router)).toEqual({ status: 'overdue', q: 'o' }) // at once, without waiting for the timer
    act(() => void vi.advanceTimersByTime(1000))
    expect(params(router)).toEqual({ status: 'overdue', q: 'o' })
  })

  it('applies a waiting search together with the month, in one step', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { router } = open()
    await vi.waitFor(() => expect(rowCount()).toBeGreaterThan(0))
    fireEvent.change(searchBox(), { target: { value: 'o' } })
    act(() => void fireEvent.change(monthBox(), { target: { value: '2026-09' } }))
    expect(params(router)).toEqual({ month: '2026-09', q: 'o' })
    act(() => void vi.advanceTimersByTime(1000))
    expect(params(router)).toEqual({ month: '2026-09', q: 'o' })
  })

  it('starts from page 1 again when a filter changes, with the others kept', async () => {
    const { router } = open('?status=paid&page=2&q=a')
    await waitFor(() => expect(rowCount()).toBeGreaterThanOrEqual(0))
    act(() => void fireEvent.change(monthBox(), { target: { value: '2026-09' } }))
    expect(params(router)).toEqual({ status: 'paid', q: 'a', month: '2026-09' })
  })
})
