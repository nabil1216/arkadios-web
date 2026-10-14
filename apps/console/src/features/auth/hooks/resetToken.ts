// The reset token arrives in the URL fragment (/reset-password#token=...), so it is never
// sent to a server, a log or a Referer header. It is read once, removed from the address bar
// and kept here, in memory only: never in storage, never in the router state.

let token: string | null = null

/**
 * Returns the reset token. A `#token=` fragment is moved into memory and removed from the
 * address bar with history.replaceState; later calls (re-renders, StrictMode) keep returning it.
 */
export function takeResetToken(): string | null {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (fragment.has('token')) {
    token = fragment.get('token') || null
    // Keep the router's history.state so React Router stays in sync.
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }
  return token
}

export function clearResetToken() {
  token = null
}
