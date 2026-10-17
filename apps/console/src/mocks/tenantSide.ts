// What the tenant API does with a handoff code and a support token, behind one object so the dev bridge can swap it.
// The mock API keeps its data in the browser tab that runs it, and the workspace opens in a new tab: the bridge in
// crossTab.ts makes that tab ask the console tab. Tests and the console tab use these functions directly.
import type { SupportSession } from '@/features/support/api/types'
import { endSessionOfToken, exchangeHandoff, sessionOfToken, type ExchangeResult } from './support'

export interface TenantSide {
  exchange(code: unknown): Promise<ExchangeResult>
  session(token: string | undefined): Promise<SupportSession | null>
  end(token: string | undefined): Promise<SupportSession | null>
}

export const localTenantSide: TenantSide = {
  exchange: async (code) => exchangeHandoff(code),
  session: async (token) => sessionOfToken(token),
  end: async (token) => endSessionOfToken(token),
}

/** The tenant side the handlers use. */
export const tenantSide: TenantSide = { ...localTenantSide }
