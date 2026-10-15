import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/hooks/session'
import { Can } from '@/features/auth/components/Can'
import { permissionsKey } from '@/features/auth/api/permissions'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import { accessErrorText, isStale } from '../api/problems'
import { accessKey, rolesKey, updateRolePermissions } from '../api/access'
import type { RoleInfo, RoleList } from '../api/types'
import { rolesConfirmCopy, type RoleChange } from '../hooks/roleDraft'
import { canChangeRole } from '../hooks/outranks'
import { useRoleDrafts } from '../hooks/useRoleDrafts'
import { ConfirmDialog } from './ConfirmDialog'
import { Panel } from './Panel'
import { RolesMatrix } from './RolesMatrix'

interface Outcome {
  role: RoleInfo
  saved?: RoleInfo
  error?: unknown
}

/** One PUT per changed role, all at once. Each role succeeds or fails on its own. */
async function saveChanged(changes: RoleChange[]): Promise<Outcome[]> {
  return Promise.all(
    changes.map(async ({ role, next }): Promise<Outcome> => {
      try {
        return { role, saved: await updateRolePermissions(role.id, { permissions: next, version: role.version }) }
      } catch (error) {
        return { role, error }
      }
    }),
  )
}

function problemText({ role, error }: Outcome): { text: string; conflict: boolean } {
  if (isStale(error)) return { text: `${role.name} was changed by someone else. Reload to see the latest.`, conflict: true }
  return { text: `${role.name}: ${accessErrorText(error, 'could not be saved. Try again.')}`, conflict: false }
}

interface RolesSectionProps {
  roles: RoleInfo[]
  canManage: boolean
}

/** "What each role can do": pick levels, then Save changes. Taking permissions away, or handing out access.manage, asks first. */
export function RolesSection({ roles, canManage }: RolesSectionProps) {
  const queryClient = useQueryClient()
  const guard = useSubmitGuard()
  const session = useSession()
  const actorRole = session.status === 'authenticated' ? session.user.role : undefined
  const { drafts, changes, dirty, setLevel, discard } = useRoleDrafts(roles)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [problems, setProblems] = useState<Array<{ text: string; conflict: boolean }>>([])

  const save = useMutation({
    mutationFn: saveChanged,
    onSuccess: (outcomes) => {
      const saved = outcomes.flatMap((o) => (o.saved ? [o.saved] : []))
      if (saved.length > 0) {
        // Show the saved roles at once (their version moved, so their drafts drop), then read them again.
        queryClient.setQueryData<RoleList>(rolesKey, (old) => old && { items: old.items.map((r) => saved.find((s) => s.id === r.id) ?? r) })
        // What the signed-in role can do may have changed: read the permission map again as well.
        void queryClient.invalidateQueries({ queryKey: permissionsKey })
      }
      void queryClient.invalidateQueries({ queryKey: accessKey })
      const failed = outcomes.filter((o) => o.error)
      setProblems(failed.map(problemText))
      if (failed.length === 0) toast('Role changes saved')
    },
  })

  const copy = rolesConfirmCopy(changes)

  function runSave() {
    setProblems([])
    return save.mutateAsync(changes).then(() => undefined)
  }

  function onSave() {
    if (copy) setConfirmOpen(true)
    else void guard.run(runSave)
  }

  function onDiscard() {
    discard()
    setProblems([])
    toast('Changes discarded')
  }

  // A role whose version moved on drops its own edit; edits on other roles stay.
  function reload() {
    setProblems([])
    void queryClient.invalidateQueries({ queryKey: rolesKey })
  }

  return (
    <Panel
      id="ac-roles"
      title="What each role can do"
      aside={
        <Can permission="access.manage">
          <div className="flex gap-2">
            <Button id="pm-discard" variant="secondary" size="sm" disabled={!dirty || save.isPending} onClick={onDiscard}>
              Discard
            </Button>
            <Button id="pm-save" size="sm" disabled={!dirty || save.isPending} onClick={onSave}>
              Save changes
            </Button>
          </div>
        </Can>
      }
    >
      {problems.length > 0 ? (
        <div role="alert" className="border-b border-line bg-red-tint px-[18px] py-3 text-red">
          <h3 className="mb-1">Some changes were not saved.</h3>
          <ul className="m-0 list-disc pl-5">
            {problems.map((p) => (
              <li key={p.text}>{p.text}</li>
            ))}
          </ul>
          {problems.some((p) => p.conflict) ? (
            <Button variant="secondary" size="sm" className="mt-3" onClick={reload}>
              Reload roles
            </Button>
          ) : null}
        </div>
      ) : null}
      <RolesMatrix roles={roles} drafts={drafts} readOnly={!canManage || save.isPending}
        onLevel={setLevel}
        editable={(role) => canChangeRole(roles, actorRole, role.id)}
      />
      <ConfirmDialog
        copy={confirmOpen ? copy : null}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await runSave()
          setConfirmOpen(false)
        }}
      />
    </Panel>
  )
}
