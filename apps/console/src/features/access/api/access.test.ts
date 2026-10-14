import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { API_BASE } from '@/lib/api'
import { fetchRoles, fetchStaff, inviteStaff, removeStaff, resendInvite, updateRolePermissions, updateStaff } from './access'

type Seen = { method: string; path: string; search: string; body: unknown }
const seen: Seen[] = []
const record = async (request: Request): Promise<Seen> => {
  const url = new URL(request.url)
  const text = await request.text()
  const entry = { method: request.method, path: url.pathname.replace(API_BASE, ''), search: url.search, body: text ? JSON.parse(text) : undefined }
  seen.push(entry)
  return entry
}

const server = setupServer(
  http.all(`${API_BASE}/*`, async ({ request }) => {
    await record(request)
    return request.method === 'GET' ? HttpResponse.json({ items: [] }) : new HttpResponse(null, { status: 204 })
  }),
)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => (seen.length = 0))
afterAll(() => server.close())

describe('access api', () => {
  it('reads the staff and the roles', async () => {
    await fetchStaff()
    await fetchRoles()
    expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual(['GET /staff', 'GET /roles'])
  })

  it('invites with name, email and role only', async () => {
    await inviteStaff({ name: 'Test Person', email: 'test.person@platform.example', role: 'support' })
    expect(seen[0]).toMatchObject({ method: 'POST', path: '/staff', body: { name: 'Test Person', email: 'test.person@platform.example', role: 'support' } })
    expect(Object.keys(seen[0].body as object).sort()).toEqual(['email', 'name', 'role'])
  })

  it('resends, changes and removes by an encoded id, with the version', async () => {
    await resendInvite('a/b')
    await updateStaff('a/b', { role: 'billing', version: 3 })
    await removeStaff('a/b', 4)
    expect(seen.map((s) => [s.method, s.path, s.search])).toEqual([
      ['POST', '/staff/a%2Fb/resend-invite', ''],
      ['PATCH', '/staff/a%2Fb', ''],
      ['DELETE', '/staff/a%2Fb', '?version=4'],
    ])
    expect(seen[1].body).toEqual({ role: 'billing', version: 3 })
  })

  it('saves what a role can do', async () => {
    await updateRolePermissions('billing', { permissions: ['billing.manage'], version: 2 })
    expect(seen[0]).toMatchObject({ method: 'PUT', path: '/roles/billing/permissions', body: { permissions: ['billing.manage'], version: 2 } })
  })
})
