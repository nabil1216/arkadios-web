// Dev only. The mock API keeps its data in the browser tab that runs it, but a support session opens the workspace in
// a new tab. This bridge makes the workspace tab ask the console tab (over a BroadcastChannel) for what the tenant API
// would answer, so the handoff works across the two tabs the way it will against the real API.
import { localTenantSide, tenantSide, type TenantSide } from './tenantSide'

export const CHANNEL = 'arkadios-mock-tenant-side'
const OPS = ['exchange', 'session', 'end'] as const
type Op = (typeof OPS)[number]

type Message = { kind: 'request'; id: string; op: Op; arg: unknown } | { kind: 'reply'; id: string; result: unknown }

/** Answers the other tabs' questions with this tab's data. */
export function serveTenantSide(channel: BroadcastChannel, side: TenantSide): () => void {
  const onMessage = async (event: MessageEvent<Message>) => {
    const m = event.data
    if (m.kind !== 'request' || !OPS.includes(m.op)) return
    const result = await (side[m.op] as (arg: unknown) => Promise<unknown>)(m.arg)
    channel.postMessage({ kind: 'reply', id: m.id, result } satisfies Message)
  }
  channel.addEventListener('message', onMessage)
  return () => channel.removeEventListener('message', onMessage)
}

/** A tenant side that asks the tabs that serve it. It rejects when none answers in time. */
export function askTenantSide(channel: BroadcastChannel, timeoutMs = 3000): TenantSide {
  const waiting = new Map<string, (result: unknown) => void>()
  channel.addEventListener('message', (event: MessageEvent<Message>) => {
    if (event.data.kind === 'reply') waiting.get(event.data.id)?.(event.data.result)
  })
  const ask = <T>(op: Op, arg: unknown) =>
    new Promise<T>((resolve, reject) => {
      const id = crypto.randomUUID()
      const timer = setTimeout(() => {
        waiting.delete(id)
        reject(new Error('No console tab answered.'))
      }, timeoutMs)
      waiting.set(id, (result) => {
        clearTimeout(timer)
        waiting.delete(id)
        resolve(result as T)
      })
      channel.postMessage({ kind: 'request', id, op, arg } satisfies Message)
    })
  return {
    exchange: (code) => ask('exchange', code),
    session: (token) => ask('session', token),
    end: (token) => ask('end', token),
  }
}

/** The console tab serves its data; a workspace tab (the stand-in page) asks for it. */
export function installCrossTab(standIn: boolean) {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(CHANNEL)
  if (standIn) Object.assign(tenantSide, askTenantSide(channel))
  else serveTenantSide(channel, localTenantSide)
}
