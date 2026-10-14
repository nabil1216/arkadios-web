/** "Aug 5, 2026", as the demo's fmtDate prints it. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "Oct 21", in the viewer's local time (deadlines arrive as UTC date-times). */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

/** "Sep 2026" from "2026-09". */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** "September 2026" from "2026-09". */
export function formatMonthLong(month: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** "2 hours ago", "yesterday", "in 3 days": the demo's ago(), for a last-active time. */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diff = (new Date(iso).getTime() - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}
