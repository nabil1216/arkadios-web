import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { queryClient } from '@/lib/query-client'
import { api } from '@/lib/api'
import { sessionStore } from '../hooks/session'
import { makeSession } from '@/test/render'
import { refreshDelayMs, restoreSession, signOut } from './auth'

const problem = (status: number, title: string) =>
  new Response(JSON.stringify({ title, status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })

const sessionJson = (token: string, expiresIn = 900) =>
  new Response(JSON.stringify({ ...makeSession(), accessToken: token, expiresIn }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

let fetchMock: ReturnType<typeof vi.fn>
const calls = (path: string) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith(path))

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  sessionStore.reset()
  queryClient.clear()
})

afterEach(() => {
  sessionStore.reset() // clears the refresh timer
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('refreshDelayMs', () => {
  it('refreshes a minute before a 15 minute token ends', () => {
    expect(refreshDelayMs(900)).toBe(840_000)
  })

  it('refreshes at half life when the token is short', () => {
    expect(refreshDelayMs(60)).toBe(30_000)
    expect(refreshDelayMs(100)).toBe(50_000)
  })
})

describe('refresh before expiry', () => {
  it('renews the access token shortly before it ends, with the CSRF header', async () => {
    fetchMock.mockImplementation(async () => sessionJson('token-2'))
    sessionStore.setSession({ ...makeSession(), expiresIn: 900 })

    await vi.advanceTimersByTimeAsync(839_000)
    expect(calls('/auth/refresh')).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(2_000)
    expect(calls('/auth/refresh')).toHaveLength(1)
    const [url, init] = calls('/auth/refresh')[0]
    expect(url).toBe('/api/platform/v1/auth/refresh')
    expect(init.method).toBe('POST')
    expect(init.headers['X-Requested-With']).toBe('arkadios-web')
    expect(init.credentials).toBe('include')

    const state = sessionStore.get()
    expect(state.status === 'authenticated' && state.accessToken).toBe('token-2')
  })

  it('keeps renewing, one refresh per token lifetime', async () => {
    let n = 1
    fetchMock.mockImplementation(async () => sessionJson(`token-${++n}`))
    sessionStore.setSession({ ...makeSession(), expiresIn: 900 })

    await vi.advanceTimersByTimeAsync(840_000 * 3 + 1000)
    expect(calls('/auth/refresh')).toHaveLength(3)
  })

  it('ends the session and clears the query cache when the refresh cookie is rejected', async () => {
    fetchMock.mockImplementation(async () => problem(401, 'Session expired'))
    queryClient.setQueryData(['tenants'], [{ id: 1 }])
    sessionStore.setSession(makeSession())

    await vi.advanceTimersByTimeAsync(841_000)

    expect(sessionStore.get()).toEqual({ status: 'anonymous', reason: 'expired' })
    expect(queryClient.getQueryData(['tenants'])).toBeUndefined()
    // no further refresh attempts once signed out
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(calls('/auth/refresh')).toHaveLength(1)
  })

  it('keeps the session and tries again when the server cannot be reached', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    fetchMock.mockImplementation(async () => sessionJson('token-2'))
    sessionStore.setSession(makeSession())

    await vi.advanceTimersByTimeAsync(841_000)
    expect(sessionStore.get().status).toBe('authenticated')
    expect(calls('/auth/refresh')).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(15_000)
    expect(calls('/auth/refresh')).toHaveLength(2)
    const state = sessionStore.get()
    expect(state.status === 'authenticated' && state.accessToken).toBe('token-2')
  })
})

describe('restoreSession', () => {
  it('restores the session from the refresh cookie', async () => {
    fetchMock.mockImplementation(async () => sessionJson('restored'))
    await restoreSession()
    const state = sessionStore.get()
    expect(state.status === 'authenticated' && state.accessToken).toBe('restored')
    expect(calls('/auth/refresh')[0][1].headers['X-Requested-With']).toBe('arkadios-web')
  })

  it('returns to login when the cookie is missing, reused or revoked', async () => {
    fetchMock.mockImplementation(async () => problem(401, 'Session expired'))
    await restoreSession()
    expect(sessionStore.get()).toEqual({ status: 'anonymous', reason: undefined })
  })

  it('returns to login when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await restoreSession()
    expect(sessionStore.get().status).toBe('anonymous')
  })
})

describe('signOut', () => {
  it('sends the CSRF header, clears the cache and records an explicit sign-out', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))
    queryClient.setQueryData(['tenants'], [{ id: 1 }])
    sessionStore.setSession(makeSession())

    await signOut()

    const [url, init] = calls('/auth/logout')[0]
    expect(url).toBe('/api/platform/v1/auth/logout')
    expect(init.headers['X-Requested-With']).toBe('arkadios-web')
    expect(sessionStore.get()).toEqual({ status: 'anonymous', reason: 'user' })
    expect(queryClient.getQueryData(['tenants'])).toBeUndefined()
  })

  it('still signs out locally when the server call fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    sessionStore.setSession(makeSession())
    await signOut('idle')
    expect(sessionStore.get()).toEqual({ status: 'anonymous', reason: 'idle' })
  })
})

describe('401 on a normal request', () => {
  it('refreshes once and retries with the new token', async () => {
    sessionStore.setSession(makeSession())
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return sessionJson('token-2')
      const auth = (init.headers as Record<string, string>).Authorization
      return auth === 'Bearer token-2' ? new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }) : problem(401, 'Authentication required')
    })

    await expect(api('/tenants')).resolves.toEqual({ ok: true })
    expect(calls('/auth/refresh')).toHaveLength(1)
    expect(calls('/tenants')).toHaveLength(2)
  })

  it('ends the session when the refresh is rejected', async () => {
    sessionStore.setSession(makeSession())
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/auth/refresh') ? problem(401, 'Session expired') : problem(401, 'Authentication required'),
    )

    await expect(api('/tenants')).rejects.toMatchObject({ status: 401 })
    expect(sessionStore.get()).toEqual({ status: 'anonymous', reason: 'expired' })
  })
})

