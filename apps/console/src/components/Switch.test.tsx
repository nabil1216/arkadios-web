import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

function Controlled({ onChange = () => {} }: { onChange?: (on: boolean) => void }) {
  const [on, setOn] = useState(false)
  return (
    <Switch
      aria-label="Reports on Essentials"
      checked={on}
      onChange={(e) => {
        setOn(e.target.checked)
        onChange(e.target.checked)
      }}
    />
  )
}

describe('Switch', () => {
  it('is a switch with the label it was given', () => {
    render(<Switch aria-label="Reports on Essentials" checked={false} onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Reports on Essentials' })).not.toBeChecked()
  })

  it('shows what is on', () => {
    render(<Switch aria-label="x" checked onChange={() => {}} />)
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('toggles with a click', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Controlled onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(screen.getByRole('switch')).toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith(true)
    await user.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('toggles with the keyboard', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    await user.tab()
    expect(screen.getByRole('switch')).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByRole('switch')).toBeChecked()
  })

  it('does nothing when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Switch aria-label="x" checked={false} disabled onChange={onChange} />)
    await user.click(screen.getByRole('switch'))
    expect(screen.getByRole('switch')).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })
})
