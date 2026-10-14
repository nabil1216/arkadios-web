import { useCallback, useRef, useState } from 'react'

/**
 * Double-submit protection for a request that must not be sent twice.
 *
 * The guard is a ref set inside the click or submit handler itself, so a second click in the same
 * instant is ignored even though React has not re-rendered the button as disabled yet. `pending`
 * is for the UI (disable the buttons); it is never the only guard.
 *
 * `run` resolves when the task settles. A rejection is not rethrown: the failure belongs to the
 * mutation's `onError`, and `run` only decides whether the task may start.
 */
export function useSubmitGuard() {
  const busy = useRef(false)
  const [pending, setPending] = useState(false)

  const run = useCallback(async (task: () => Promise<unknown>): Promise<void> => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    try {
      await task()
    } catch {
      // reported by the mutation's onError
    } finally {
      busy.current = false
      setPending(false)
    }
  }, [])

  return { run, pending }
}
