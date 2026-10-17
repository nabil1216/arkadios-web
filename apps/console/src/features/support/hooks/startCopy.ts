import type { ConfirmCopy } from '@/components/ConfirmDialog'

/** What stays blocked in a session that can make changes. The same list as the contract (docs/ARCHITECTURE.md, Support access). */
export const STILL_BLOCKED = [
  'Changing passwords or MFA',
  'Creating or changing users, roles or permissions',
  'Exporting data',
  'Deleting anything',
  'Approving or signing anything',
  'Changing billing or integration settings',
]

/** The question before a session that can make changes: names the tenant, the user and the length, and what stays blocked. */
export function editConfirmCopy(tenantName: string, userName: string, minutes: number): ConfirmCopy {
  return {
    title: 'Start a session that can make changes?',
    intro: [`You will be signed in as ${userName} at ${tenantName} for ${minutes} minutes, and can change their data.`],
    lists: [{ title: 'Even then, the tenant blocks:', items: STILL_BLOCKED }],
    outro: ["Everything you do is recorded, and the client's admins can see it."],
    confirmLabel: 'Start with edit access',
    destructive: false,
  }
}

/** The question before revoking someone else's session: it stops at once, and they have to start again with a new reason. */
export function revokeConfirmCopy(session: { staffName: string; tenantUserName: string; tenantName: string }): ConfirmCopy {
  return {
    title: `Revoke ${session.staffName}'s session?`,
    intro: [
      `${session.staffName} is signed in as ${session.tenantUserName} at ${session.tenantName}. Their access stops at once, and they have to start a new session, with a new reason, to get back in.`,
    ],
    lists: [],
    outro: ['The session is recorded as revoked by you.'],
    confirmLabel: 'Revoke session',
    destructive: true,
  }
}
