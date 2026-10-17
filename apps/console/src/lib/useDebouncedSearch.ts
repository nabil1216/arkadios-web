import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 300

/**
 * A search box that applies what was typed once the typing pauses.
 *
 * - The wait is started by the keystroke itself, not by an effect after the render, so there is no moment in which a timer
 *   is running that the page does not know about.
 * - `takePending` is for the other filters: when one changes while a search is waiting, it takes the search over (the
 *   timer is cancelled) so both are applied in one step, instead of two writes that could overwrite each other.
 * - `commit` applies the text now (Enter); `reset` empties the box and drops a waiting search.
 * - When the address changes on its own (back button, "clear"), the box shows it and any waiting search is dropped.
 */
export function useDebouncedSearch(committed: string, onCommit: (q: string) => void, delayMs = SEARCH_DEBOUNCE_MS) {
  const [text, setTextState] = useState(committed)
  const [seenCommitted, setSeenCommitted] = useState(committed)
  const [sentText, setSentText] = useState(committed) // the last text this box applied, for the render below
  // The address changed. If this box did it, the box already shows more than that (the person kept typing); if someone else
  // did (the back button), show it.
  if (committed !== seenCommitted) {
    setSeenCommitted(committed)
    if (committed !== sentText && text.trim() !== committed) setTextState(committed)
  }

  const typed = useRef(text) // the newest text, written by the keystroke
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sent = useRef(committed) // the last text this box applied
  const onCommitRef = useRef(onCommit)
  const committedRef = useRef(committed)
  const previousCommitted = useRef(committed)

  const cancel = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useLayoutEffect(() => {
    onCommitRef.current = onCommit
    committedRef.current = committed
    // The address changed, and not by this box: show it, and forget what was waiting. (A render before our own change has
    // arrived still sees the old address; that is not a change.)
    if (committed !== previousCommitted.current) {
      previousCommitted.current = committed
      if (committed !== sent.current) {
        sent.current = committed
        typed.current = committed
        cancel()
      }
    }
  })
  useEffect(() => cancel, [cancel])

  const markSent = useCallback((q: string) => {
    sent.current = q
    setSentText(q)
  }, [])

  const apply = useCallback(() => {
    timer.current = null
    const q = typed.current.trim()
    markSent(q)
    onCommitRef.current(q)
  }, [markSent])

  const setText = useCallback(
    (next: string) => {
      typed.current = next
      setTextState(next)
      cancel()
      if (next.trim() !== committedRef.current) timer.current = setTimeout(apply, delayMs)
    },
    [apply, cancel, delayMs],
  )

  const commit = useCallback(() => {
    cancel()
    if (typed.current.trim() !== committedRef.current) apply()
  }, [apply, cancel])

  /** Empties the box and drops a waiting search. The caller clears the applied value itself. */
  const reset = useCallback(() => {
    cancel()
    typed.current = ''
    setTextState('')
  }, [cancel])

  /** The text waiting to be applied, or undefined if none is. Taking it cancels the wait: the caller applies it. */
  const takePending = useCallback((): string | undefined => {
    if (timer.current === null) return undefined
    cancel()
    const q = typed.current.trim()
    markSent(q)
    return q
  }, [cancel, markSent])

  return { text, setText, commit, takePending, reset }
}
