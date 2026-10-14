import { useState } from 'react'

/**
 * A number that goes up each time `open` turns true. Use it as the `key` of a Radix dialog so every opening gets
 * a fresh dialog. Radix fades the overlay and the content out separately: reopen between the two and the overlay is
 * rebuilt after the content, lands on top of it and swallows every click.
 */
export function useReopenKey(open: boolean): number {
  const [state, setState] = useState({ open, key: 0 })
  if (state.open !== open) setState({ open, key: open ? state.key + 1 : state.key })
  return state.key
}
