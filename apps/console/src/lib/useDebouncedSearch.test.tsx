import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SEARCH_DEBOUNCE_MS, useDebouncedSearch } from './useDebouncedSearch'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(initial = '') {
  const onCommit = vi.fn()
  const hook = renderHook(({ committed }) => useDebouncedSearch(committed, onCommit), { initialProps: { committed: initial } })
  return { onCommit, ...hook }
}

describe('useDebouncedSearch', () => {
  it('applies the text once the typing pauses, trimmed, and once', () => {
    const { result, onCommit } = setup()
    act(() => result.current.setText('n'))
    act(() => result.current.setText('no'))
    act(() => result.current.setText(' north '))
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1))
    expect(onCommit).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(1))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith('north')
    expect(result.current.text).toBe(' north ')
  })

  it('does not wait when the text is what is already applied', () => {
    const { result, onCommit } = setup('north')
    act(() => result.current.setText('north '))
    act(() => void vi.advanceTimersByTime(1000))
    expect(onCommit).not.toHaveBeenCalled()
    act(() => result.current.setText('nor'))
    act(() => result.current.setText('north')) // back to what is applied
    act(() => void vi.advanceTimersByTime(1000))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('applies at once on commit (Enter), and not again when the wait is over', () => {
    const { result, onCommit } = setup()
    act(() => result.current.setText('north'))
    act(() => result.current.commit())
    expect(onCommit).toHaveBeenCalledWith('north')
    act(() => void vi.advanceTimersByTime(1000))
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('hands a waiting search to the caller, and then does not apply it itself', () => {
    const { result, onCommit } = setup()
    act(() => result.current.setText(' o '))
    let taken: string | undefined
    act(() => void (taken = result.current.takePending()))
    expect(taken).toBe('o')
    act(() => void vi.advanceTimersByTime(1000))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('has nothing to hand over when no search is waiting', () => {
    const { result } = setup()
    expect(result.current.takePending()).toBeUndefined()
    act(() => result.current.setText('x'))
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    expect(result.current.takePending()).toBeUndefined() // it was applied already
  })

  it('uses the newest onCommit when the timer fires, even one from a render that has not had its effects run', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(({ cb }) => useDebouncedSearch('', cb), { initialProps: { cb: first } })
    act(() => result.current.setText('o'))
    rerender({ cb: second })
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith('o')
  })

  it('shows an address that changed on its own, and drops a waiting search', () => {
    const { result, rerender, onCommit } = setup('north')
    act(() => result.current.setText('south'))
    rerender({ committed: 'east' }) // the back button
    expect(result.current.text).toBe('east')
    act(() => void vi.advanceTimersByTime(1000))
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('does not take its own change coming back for someone else\'s', () => {
    const { result, rerender, onCommit } = setup()
    act(() => result.current.setText('north'))
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    act(() => result.current.setText('northw')) // typing goes on while the first change is on its way
    rerender({ committed: 'north' })
    expect(result.current.text).toBe('northw')
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS))
    expect(onCommit).toHaveBeenLastCalledWith('northw')
  })

  it('stops waiting when the page goes away', () => {
    const { result, unmount, onCommit } = setup()
    act(() => result.current.setText('north'))
    unmount()
    act(() => void vi.advanceTimersByTime(1000))
    expect(onCommit).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
