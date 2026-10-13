import { Navigate } from 'react-router'
import { safeNext } from '@/lib/safe-redirect'
import { useSession } from '../hooks/session'

/** "/" sends each role to the home page the server chose for it. */
export function HomeRedirect() {
  const session = useSession()
  if (session.status !== 'authenticated') return null
  return <Navigate to={safeNext(session.user.home) ?? '/overview'} replace />
}
