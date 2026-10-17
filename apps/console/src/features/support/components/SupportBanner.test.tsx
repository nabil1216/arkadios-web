import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import '@/features/auth/api/auth' // wires the bearer token into the API client
import type { Role } from '@/features/auth/api/types'
import { sessionStore } from '@/features/auth/hooks/session'
import { API_BASE } from '@/lib/api'
import { staff } from '@/mocks/db'
import { handlers } from '@/mocks/handlers'
import { resetMockStaff } from '@/mocks/staff'
import { allTenantUsers, resetMockSupport, startSession } from '@/mocks/support'
import { resetMockTenants } from '@/mocks/tenantCreate'
import { tenantRecords } from '@/mocks/tenants'
import { makeSession, renderRoutes } from '@/test/render'
import { SupportBanner } from './SupportBanner'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const USER_ID: Record<Role, string> = { admin: 'u1', support: 'u2', billing: 'u3', auditor: 'u4' }

beforeEach(() => {
  sessionStore.reset()
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
})
afterEach(() => {
  resetMockStaff()
  resetMockTenants()
  resetMockSupport()
})

function open(role: Role = 'support') {
  const session = makeSession(role)
  sessionStore.setSession({ ...session, accessToken: `mock-access.${USER_ID[role]}`, user: { ...session.user, id: USER_ID[role] } })
  return renderRoutes([{ path: '/', element: <SupportBanner /> }], '/')
}

function begin(staffId: string, mode: 'read' | 'edit' = 'read') {
  const tenant = tenantRecords.find((t) => t.name === 'Northwind Advisory Group')!
  const user = allTenantUsers(tenant.id).find((u) => u.name === 'Elena Marsh')!
  const result = startSession(staff.find((u) => u.id === staffId)!, { tenantId: tenant.id, tenantUserId: user.id, reason: 'Checklist did not create tasks after a stage move', durationMinutes: 30, mode }, 'http://localhost')
  if (!result.ok) throw new Error(result.detail)
}

describe('SupportBanner', () => {
  it('shows nothing when you have no session open', async () => {
    open()
    await waitFor(() => expect(document.body.textContent).toBeDefined())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows who you are signed in as, where, the access and the time left, while a session is open', async () => {
    begin('u2')
    open()
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent('Support session: signed in as Elena Marsh at Northwind Advisory Group (Read only). Everything you do is recorded.')
    expect(banner).toHaveTextContent(/Time left 2[89]:\d\d|Time left 30:00/)
  })

  it('says when the session can edit', async () => {
    begin('u2', 'edit')
    open()
    expect(await screen.findByRole('status')).toHaveTextContent('(Can edit)')
  })

  it('shows only your own session, not a colleague\'s', async () => {
    begin('u1')
    open('support')
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('does not ask a role that cannot see Support access', async () => {
    let asked = false
    server.use(http.get(`${API_BASE}/support-sessions/active`, () => ((asked = true), HttpResponse.json({ session: null }))))
    begin('u2')
    open('billing')
    await new Promise((r) => setTimeout(r, 300))
    expect(asked).toBe(false)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('counts down, then reads the session again when the time is up, and goes away', async () => {
    let calls = 0
    const soon = new Date(Date.now() + 1500).toISOString()
    server.use(
      http.get(`${API_BASE}/support-sessions/active`, () => {
        calls += 1
        const session =
          calls === 1
            ? { id: 's1', staffId: 'u2', staffName: 'Omar Haddad', tenantId: 't', tenantName: 'Northwind Advisory Group', tenantUserId: 'u', tenantUserName: 'Elena Marsh', reasonId: 'r', reason: 'x'.repeat(20), mode: 'read', durationMinutes: 15, startedAt: new Date().toISOString(), expiresAt: soon, endedAt: null, status: 'active', endedById: null, endedByName: null }
            : null
        return HttpResponse.json({ session })
      }),
    )
    open()
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(/Time left 0:0[12]/)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument(), { timeout: 4000 })
    expect(calls).toBeGreaterThanOrEqual(2)
  })
})
