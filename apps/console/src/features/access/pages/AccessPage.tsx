import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { Button } from '@/components/ui/button'
import { Can } from '@/features/auth/components/Can'
import { usePermission } from '@/features/auth/hooks/usePermission'
import { useSession } from '@/features/auth/hooks/session'
import { InviteDialog } from '../components/InviteDialog'
import { Panel } from '../components/Panel'
import { RolesMatrix } from '../components/RolesMatrix'
import { RolesSection } from '../components/RolesSection'
import { SignInSecurity } from '../components/SignInSecurity'
import { StaffSection } from '../components/StaffSection'
import { useRoles, useStaff } from '../hooks/useAccessData'

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

export default function AccessPage() {
  const session = useSession()
  const staff = useStaff()
  const roles = useRoles()
  const canManage = usePermission('access.manage').allowed
  const [inviteOpen, setInviteOpen] = useState(false)
  const inviteButton = useRef<HTMLButtonElement>(null)
  const members = staff.data?.items
  const selfId = session.status === 'authenticated' ? session.user.id : undefined
  const idleMinutes = session.status === 'authenticated' ? session.idleMinutes : undefined

  return (
    <>
      <PageHeader
        title="Access control"
        description="Who can use the platform console, and what each role can do."
        actions={
          <Can permission="access.manage">
            {/* The role names, and which roles hold access.manage, come from the server: wait for them. */}
            <Button ref={inviteButton} id="ac-invite" disabled={!roles.data} onClick={() => setInviteOpen(true)}>
              <Plus aria-hidden="true" /> Invite staff member
            </Button>
          </Can>
        }
      />

      <Panel id="ac-staff" title="Staff" aside={members ? <span className="text-ink-2">{people(members.length)}</span> : null}>
        {staff.isError && !members ? (
          <div className="p-4">
            <QueryErrorPanel title="Could not load the staff." error={staff.error} onRetry={() => void staff.refetch()} />
          </div>
        ) : members && members.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-ink-2">There is no one with access yet.</p>
        ) : (
          <StaffSection members={members} roles={roles.data?.items} selfId={selfId} canManage={canManage} />
        )}
      </Panel>

      {roles.isError && !roles.data ? (
        <Panel id="ac-roles" title="What each role can do">
          <div className="p-4">
            <QueryErrorPanel title="Could not load what each role can do." error={roles.error} onRetry={() => void roles.refetch()} />
          </div>
        </Panel>
      ) : roles.data ? (
        <RolesSection roles={roles.data.items} canManage={canManage} />
      ) : (
        <Panel id="ac-roles" title="What each role can do">
          <RolesMatrix roles={undefined} />
        </Panel>
      )}

      {roles.data ? (
        <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={roles.data.items} members={members ?? []} returnFocusTo={inviteButton} />
      ) : null}

      <Panel id="ac-security" title="Sign-in security">
        <SignInSecurity idleMinutes={idleMinutes} />
      </Panel>
    </>
  )
}
