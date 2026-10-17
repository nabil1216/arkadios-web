import { useCallback, useLayoutEffect, useRef } from 'react'
import { useSearchParams, type NavigateOptions } from 'react-router'

/**
 * The address bar's search params, with a way to change them that always starts from the newest URL.
 *
 * React Router's `setSearchParams` works from the params of the render it came from. A handler that runs later (a search
 * that waited for the typing to pause) can then write an old snapshot over a filter changed in between. `commit` instead
 * hands your function the latest params we know of, including a change that has been asked for and not yet rendered, and
 * keeps what it returns as the new latest straight away. A handler from any earlier render is safe to call.
 */
export function useLatestSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const latest = useRef(searchParams)
  const seen = useRef(searchParams.toString())

  // When the address really changes (our own change arriving, the back button) the rendered params are the newest.
  useLayoutEffect(() => {
    const now = searchParams.toString()
    if (now === seen.current) return
    seen.current = now
    latest.current = new URLSearchParams(searchParams)
  })

  const commit = useCallback(
    (change: (latest: URLSearchParams) => URLSearchParams, options?: NavigateOptions) => {
      const next = change(new URLSearchParams(latest.current))
      latest.current = next
      setSearchParams(next, options)
    },
    [setSearchParams],
  )

  return { searchParams, commit }
}
