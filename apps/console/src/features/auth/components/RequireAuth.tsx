import { Navigate, Outlet, useLocation } from 'react-router'
import { PageSpinner } from '@/components/PageSpinner'
import { useSession } from '../session'

/** Cosmetic route guard: the server still checks every request. */
export function RequireAuth() {
  const session = useSession()
  const { pathname, search, hash } = useLocation()

  if (session.status === 'loading') return <PageSpinner />

  if (session.status === 'anonymous') {
    const params = new URLSearchParams()
    // An explicit sign-out starts fresh; idle or expiry returns to the same page.
    if (session.reason !== 'user' && pathname !== '/') params.set('next', pathname + search + hash)
    const query = params.toString()
    return <Navigate to={query ? `/login?${query}` : '/login'} replace />
  }

  return <Outlet />
}
