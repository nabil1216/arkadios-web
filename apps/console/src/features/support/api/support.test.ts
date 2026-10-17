import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { API_BASE, ApiError } from '@/lib/api'
import { endSession, fetchActiveSession, fetchSessions, fetchSupportTenants, fetchSupportUsers, reissueHandoff, startSession } from './support'
import { supportErrorText, supportProblem } from './problems'

type Seen = { method: string; path: string; search: string; body: unknown }
const seen: Seen[] = []
const server = setupServer(
  http.all(`${API_BASE}/*`, async ({ request }) => {
    const u = new URL(request.url)
    const text = await request.text()
    seen.push({ method: request.method, path: u.pathname.replace(API_BASE, ''), search: u.search, body: text ? JSON.parse(text) : undefined })
    if (u.pathname.endsWith('/active')) return HttpResponse.json({ session: null })
    return request.method === 'GET' ? HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 25 }) : HttpResponse.json({})
  }),
)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => (seen.length = 0))
afterAll(() => server.close())

describe('support api', () => {
  it('reads the sessions with a status and a page, and sends no status for all', async () => {
    await fetchSessions({ status: 'revoked', page: 2, pageSize: 25 })
    await fetchSessions({ page: 1, pageSize: 25 })
    expect(seen.map((s) => `${s.method} ${s.path}${s.search}`)).toEqual(['GET /support-sessions?status=revoked&page=2&pageSize=25', 'GET /support-sessions?page=1&pageSize=25'])
  })

  it('reads the caller\'s own open session as the session or null', async () => {
    expect(await fetchActiveSession()).toBeNull()
  })

  it('reads eligible tenants and users, 100 at a time, with an encoded id', async () => {
    await fetchSupportTenants('north')
    await fetchSupportUsers('a/b', '')
    expect(seen.map((s) => `${s.path}${s.search}`)).toEqual(['/support/tenants?q=north&pageSize=100', '/tenants/a%2Fb/support-users?pageSize=100'])
  })

  it('starts with exactly the five fields, ends and re-issues by id', async () => {
    const input = { tenantId: 't', tenantUserId: 'u', reason: 'x'.repeat(20), durationMinutes: 30 as const, mode: 'read' as const }
    await startSession(input)
    await endSession('a/b')
    await reissueHandoff('a/b')
    expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual(['POST /support-sessions', 'POST /support-sessions/a%2Fb/end', 'POST /support-sessions/a%2Fb/handoff'])
    expect(Object.keys(seen[0].body as object).sort()).toEqual(['durationMinutes', 'mode', 'reason', 'tenantId', 'tenantUserId'])
  })
})

describe('support problems', () => {
  const error = (status: number, type: string, detail = 'Because.') => new ApiError({ title: 'T', status, type: `https://errors.arkadious.example/${type}`, detail })

  it.each([
    [409, 'support/not-eligible', 'notEligible'],
    [409, 'support/session-active', 'sessionActive'],
    [403, 'support/no-chaining', 'noChaining'],
    [409, 'support/not-active', 'notActive'],
    [409, 'support/already-opened', 'alreadyOpened'],
    [409, 'support/reissue-limit', 'reissueLimit'],
  ])('knows %i %s', (status, type, name) => {
    expect(supportProblem(error(status, type))).toBe(name)
  })

  it('knows nothing about other errors', () => {
    expect(supportProblem(error(400, 'support/not-eligible'))).toBeUndefined()
    expect(supportProblem(error(409, 'conflict'))).toBeUndefined()
    expect(supportProblem(new Error('x'))).toBeUndefined()
  })

  it('uses the server\'s words for a refusal or a limit, and a plain line otherwise', () => {
    for (const status of [403, 404, 409, 429]) expect(supportErrorText(error(status, 'x'), 'Fallback.')).toBe('Because.')
    expect(supportErrorText(error(500, 'x'), 'Fallback.')).toBe('Fallback.')
    expect(supportErrorText(new TypeError('Failed to fetch'), 'Fallback.')).toBe('Fallback.')
  })
})
