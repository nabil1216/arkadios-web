/** "Aug 5, 2026", as the demo's fmtDate prints it. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}
