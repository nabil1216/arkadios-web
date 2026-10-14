import { api, ApiError, configureApi } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { getAccessToken, sessionStore, type SignOutReason } from '../hooks/session'
import type { LoginResponse, SessionResponse } from './types'

/** Refresh this long before the access token ends (or at half its life, if shorter). */
const REFRESH_LEAD_MS = 60_000
/** Wait this long before trying again when the server could not be reached. */
const RETRY_MS = 15_000

export function login(email: string, password: string) {
  return api<LoginResponse>('/auth/login', { body: { email, password }, anonymous: true })
}

export function verifyMfa(challengeId: string, code: string) {
  return api<SessionResponse>('/auth/mfa', { body: { challengeId, code }, anonymous: true })
}

/**
 * Always resolves the same way for any well-formed email, so the response never
 * reveals whether an account exists (docs/ARCHITECTURE.md, section 5).
 */
export function requestPasswordReset(email: string) {
  return api<void>('/auth/forgot-password', { body: { email }, anonymous: true })
}

/** Sets a new password with the single-use token from the reset link. Responds 204; never signs the user in. */
export function resetPassword(token: string, newPassword: string) {
  return api<void>('/auth/reset-password', { body: { token, newPassword }, anonymous: true })
}

export function startSession(session: SessionResponse) {
  sessionStore.setSession(session)
}

/** Drops the in-memory session and every cached query (they belong to the old user). */
function endSession(reason?: SignOutReason) {
  sessionStore.setAnonymous(reason)
  queryClient.clear()
}

let inflight: Promise<SessionResponse | null> | null = null

/**
 * Ask the server for a new access token using the httpOnly refresh cookie.
 * Resolves null when the server rejects the cookie (missing, reused or revoked:
 * the session is over). Other failures, such as a network error, are thrown.
 */
export function refreshSession(): Promise<SessionResponse | null> {
  inflight ??= api<SessionResponse>('/auth/refresh', { method: 'POST', body: {}, anonymous: true, csrf: true })
    .then((session) => {
      sessionStore.setSession(session)
      return session
    })
    .catch((error: unknown) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null
      throw error
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Called once at boot: restores the session after a page reload. */
export async function restoreSession() {
  try {
    if (!(await refreshSession())) sessionStore.setAnonymous()
  } catch {
    sessionStore.setAnonymous()
  }
}

export async function signOut(reason: SignOutReason = 'user') {
  try {
    await api('/auth/logout', { method: 'POST', body: {}, anonymous: true, csrf: true })
  } catch {
    // the cookie may already be gone; sign out locally either way
  }
  endSession(reason)
}

export function refreshDelayMs(expiresInSeconds: number) {
  const lifetime = expiresInSeconds * 1000
  return Math.max(lifetime - REFRESH_LEAD_MS, lifetime / 2)
}

let timer: ReturnType<typeof setTimeout> | undefined

async function refreshBeforeExpiry() {
  try {
    // On success the store updates and the subscription below schedules the next refresh.
    if (!(await refreshSession())) endSession('expired')
  } catch {
    timer = setTimeout(() => void refreshBeforeExpiry(), RETRY_MS)
  }
}

// One timer follows the session: set after every sign-in or refresh, cleared on sign-out.
sessionStore.subscribe(() => {
  clearTimeout(timer)
  const state = sessionStore.get()
  if (state.status === 'authenticated') {
    timer = setTimeout(() => void refreshBeforeExpiry(), refreshDelayMs(state.expiresIn))
  }
})

configureApi({
  getToken: getAccessToken,
  // A 401 on a normal request: try one refresh. A rejected cookie ends the session.
  refresh: async () => {
    try {
      const session = await refreshSession()
      if (!session) endSession('expired')
      return session?.accessToken ?? null
    } catch {
      return null
    }
  },
})
