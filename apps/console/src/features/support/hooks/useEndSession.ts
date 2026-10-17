import { useMutation, useQueryClient } from '@tanstack/react-query'
import { endSession, supportKey } from '../api/support'

/** Ends (or, for someone else's session, revokes) a session, then reads every support query again. */
export function useEndSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => endSession(id),
    // Whatever the outcome, the list may have moved: read it again.
    onSettled: () => queryClient.invalidateQueries({ queryKey: supportKey }),
  })
}
