import type { ListResponse } from '@/lib/list'

// Hand-written until packages/api-client is generated; replace then.

/** The only lengths a support session can have. There is no custom time. */
export const DURATIONS = [15, 30, 60] as const
export type Duration = (typeof DURATIONS)[number]
export const DEFAULT_DURATION: Duration = 30

export const REASON_RANGE = { min: 20, max: 500 } as const

/** Read only is the default. `edit` is a separate, explicit choice and still has the restrictions of the contract. */
export type SupportMode = 'read' | 'edit'

/** How a session stands: still open, ended by its owner, ran out, or ended by someone else with support.manage. */
export type SessionStatus = 'active' | 'ended' | 'expired' | 'revoked'
export const SESSION_STATUSES: readonly SessionStatus[] = ['active', 'ended', 'expired', 'revoked']

export interface SupportSession {
  id: string
  staffId: string
  staffName: string
  tenantId: string
  tenantName: string
  tenantUserId: string
  tenantUserName: string
  /** The reason is stored apart from the session, and its id travels in the support token. */
  reasonId: string
  /** Plain text. The client's admins see it too. Render it as text, never as HTML. */
  reason: string
  mode: SupportMode
  durationMinutes: Duration
  startedAt: string
  /** When the token stops working: the start plus the chosen length. */
  expiresAt: string
  endedAt: string | null
  status: SessionStatus
  /** Who ended it; the owner for `ended`, someone else for `revoked`, null for `expired` and `active`. */
  endedById: string | null
  endedByName: string | null
}

export type SessionList = ListResponse<SupportSession>

export interface SessionListParams {
  status?: SessionStatus
  page: number
  pageSize: number
}

export interface SupportTenant {
  id: string
  name: string
  domain: string
  status: 'active' | 'trial'
}

export interface SupportUser {
  id: string
  name: string
  roleName: string
}

export interface Handoff {
  /** Single use, valid for `expiresIn` seconds. Goes in the URL fragment, never in a path or query string. */
  code: string
  /** The workspace address with the code in its fragment. Open it in a new tab. */
  url: string
  expiresIn: number
}

export interface StartedSession {
  session: SupportSession
  handoff: Handoff
}

export interface StartInput {
  tenantId: string
  tenantUserId: string
  reason: string
  durationMinutes: Duration
  mode: SupportMode
}

/** What the tenant API returns for a code (POST /api/v1/auth/support-exchange). There is no refresh token. */
export interface SupportExchange {
  accessToken: string
  expiresIn: number
  session: {
    id: string
    actAs: { id: string; name: string }
    tenantUser: { id: string; name: string }
    reason: string
    mode: SupportMode
    expiresAt: string
  }
}

/** Problem `type` slugs of the support session problems (docs/ARCHITECTURE.md, Support access). */
export const SUPPORT_PROBLEM = {
  notEligible: 'support/not-eligible',
  sessionActive: 'support/session-active',
  noChaining: 'support/no-chaining',
  notActive: 'support/not-active',
  alreadyOpened: 'support/already-opened',
  reissueLimit: 'support/reissue-limit',
} as const
