import { NativeSelect } from '@/components/NativeSelect'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Area, Level } from '@/features/auth/api/types'
import { AREA_LABELS } from '@/features/auth/hooks/permissions'
import type { RoleInfo } from '../api/types'
import { levelOfKeys } from '../hooks/permissionDiff'
import { AREAS, type RoleDraft } from '../hooks/roleDraft'

const LEVELS: Array<[Level, string]> = [
  ['none', 'No access'],
  ['view', 'View only'],
  ['manage', 'Can change'],
]
const COLUMN = 'h-auto w-[150px] border-b border-line bg-[#f8fafb] px-3.5 py-2.5 text-center align-middle font-semibold whitespace-normal'
const CELL = 'px-3.5 py-3 text-center align-middle'

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

interface RolesMatrixProps {
  /** Undefined while the roles are loading. */
  roles: RoleInfo[] | undefined
  /** What the person has picked per role; the saved levels when absent. */
  drafts?: Record<string, RoleDraft>
  /** Without access.manage, or while a save runs, every select is off. */
  readOnly?: boolean
  onLevel?: (roleId: string, area: Area, level: Level) => void
  /** False for a role that holds a permission the signed-in role lacks: its column is read only. Defaults to editable. */
  editable?: (role: RoleInfo) => boolean
}

/** The demo's matrix: areas down the side, roles across the top, what each role can do in each area. */
export function RolesMatrix({ roles, drafts, readOnly = true, onLevel, editable = () => true }: RolesMatrixProps) {
  return (
    <div className="overflow-x-auto" aria-busy={!roles}>
      <Table className="text-[13.5px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="h-auto min-w-[200px] border-b border-line bg-[#f8fafb] px-3.5 py-2.5 font-semibold text-ink-2">
              Area
            </TableHead>
            {roles
              ? roles.map((role) => (
                  <TableHead key={role.id} scope="col" className={COLUMN}>
                    <span className="block text-[14.5px] text-ink">{role.name}</span>
                    <span className="block text-[12.5px] font-normal text-ink-2">{people(role.staffCount)}</span>
                    {role.locked ? (
                      <span className="block text-[12.5px] font-normal text-ink-2">Locked</span>
                    ) : !readOnly && !editable(role) ? (
                      <span className="block text-[12.5px] font-normal text-ink-2">Read only: can do more than you</span>
                    ) : null}
                  </TableHead>
                ))
              : [0, 1, 2, 3].map((i) => (
                  <TableHead key={i} scope="col" className={COLUMN}>
                    <Skeleton className="mx-auto h-4 w-20" />
                  </TableHead>
                ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {AREAS.map((area) => (
            <TableRow key={area} className="hover:bg-transparent">
              <TableHead scope="row" className="px-3.5 py-3 text-left align-middle font-medium whitespace-normal">
                {AREA_LABELS[area]}
              </TableHead>
              {roles
                ? roles.map((role) => (
                    <TableCell key={role.id} className={CELL}>
                      <NativeSelect
                        id={`pm-${area}-${role.id}`}
                        aria-label={`${AREA_LABELS[area]} for ${role.name}`}
                        data-area={area}
                        data-role={role.id}
                        value={drafts?.[role.id]?.[area] ?? levelOfKeys(role.permissions, area)}
                        // The Super admin column is locked for everyone, and a role above the signed-in role is out of reach.
                        disabled={readOnly || role.locked || !editable(role)}
                        onChange={(e) => onLevel?.(role.id, area, e.target.value as Level)}
                        className="mx-auto w-[130px]"
                      >
                        {LEVELS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </NativeSelect>
                    </TableCell>
                  ))
                : [0, 1, 2, 3].map((i) => (
                    <TableCell key={i} className={CELL}>
                      <Skeleton className="mx-auto h-[38px] w-[130px]" />
                    </TableCell>
                  ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
