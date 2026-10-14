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
