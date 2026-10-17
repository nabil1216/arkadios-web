import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SessionStatus, SupportSession } from '../api/types'
import { formatLength, howItEnded, MODE_LABEL } from '../hooks/sessionText'

const BADGE = { active: 'sessionActive', ended: 'ended', expired: 'expired', revoked: 'revoked' } as const satisfies Record<SessionStatus, string>
const HEAD = 'h-auto border-b border-line bg-[#f8fafb] px-3 py-2.5 font-semibold text-ink-2'
const CELL = 'px-3 py-3 align-middle whitespace-normal'

/** What the End session and Revoke buttons do. Without it the table is read only. */
export interface SessionActions {
  /** The signed-in person: an open session of theirs gets End session. */
  selfId: string | undefined
  /** support.manage: an open session of someone else gets Revoke. */
  canRevoke: boolean
  /** A change is running: the buttons wait. */
  pending: boolean
  onEnd: (session: SupportSession) => void
  onRevoke: (session: SupportSession) => void
}

interface SessionsTableProps {
  /** Undefined while the sessions are loading. */
  sessions: SupportSession[] | undefined
  emptyMessage: string
  /** A refetch keeps the previous rows on screen. */
  busy: boolean
  actions?: SessionActions
}

/** The owner ends their own session; anyone else with support.manage revokes it. Neither is offered to a read-only role. */
function RowButton({ session, actions }: { session: SupportSession; actions: SessionActions }) {
  const mine = session.staffId === actions.selfId
  if (!mine && !actions.canRevoke) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      className="px-2 text-teal-ink"
      disabled={actions.pending}
      onClick={() => (mine ? actions.onEnd(session) : actions.onRevoke(session))}
    >
      {mine ? 'End session' : 'Revoke'}
      {/* A text node carries the space: one inside the hidden span is dropped from the accessible name. */}{' '}
      <span className="sr-only">{mine ? `on ${session.tenantName}` : `of ${session.staffName} on ${session.tenantName}`}</span>
    </Button>
  )
}

/** The demo's sessions table: when, who, where, as whom, why, how, and how it ended. */
export function SessionsTable({ sessions, emptyMessage, busy, actions }: SessionsTableProps) {
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
                <TableCell className={cn(CELL, 'text-right')}>
                  {s.status === 'active' && actions ? <RowButton session={s} actions={actions} /> : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
