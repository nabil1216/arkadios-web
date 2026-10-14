import type { Area, Level, PermissionKey } from '@/features/auth/api/types'
import { AREA_LABELS } from '@/features/auth/hooks/permissions'
import type { RoleInfo } from '../api/types'
import type { ConfirmCopy } from './confirmCopy'
import { describePermission, gainedPermissions, holdsManage, levelOfKeys, lostPermissions } from './permissionDiff'

export const AREAS = Object.keys(AREA_LABELS) as Area[]

/** What the person has picked for one role: a level per area. */
export type RoleDraft = Record<Area, Level>

export const savedRoleDraft = (role: RoleInfo): RoleDraft =>
  Object.fromEntries(AREAS.map((area) => [area, levelOfKeys(role.permissions, area)])) as RoleDraft

/** The keys a draft stands for: the highest key per area, in catalog order. */
export const draftKeys = (draft: RoleDraft): PermissionKey[] =>
  AREAS.flatMap((area) => (draft[area] === 'none' ? [] : [`${area}.${draft[area]}` as PermissionKey]))

export const isRoleChanged = (role: RoleInfo, draft: RoleDraft) => AREAS.some((area) => draft[area] !== levelOfKeys(role.permissions, area))

export interface RoleChange {
  role: RoleInfo
  next: PermissionKey[]
}

/** The roles whose draft differs from what the server has. A locked role never changes. */
export function roleChanges(roles: RoleInfo[], drafts: Record<string, RoleDraft>): RoleChange[] {
  return roles.filter((r) => !r.locked && drafts[r.id] && isRoleChanged(r, drafts[r.id])).map((role) => ({ role, next: draftKeys(drafts[role.id]) }))
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

/**
 * The question before saving a role edit: it names each role, how many people are in it, and what
 * they lose, or that the role gets access.manage. Null when the save takes nothing away and
 * hands out no access.manage.
 */
export function rolesConfirmCopy(changes: RoleChange[]): ConfirmCopy | null {
  const losing = changes.map(({ role, next }) => ({ role, lost: lostPermissions(role.permissions, next) })).filter((c) => c.lost.length > 0)
  const gainingManage = changes.filter(({ role, next }) => holdsManage(next) && !holdsManage(role.permissions) && gainedPermissions(role.permissions, next).length > 0)
  if (losing.length === 0 && gainingManage.length === 0) return null

  return {
    title: losing.length > 0 ? 'Take permissions away from these roles?' : 'Give these roles access to Access control?',
    intro: gainingManage.map(
      ({ role }) =>
        `${role.name} (${people(role.staffCount)}) will be able to change who has access to this console and what every role can do.`,
    ),
    lists: losing.map(({ role, lost }) => ({
      title: `${role.name} (${people(role.staffCount)}) will lose:`,
      items: lost.map((k) => sentence(describePermission(k))),
    })),
    outro: ['The change applies on each person\'s next request. Nobody is signed out.'],
    confirmLabel: 'Save changes',
    destructive: losing.length > 0,
  }
}
