import { useEffect, useState } from 'react'

/**
 * Milliseconds until `expiresAt`, re-read every second, never below 0. Give the component that uses it a `key` of the
 * session, so a different session starts from a fresh clock reading.
 */
export function useCountdown(expiresAt: string | undefined): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!expiresAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  return expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0
}
