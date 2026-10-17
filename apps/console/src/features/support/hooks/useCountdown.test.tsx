import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './useCountdown'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.parse('2026-10-14T12:00:00Z'))
})
afterEach(() => vi.useRealTimers())

describe('useCountdown', () => {
  it('counts down once a second and stops at zero', () => {
    const { result } = renderHook(() => useCountdown('2026-10-14T12:00:03Z'))
    expect(result.current).toBe(3000)
    act(() => void vi.advanceTimersByTime(1000))
    expect(result.current).toBe(2000)
    act(() => void vi.advanceTimersByTime(5000))
    expect(result.current).toBe(0)
  })

  it('is 0 with nothing to count to, and does not leave a timer running', () => {
    const { result, unmount } = renderHook(() => useCountdown(undefined))
    expect(result.current).toBe(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears its timer when the component goes away', () => {
    const { unmount } = renderHook(() => useCountdown('2026-10-14T12:30:00Z'))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
