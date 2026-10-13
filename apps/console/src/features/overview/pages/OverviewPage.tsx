import { PageHeader } from '@/components/PageHeader'
import { ROLE_LABELS } from '@/features/auth/hooks/permissions'
import { useSession } from '@/features/auth/hooks/session'

export default function OverviewPage() {
  const session = useSession()
  if (session.status !== 'authenticated') return null
  const { user } = session
  return (
    <PageHeader
      title="Platform overview"
      description={`Welcome back, ${user.name.split(' ')[0]}. You are signed in as ${ROLE_LABELS[user.role]}.`}
    />
  )
}
