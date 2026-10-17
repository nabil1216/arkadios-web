import { afterEach, describe, expect, it } from 'vitest'
import type { SupportSession } from '@/features/support/api/types'
import { askTenantSide, serveTenantSide } from './crossTab'
import type { TenantSide } from './tenantSide'

const name = () => `test-${crypto.randomUUID()}`
const open: BroadcastChannel[] = []
const channel = (n: string) => {
  const c = new BroadcastChannel(n)
  open.push(c)
  return c
}
afterEach(() => open.splice(0).forEach((c) => c.close()))

const session = { id: 's1', status: 'active' } as SupportSession
const side = (seen: unknown[]): TenantSide => ({
  exchange: async (code) => (seen.push(['exchange', code]), { kind: 'invalid' }),
  session: async (token) => (seen.push(['session', token]), token === 'good' ? session : null),
  end: async (token) => (seen.push(['end', token]), token === 'good' ? { ...session, status: 'ended' } : null),
})

describe('the dev bridge between the workspace tab and the console tab', () => {
  it('answers the workspace tab with the console tab\'s data', async () => {
    const n = name()
    const seen: unknown[] = []
    serveTenantSide(channel(n), side(seen))
    const remote = askTenantSide(channel(n))
    expect(await remote.exchange('some-code')).toEqual({ kind: 'invalid' })
    expect(await remote.session('good')).toEqual(session)
    expect(await remote.session('bad')).toBeNull()
    expect(await remote.end('good')).toMatchObject({ status: 'ended' })
    expect(seen).toEqual([['exchange', 'some-code'], ['session', 'good'], ['session', 'bad'], ['end', 'good']])
  })

  it('rejects when no console tab answers', async () => {
    const remote = askTenantSide(channel(name()), 50)
    await expect(remote.session('good')).rejects.toThrow('No console tab answered.')
  })

  it('does not answer a request for something it does not serve', async () => {
    const n = name()
    const seen: unknown[] = []
    serveTenantSide(channel(n), side(seen))
    const raw = channel(n)
    raw.postMessage({ kind: 'request', id: 'x', op: 'drop-everything', arg: 1 })
    await new Promise((r) => setTimeout(r, 50))
    expect(seen).toEqual([])
  })

  it('keeps several questions apart', async () => {
    const n = name()
    serveTenantSide(channel(n), side([]))
    const remote = askTenantSide(channel(n))
    const [a, b] = await Promise.all([remote.session('good'), remote.session('bad')])
    expect([a?.id, b]).toEqual(['s1', null])
  })
})
