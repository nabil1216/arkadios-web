import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Role } from '@/features/auth/api/types'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import { accessKey, removeStaff, resendInvite, updateStaff } from '../api/access'
import { accessErrorText, isStale } from '../api/problems'
import type { RoleInfo, StaffMember, UpdateStaffInput } from '../api/types'
import { confirmCopy, roleChangeNeedsConfirm, type PendingChange } from '../hooks/confirmCopy'
import { ConfirmDialog } from './ConfirmDialog'
import { StaffTable } from './StaffTable'

interface StaffSectionProps {
  members: StaffMember[] | undefined
  roles: RoleInfo[] | undefined
  selfId: string | undefined
  /** access.manage: without it the table is read only. */
  canManage: boolean
}

const STALE_NOTE = 'This was changed by someone else. The list now shows the latest: check it and try again.'

/** The staff table with its row actions, the questions before risky changes, and the messages when the server says no. */
export function StaffSection({ members, roles, selfId, canManage }: StaffSectionProps) {
  const queryClient = useQueryClient()
  const guard = useSubmitGuard()
  const [pending, setPending] = useState<PendingChange | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  // Whatever the outcome, the list may have moved: read it again.
  const refresh = () => queryClient.invalidateQueries({ queryKey: accessKey })
  const update = useMutation({
    mutationFn: ({ member, input }: { member: StaffMember; input: Omit<UpdateStaffInput, 'version'> }) =>
      updateStaff(member.id, { ...input, version: member.version }),
    onSettled: refresh,
  })
  const remove = useMutation({ mutationFn: (member: StaffMember) => removeStaff(member.id, member.version), onSettled: refresh })
  const resend = useMutation({ mutationFn: (member: StaffMember) => resendInvite(member.id), onSettled: refresh })

  const roleName = (id: Role) => roles?.find((r) => r.id === id)?.name ?? id

  /** Runs a change that needs no question. A failure goes to the banner above the table. */
  function direct(task: () => Promise<unknown>, done: string, failed: string) {
    setProblem(null)
    void guard.run(async () => {
      try {
        await task()
        toast(done)
      } catch (e) {
        setProblem(isStale(e) ? STALE_NOTE : accessErrorText(e, failed))
      }
    })
  }

  /** Runs a confirmed change. A failure stays in the dialog, except a stale one, which closes it. */
  async function confirmed(change: PendingChange) {
    try {
      if (change.kind === 'role') {
        await update.mutateAsync({ member: change.member, input: { role: change.to } })
        toast(`${change.member.name} is now ${roleName(change.to)}`)
      } else if (change.kind === 'deactivate') {
        await update.mutateAsync({ member: change.member, input: { status: 'deactivated' } })
        toast(`${change.member.name} was deactivated`)
      } else {
        await remove.mutateAsync(change.member)
        toast(`${change.member.name} was removed`)
      }
      setPending(null)
    } catch (e) {
      if (!isStale(e)) throw new Error(accessErrorText(e, 'Could not make the change. Try again.'), { cause: e })
      setPending(null)
      setProblem(STALE_NOTE)
    }
  }

  const actions =
    canManage && roles
      ? {
          busy: guard.pending,
          onRoleChange(member: StaffMember, to: Role) {
            if (to === member.role) return
            if (roleChangeNeedsConfirm(roles, member, to)) {
              setProblem(null)
              setPending({ kind: 'role', member, to })
            } else {
              direct(
                () => update.mutateAsync({ member, input: { role: to } }),
                `${member.name} is now ${roleName(to)}`,
                `Could not change the role of ${member.name}. Try again.`,
              )
            }
          },
          onDeactivate(member: StaffMember) {
            setProblem(null)
            setPending({ kind: 'deactivate', member })
          },
          onRemove(member: StaffMember) {
            setProblem(null)
            setPending({ kind: 'remove', member })
          },
          onReactivate(member: StaffMember) {
            direct(
              () => update.mutateAsync({ member, input: { status: 'active' } }),
              `${member.name} is active again`,
              `Could not reactivate ${member.name}. Try again.`,
            )
          },
          onResend(member: StaffMember) {
            direct(() => resend.mutateAsync(member), `Invitation sent again to ${member.email}`, `Could not send the invitation again. Try again.`)
          },
        }
      : undefined

  return (
    <>
      {problem ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-red-tint px-[18px] py-3 text-red">
          <span>{problem}</span>
          <Button variant="secondary" size="sm" onClick={() => setProblem(null)}>
            Dismiss
          </Button>
        </div>
      ) : null}
      <StaffTable members={members} roles={roles} selfId={selfId} actions={actions} />
      <ConfirmDialog
        copy={pending && roles ? confirmCopy(pending, roles) : null}
        onCancel={() => setPending(null)}
        onConfirm={() => confirmed(pending!)}
      />
    </>
  )
}
