import { useQuery } from '@tanstack/react-query'
import { usePermission } from '@/features/auth/hooks/usePermission'
import { activeSessionKey, fetchActiveSession } from '../api/support'

/**
 * The signed-in person's own open session, for the banner and for "end the first one". Only roles that can see
 * Support access ask. A session that runs out is noticed on the next read, so it is re-read when the timer says it is over;
 * one ended in the workspace tab or revoked by someone else is noticed when the window is focused again, or within 30 seconds
 * (so, unlike most queries, it is never treated as fresh).
 */
export function useActiveSession() {
  const allowed = usePermission('support.view').allowed
  return useQuery({ queryKey: activeSessionKey, queryFn: fetchActiveSession, enabled: allowed, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000 })
}
