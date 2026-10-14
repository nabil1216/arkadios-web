import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ExtendDays } from '../api/types'
import { DaysChoice } from './DaysChoice'

function Harness({ initial = 14, onChange = () => {}, disabled = false }: { initial?: ExtendDays; onChange?: (d: ExtendDays) => void; disabled?: boolean }) {
  const [value, setValue] = useState<ExtendDays>(initial)
  return (
    <>
      <span id="lbl">Extend by</span>
      <DaysChoice
        labelledBy="lbl"
        value={value}
        disabled={disabled}
        onChange={(d) => {
          setValue(d)
          onChange(d)
        }}
      />
    </>
  )
}

describe('DaysChoice', () => {
  it('is a radio group named by its label, with 7, 14 and 30 days', () => {
    render(<Harness />)
    const group = screen.getByRole('radiogroup', { name: 'Extend by' })
    expect(group).toBeInTheDocument()
    expect(screen.getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['7', '14', '30'])
    expect(screen.getByRole('radio', { name: '14 days' })).toBeChecked()
  })

  it('selects another number of days with a click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: '30 days' }))
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked()
    expect(screen.getByRole('radio', { name: '14 days' })).not.toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith(30)
  })

  it('moves with the arrow keys', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness initial={7} onChange={onChange} />)
    await user.tab()
    expect(screen.getByRole('radio', { name: '7 days' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(onChange).toHaveBeenLastCalledWith(14)
    expect(screen.getByRole('radio', { name: '14 days' })).toBeChecked()
  })

  it('does nothing while disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Harness disabled onChange={onChange} />)
    for (const r of screen.getAllByRole('radio')) expect(r).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: '30 days' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
