import { StatusBadge } from '@/components/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SessionStatus, SupportSession } from '../api/types'
import { formatLength, howItEnded, MODE_LABEL } from '../hooks/sessionText'

const BADGE = { active: 'sessionActive', ended: 'ended', expired: 'expired', revoked: 'revoked' } as const satisfies Record<SessionStatus, string>
const HEAD = 'h-auto border-b border-line bg-[#f8fafb] px-3 py-2.5 font-semibold text-ink-2'
const CELL = 'px-3 py-3 align-middle whitespace-normal'

interface SessionsTableProps {
  /** Undefined while the sessions are loading. */
  sessions: SupportSession[] | undefined
  emptyMessage: string
  /** A refetch keeps the previous rows on screen. */
  busy: boolean
}

/** The demo's sessions table: when, who, where, as whom, why, how, and how it ended. */
export function SessionsTable({ sessions, emptyMessage, busy }: SessionsTableProps) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-paper" aria-busy={!sessions || busy}>
      <Table className={cn('text-[13.5px]', busy && 'opacity-60')}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {['Started', 'Staff', 'Tenant', 'Viewed as', 'Reason', 'Access', 'Ended', 'Status'].map((label) => (
              <TableHead key={label} scope="col" className={HEAD}>
                {label}
              </TableHead>
            ))}
            <TableHead scope="col" className={HEAD}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!sessions ? (
            Array.from({ length: 5 }, (_, row) => (
              <TableRow key={row} data-testid="sessions-skeleton" className="hover:bg-transparent">
                {[28, 24, 32, 24, 48, 16, 24, 20, 16].map((w, i) => (
                  <TableCell key={i} className={CELL}>
                    <Skeleton className="h-4" style={{ width: `${w * 4}px` }} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : sessions.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={9} className="px-3.5 py-8 text-center text-ink-2">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sessions.map((s) => (
              <TableRow key={s.id} data-session={s.id} data-status={s.status} className="hover:bg-transparent">
                <TableCell className={cn(CELL, 'whitespace-nowrap')}>
                  <time dateTime={s.startedAt}>{formatDateTime(s.startedAt)}</time>
                </TableCell>
                <TableCell className={CELL}>{s.staffName}</TableCell>
                <TableCell className={CELL}>
                  <strong>{s.tenantName}</strong>
                </TableCell>
                <TableCell className={CELL}>{s.tenantUserName}</TableCell>
                {/* Plain text, wrapped: the reason is whatever the staff member typed. */}
                <TableCell className={cn(CELL, 'max-w-[34ch] break-words')}>{s.reason}</TableCell>
                <TableCell className={cn(CELL, 'whitespace-nowrap')}>{MODE_LABEL[s.mode]}</TableCell>
                <TableCell className={cn(CELL, 'whitespace-nowrap')}>
                  {s.endedAt ? (
                    <>
                      <time dateTime={s.endedAt}>{formatDateTime(s.endedAt)}</time>
                      <span className="block text-[12.5px] text-ink-2">{formatLength(s.startedAt, s.endedAt)}</span>
                    </>
                  ) : (
                    <span className="text-ink-2">
                      Until <time dateTime={s.expiresAt}>{formatDateTime(s.expiresAt)}</time>
                    </span>
                  )}
                </TableCell>
                <TableCell className={CELL}>
                  <StatusBadge kind={BADGE[s.status]} />
                  {howItEnded(s) ? <span className="mt-0.5 block text-[12.5px] text-ink-2">{howItEnded(s)}</span> : null}
                </TableCell>
                <TableCell className={CELL} />
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
