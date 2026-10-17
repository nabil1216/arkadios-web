import { useQuery } from '@tanstack/react-query'
import { usePermission } from '@/features/auth/hooks/usePermission'
import { activeSessionKey, fetchActiveSession } from '../api/support'

/**
 * The signed-in person's own open session, for the banner and for "end the first one". Only roles that can see
 * Support access ask. A session that runs out is noticed on the next read, so it is re-read when the timer says it is over.
 */
export function useActiveSession() {
  const allowed = usePermission('support.view').allowed
  return useQuery({ queryKey: activeSessionKey, queryFn: fetchActiveSession, enabled: allowed, refetchOnWindowFocus: true })
}
