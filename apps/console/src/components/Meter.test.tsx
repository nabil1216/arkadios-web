import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Meter } from './Meter'

const meter = (value: number, max: number) => {
  const { container } = render(<Meter value={value} max={max} />)
  const outer = container.firstElementChild as HTMLElement
  return { outer, bar: outer.firstElementChild as HTMLElement }
}

describe('Meter', () => {
  it('is decorative: hidden from assistive technology', () => {
    expect(meter(1, 2).outer).toHaveAttribute('aria-hidden', 'true')
  })

  it('fills in proportion to usage', () => {
    expect(meter(64, 100).bar.style.width).toBe('64%')
  })

  it('is teal below 90%', () => {
    const { outer, bar } = meter(89, 100)
    expect(outer).toHaveAttribute('data-meter', 'ok')
    expect(bar).toHaveClass('bg-teal')
  })

  it('turns amber from 90%', () => {
    const { outer, bar } = meter(47, 50)
    expect(outer).toHaveAttribute('data-meter', 'warn')
    expect(bar.className).toContain('bg-[#c27a00]')
  })

  it('turns red at 100% and never overflows', () => {
    const { outer, bar } = meter(120, 100)
    expect(outer).toHaveAttribute('data-meter', 'full')
    expect(bar).toHaveClass('bg-red')
    expect(bar.style.width).toBe('100%')
  })

  it('handles a limit of zero', () => {
    expect(meter(0, 0).bar.style.width).toBe('0%')
  })
})
