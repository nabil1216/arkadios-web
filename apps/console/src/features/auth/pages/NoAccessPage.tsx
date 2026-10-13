import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { AREA_LABELS, ROLE_LABELS, type Area } from '../permissions'
import { useSession } from '../session'

export function NoAccessPage({ area }: { area: Area }) {
  const session = useSession()
  if (session.status !== 'authenticated') return null
  const { user } = session
  return (
    <>
      <PageHeader
        title="No access"
        description={`Your role, ${ROLE_LABELS[user.role]}, does not include ${AREA_LABELS[area]}.`}
      />
      <p className="max-w-[60ch] text-ink-2">
        A Super admin can change what each role can do under Access control.
      </p>
      <p className="mt-4">
        <Button asChild variant="secondary">
          <Link to={user.home}>Go to your home page</Link>
        </Button>
      </p>
    </>
  )
}
