import { useSyncExternalStore } from 'react'
import type { SessionResponse } from '../api/types'

// The session lives in memory only. The refresh token is an httpOnly cookie
// that JS never reads; a page reload restores the session via POST /api/auth/refresh.

export type SignOutReason = 'user' | 'idle' | 'expired'

export type SessionState =
  | { status: 'loading' }
  | { status: 'anonymous'; reason?: SignOutReason }
  | ({ status: 'authenticated' } & SessionResponse)

let state: SessionState = { status: 'loading' }
const listeners = new Set<() => void>()

function set(next: SessionState) {
  state = next
  listeners.forEach((l) => l())
}

export const sessionStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  setSession: (s: SessionResponse) => set({ status: 'authenticated', ...s }),
  setAnonymous: (reason?: SignOutReason) => set({ status: 'anonymous', reason }),
  /** Test helper: put the store back to its boot state. */
  reset: () => set({ status: 'loading' }),
}

export function useSession(): SessionState {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get)
}

export function getAccessToken(): string | null {
  return state.status === 'authenticated' ? state.accessToken : null
}
