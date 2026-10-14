import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge, type StatusKind } from './StatusBadge'

describe('StatusBadge', () => {
  it.each<[StatusKind, string, string]>([
    ['active', 'Active', 'text-green'],
    ['trial', 'Trial', 'text-blue'],
    ['suspended', 'Suspended', 'text-amber'],
    ['offboarding', 'Offboarding', 'text-ink-2'],
    ['overdue', 'Overdue', 'text-red'],
    ['ok', 'Up to date', 'text-green'],
    ['live', 'In progress', 'text-teal-ink'],
    ['invited', 'Invited', 'text-blue'],
    ['deactivated', 'Deactivated', 'text-ink-2'],
    ['mfaOn', 'MFA on', 'text-green'],
    ['mfaNotSet', 'MFA not set', 'text-amber'],
  ])('%s shows the word "%s" so colour is never the only signal', (kind, label, tone) => {
    render(<StatusBadge kind={kind} />)
    const badge = screen.getByText(label)
    expect(badge).toHaveClass(tone)
    expect(badge.className).toContain('before:bg-current') // the dot
  })
})
