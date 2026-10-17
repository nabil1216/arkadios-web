import type { SupportSession } from '../api/types'

export const MODE_LABEL = { read: 'Read only', edit: 'Can edit' } as const

/** "Active", "Ended", "Expired" or "Revoked": the badge words. */
export const STATUS_LABEL = { active: 'Active', ended: 'Ended', expired: 'Expired', revoked: 'Revoked' } as const

/** How it ended, in words: "Ended by Omar Haddad", "Expired", "Revoked by Dana Whitfield". Nothing for an open session. */
export function howItEnded(s: Pick<SupportSession, 'status' | 'endedByName'>): string {
  if (s.status === 'ended') return s.endedByName ? `Ended by ${s.endedByName}` : 'Ended'
  if (s.status === 'revoked') return s.endedByName ? `Revoked by ${s.endedByName}` : 'Revoked'
  if (s.status === 'expired') return 'Expired'
  return ''
}

/** "24 min" or "1 h 5 min", as the demo's duration(). A session still open counts up to `now`. */
export function formatLength(startedAt: string, endedAt: string | null, now: number = Date.now()): string {
  const end = endedAt ? new Date(endedAt).getTime() : now
  const minutes = Math.max(1, Math.round((end - new Date(startedAt).getTime()) / 60_000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

/** "29:41" for a countdown; "0:00" once it is over. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
