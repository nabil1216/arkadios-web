import type { SupportExchange } from '@/features/support/api/types'
import { TENANT_API_BASE } from '@/lib/api'

export type HandoffResult =
  | { status: 'ok'; exchange: SupportExchange }
  | { status: 'invalid' }
  | { status: 'limited' }
  | { status: 'unavailable' }

/**
 * What the workspace's /support-handoff page must do (docs/ARCHITECTURE.md, Support access):
 * read the one-time code from the URL fragment and clear the fragment at once, before anything else, then trade the code
 * for a token. The token stays in the page's memory (here, in the route data) and is never written to storage or a URL.
 */
async function exchangeFromFragment(): Promise<HandoffResult> {
  const code = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('code')
  window.history.replaceState(null, '', window.location.pathname)
  if (!code) return { status: 'invalid' }

  try {
    const res = await fetch(`${TENANT_API_BASE}/auth/support-exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
    if (res.ok) return { status: 'ok', exchange: (await res.json()) as SupportExchange }
    if (res.status === 429) return { status: 'limited' }
    // One answer for a wrong, expired, replaced or reused code: the page says nothing more.
    return res.status === 400 ? { status: 'invalid' } : { status: 'unavailable' }
  } catch {
    return { status: 'unavailable' }
  }
}

// React can build the router twice in development (StrictMode), and so run a loader twice. The first run clears the fragment
// and uses the code up, so a second run would find nothing, or the code already spent. One page load reads the fragment and
// exchanges once, and everything that asks gets that same answer.
let once: Promise<HandoffResult> | null = null

export function handoffLoader(): Promise<HandoffResult> {
  once ??= exchangeFromFragment()
  return once
}

/** Forget the answer, so the next page load in a test starts fresh. A real page load does this by being a new document. */
export function resetHandoffLoader() {
  once = null
}
