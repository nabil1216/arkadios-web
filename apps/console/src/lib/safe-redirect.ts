/**
 * Returns `next` only when it is a same-site relative path
 * ("/tenants?x=1#a"); anything else (absolute URLs, "//host", "\\host",
 * "javascript:", control characters) gives null.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  for (const ch of next) {
    const code = ch.charCodeAt(0)
    if (ch === '\\' || code < 0x20 || code === 0x7f) return null
  }
  try {
    const base = 'http://redirect.invalid'
    const url = new URL(next, base)
    if (url.origin !== base) return null
    const path = url.pathname + url.search + url.hash
    return path.startsWith('/login') ? null : path
  } catch {
    return null
  }
}

export const DEFAULT_HOME = '/overview'

/**
 * Every redirect target goes through here: `next` if it is safe, else the
 * server-provided home if that is safe, else the console overview.
 */
export function redirectTarget(next: string | null | undefined, home?: string | null): string {
  return safeNext(next) ?? safeNext(home) ?? DEFAULT_HOME
}
