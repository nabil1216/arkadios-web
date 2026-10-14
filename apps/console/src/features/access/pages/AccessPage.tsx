import type { ReactNode } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { QueryErrorPanel } from '@/components/QueryErrorPanel'
import { usePermission } from '@/features/auth/hooks/usePermission'
import { useSession } from '@/features/auth/hooks/session'
import { RolesMatrix } from '../components/RolesMatrix'
import { SignInSecurity } from '../components/SignInSecurity'
import { StaffSection } from '../components/StaffSection'
import { useRoles, useStaff } from '../hooks/useAccessData'

function Panel({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-5 rounded-md border border-line bg-paper">
      <div className="flex items-center justify-between gap-3 border-b border-line-2 px-[18px] py-3.5">
        <h2 id={id}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

export default function AccessPage() {
  const session = useSession()
  const staff = useStaff()
  const roles = useRoles()
  const canManage = usePermission('access.manage').allowed
  const members = staff.data?.items
  const selfId = session.status === 'authenticated' ? session.user.id : undefined
  const idleMinutes = session.status === 'authenticated' ? session.idleMinutes : undefined

  return (
    <>
      <PageHeader title="Access control" description="Who can use the platform console, and what each role can do." />

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

      <Panel id="ac-roles" title="What each role can do">
        {roles.isError && !roles.data ? (
          <div className="p-4">
            <QueryErrorPanel title="Could not load what each role can do." error={roles.error} onRetry={() => void roles.refetch()} />
          </div>
        ) : (
          <RolesMatrix roles={roles.data?.items} />
        )}
      </Panel>

      <Panel id="ac-security" title="Sign-in security">
        <SignInSecurity idleMinutes={idleMinutes} />
      </Panel>
    </>
  )
}
