import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSubmitGuard } from './useSubmitGuard'

function Probe({ task }: { task: () => Promise<unknown> }) {
  const { run, pending } = useSubmitGuard()
  return (
    <button disabled={pending} onClick={() => void run(task)}>
      Go
    </button>
  )
}

describe('useSubmitGuard', () => {
  it('starts the task once when the button is clicked twice in the same instant', async () => {
    let finish!: () => void
    const task = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    render(<Probe task={task} />)
    const button = screen.getByRole('button', { name: 'Go' })
    act(() => {
      fireEvent.click(button) // no re-render between the clicks, so `disabled` is not set yet
      fireEvent.click(button)
    })
    expect(task).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    await act(async () => finish())
  })

  it('lets the next click through once the task has settled', async () => {
    const task = vi.fn(() => Promise.resolve())
    render(<Probe task={task} />)
    const button = screen.getByRole('button', { name: 'Go' })
    await act(async () => fireEvent.click(button))
    expect(button).toBeEnabled()
    await act(async () => fireEvent.click(button))
    expect(task).toHaveBeenCalledTimes(2)
  })

  it('lets the next click through after the task failed, without an unhandled rejection', async () => {
    const task = vi.fn(() => Promise.reject(new Error('boom')))
    render(<Probe task={task} />)
    const button = screen.getByRole('button', { name: 'Go' })
    await act(async () => fireEvent.click(button))
    expect(button).toBeEnabled()
    await act(async () => fireEvent.click(button))
    expect(task).toHaveBeenCalledTimes(2)
  })
})
