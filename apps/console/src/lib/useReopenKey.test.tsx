import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useReopenKey } from './useReopenKey'

describe('useReopenKey', () => {
  it('stays the same while open or closed, and goes up each time it opens again', () => {
    const { result, rerender } = renderHook(({ open }) => useReopenKey(open), { initialProps: { open: false } })
    const closed = result.current
    rerender({ open: false })
    expect(result.current).toBe(closed)
    rerender({ open: true })
    const first = result.current
    expect(first).toBe(closed + 1)
    rerender({ open: true })
    expect(result.current).toBe(first)
    rerender({ open: false })
    expect(result.current).toBe(first) // closing keeps the dialog, so it can fade out
    rerender({ open: true })
    expect(result.current).toBe(first + 1)
  })

  it('starts at 0 for a dialog that is open from the start', () => {
    const { result } = renderHook(() => useReopenKey(true))
    expect(result.current).toBe(0)
  })
})
