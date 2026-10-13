import { api, configureApi } from '@/lib/api'
import { queryClient } from '@/lib/query-client'
import { getAccessToken, sessionStore, type SignOutReason } from '../hooks/session'
import type { LoginResponse, SessionResponse } from './types'

export function login(email: string, password: string) {
  return api<LoginResponse>('/auth/login', { body: { email, password }, anonymous: true })
}

export function verifyMfa(challengeId: string, code: string) {
  return api<SessionResponse>('/auth/mfa', { body: { challengeId, code }, anonymous: true })
}

export function startSession(session: SessionResponse) {
  sessionStore.setSession(session)
}

let inflight: Promise<SessionResponse | null> | null = null

/** Ask the server for a new access token using the httpOnly refresh cookie. */
export function refreshSession(): Promise<SessionResponse | null> {
  inflight ??= api<SessionResponse>('/auth/refresh', { method: 'POST', body: {}, anonymous: true })
    .then((session) => {
      sessionStore.setSession(session)
      return session
    })
    .catch(() => null)
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Called once at boot: restores the session after a page reload. */
export async function restoreSession() {
  const session = await refreshSession()
  if (!session) sessionStore.setAnonymous()
}

export async function signOut(reason: SignOutReason = 'user') {
  try {
    await api('/auth/logout', { method: 'POST', body: {}, anonymous: true })
  } catch {
    // the cookie may already be gone; sign out locally either way
  }
  sessionStore.setAnonymous(reason)
  queryClient.clear()
}

configureApi({
  getToken: getAccessToken,
  refresh: async () => {
    const session = await refreshSession()
    if (!session) {
      sessionStore.setAnonymous('expired')
      queryClient.clear()
    }
    return session?.accessToken ?? null
  },
})
