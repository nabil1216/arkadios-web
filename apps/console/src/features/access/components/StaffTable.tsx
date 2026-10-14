import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/NativeSelect'
import { StatusBadge } from '@/components/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ROLE_LABELS } from '@/features/auth/hooks/permissions'
import type { Role } from '@/features/auth/api/types'
import { formatAgo } from '@/lib/format'
import type { RoleInfo, StaffMember } from '../api/types'

const HEAD = 'h-auto border-b border-line bg-[#f8fafb] px-3.5 py-2.5 font-semibold text-ink-2'
const CELL = 'px-3.5 py-3 align-middle whitespace-normal'
const ROLE_IDS = Object.keys(ROLE_LABELS) as Role[]

/** What the row buttons and role selects do. Without it the table is read only. */
export interface StaffActions {
  /** A change is running: everything waits. */
  busy: boolean
  onRoleChange: (member: StaffMember, role: Role) => void
  onDeactivate: (member: StaffMember) => void
  onReactivate: (member: StaffMember) => void
  onRemove: (member: StaffMember) => void
  onResend: (member: StaffMember) => void
}

interface StaffTableProps {
  /** Undefined while the staff are loading. */
  members: StaffMember[] | undefined
  /** Role names come from the server; undefined until they load. */
  roles: RoleInfo[] | undefined
  /** The signed-in person: their own row says "(you)" and their role stays locked. */
  selfId: string | undefined
  actions?: StaffActions
}

function RowButtons({ member, actions }: { member: StaffMember; actions: StaffActions }) {
  const button = (label: string, onClick: () => void) => (
    <Button variant="ghost" size="sm" className="text-teal-ink" disabled={actions.busy} onClick={onClick}>
      {label}
      {/* A text node carries the space: one inside the hidden span is dropped from the accessible name. */}
      {' '}
      <span className="sr-only">{member.name}</span>
    </Button>
  )
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {member.status === 'invited' ? button('Resend invite', () => actions.onResend(member)) : null}
      {member.status === 'active' ? button('Deactivate', () => actions.onDeactivate(member)) : null}
      {member.status === 'deactivated' ? button('Reactivate', () => actions.onReactivate(member)) : null}
      {button('Remove', () => actions.onRemove(member))}
    </div>
  )
}

/** The demo's staff table: who can use the console, their role, MFA, last active and status. */
export function StaffTable({ members, roles, selfId, actions }: StaffTableProps) {
  const roleName = (id: Role) => roles?.find((r) => r.id === id)?.name ?? ROLE_LABELS[id]
  const options = roles ? roles.map((r) => r.id) : ROLE_IDS

  return (
    <div className="overflow-x-auto" aria-busy={!members}>
      <Table className="text-[13.5px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={HEAD}>
              Name
            </TableHead>
            <TableHead scope="col" className={HEAD}>
              Role
            </TableHead>
            <TableHead scope="col" className={HEAD}>
              Sign-in security
            </TableHead>
            <TableHead scope="col" className={HEAD}>
              Last active
            </TableHead>
            <TableHead scope="col" className={HEAD}>
              Status
            </TableHead>
            <TableHead scope="col" className={HEAD}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!members
            ? Array.from({ length: 5 }, (_, row) => (
                <TableRow key={row} data-testid="staff-skeleton" className="hover:bg-transparent">
                  {[48, 36, 24, 24, 20, 16].map((w, i) => (
                    <TableCell key={i} className={CELL}>
                      <Skeleton className="h-4" style={{ width: `${w * 4}px` }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : members.map((m) => {
                const self = m.id === selfId
                return (
                  <TableRow key={m.id} data-staff={m.id} className="hover:bg-transparent">
                    <TableCell className={CELL}>
                      <strong>{m.name}</strong>
                      {self ? <span className="text-ink-2"> (you)</span> : null}
                      <span className="block text-[12.5px] font-normal text-ink-2">{m.email}</span>
                    </TableCell>
                    <TableCell className={CELL}>
                      <NativeSelect
                        id={`role-${m.id}`}
                        aria-label={`Role for ${m.name}`}
                        value={m.role}
                        // Your own role stays locked; a deactivated person has nothing to change.
                        disabled={!actions || actions.busy || self || m.status === 'deactivated'}
                        onChange={(e) => actions?.onRoleChange(m, e.target.value as Role)}
                        className="w-[170px]"
                      >
                        {options.map((id) => (
                          <option key={id} value={id}>
                            {roleName(id)}
                          </option>
                        ))}
                      </NativeSelect>
                    </TableCell>
                    <TableCell className={CELL}>
                      <StatusBadge kind={m.mfaEnrolled ? 'mfaOn' : 'mfaNotSet'} />
                    </TableCell>
                    <TableCell className={`${CELL} whitespace-nowrap`}>{m.lastActiveAt ? formatAgo(m.lastActiveAt) : 'Not yet'}</TableCell>
                    <TableCell className={CELL}>
                      <StatusBadge kind={m.status} />
                    </TableCell>
                    <TableCell className={CELL}>{actions && !self ? <RowButtons member={m} actions={actions} /> : null}</TableCell>
                  </TableRow>
                )
              })}
        </TableBody>
      </Table>
    </div>
  )
}
