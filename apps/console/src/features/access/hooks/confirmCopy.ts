import type { Role } from '@/features/auth/api/types'
import type { RoleInfo, StaffMember } from '../api/types'
import { describePermission, holdsManage, lostPermissions } from './permissionDiff'

export type PendingChange =
  | { kind: 'role'; member: StaffMember; to: Role }
  | { kind: 'deactivate'; member: StaffMember }
  | { kind: 'remove'; member: StaffMember }

export interface ConfirmCopy {
  title: string
  /** Paragraphs before the list. */
  intro: string[]
  /** Heading of the list, when there is one. */
  listTitle?: string
  /** What the person loses, one line each. */
  items: string[]
  /** Paragraphs after the list. */
  outro: string[]
  confirmLabel: string
  destructive: boolean
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const roleOf = (roles: RoleInfo[], id: Role) => roles.find((r) => r.id === id)

/** Whether changing to `to` needs a question first: it takes something away, or hands out access.manage. */
export function roleChangeNeedsConfirm(roles: RoleInfo[], member: StaffMember, to: Role): boolean {
  const from = roleOf(roles, member.role)
  const next = roleOf(roles, to)
  if (!from || !next) return true // not sure what changes: ask
  return lostPermissions(from.permissions, next.permissions).length > 0 || (holdsManage(next.permissions) && !holdsManage(from.permissions))
}

/** The words of a confirm dialog: names the person and what they lose. */
export function confirmCopy(change: PendingChange, roles: RoleInfo[]): ConfirmCopy {
  const { member } = change
  const name = member.name
  const held = roleOf(roles, member.role)
  const heldItems = (held?.permissions ?? []).map((k) => sentence(describePermission(k)))

  if (change.kind === 'role') {
    const from = held
    const next = roleOf(roles, change.to)
    const lost = from && next ? lostPermissions(from.permissions, next.permissions) : []
    const grantsManage = !!next && holdsManage(next.permissions) && !(from && holdsManage(from.permissions))
    const intro: string[] = []
    if (grantsManage) {
      intro.push(
        `${next.name} can change who has access to this console and what every role can do. ${name} will be able to do that too.`,
      )
    }
    return {
      title: `Change ${name} to ${next?.name ?? 'this role'}?`,
      intro,
      listTitle: lost.length > 0 ? `${name} will lose:` : undefined,
      items: lost.map((k) => sentence(describePermission(k))),
      outro: [`${name} is signed out when you confirm, and signs in again with the new role.`],
      confirmLabel: 'Change role',
      destructive: lost.length > 0,
    }
  }

  const invited = member.status === 'invited'
  if (change.kind === 'deactivate') {
    return {
      title: `Deactivate ${name}?`,
      intro: [`${name} can no longer sign in, and is signed out when you confirm.`],
      listTitle: heldItems.length > 0 ? `${name} will lose, as ${held?.name}:` : undefined,
      items: heldItems,
      outro: ['You can reactivate them later.'],
      confirmLabel: 'Deactivate',
      destructive: true,
    }
  }

  return {
    title: `Remove ${name}?`,
    intro: invited
      ? [`${name} has not signed in yet. The invitation stops working when you confirm.`]
      : [`${name} loses access to this console for good, and is signed out when you confirm. What they did stays in the audit log.`],
    listTitle: !invited && heldItems.length > 0 ? `${name} will lose, as ${held?.name}:` : undefined,
    items: invited ? [] : heldItems,
    outro: ['To give them access again, invite them again.'],
    confirmLabel: 'Remove',
    destructive: true,
  }
}
