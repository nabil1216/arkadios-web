import { describe, expect, it } from 'vitest'
import { formatCountdown, formatLength, howItEnded } from './sessionText'

describe('howItEnded', () => {
  it.each([
    [{ status: 'ended', endedByName: 'Omar Haddad' }, 'Ended by Omar Haddad'],
    [{ status: 'revoked', endedByName: 'Dana Whitfield' }, 'Revoked by Dana Whitfield'],
    [{ status: 'revoked', endedByName: 'Handoff code reused' }, 'Revoked by Handoff code reused'],
    [{ status: 'expired', endedByName: null }, 'Expired'],
    [{ status: 'active', endedByName: null }, ''],
    [{ status: 'ended', endedByName: null }, 'Ended'],
  ] as const)('%j reads "%s"', (session, text) => {
    expect(howItEnded(session)).toBe(text)
  })
})

describe('formatLength', () => {
  const at = (iso: string) => iso
  it('counts minutes, then hours and minutes', () => {
    expect(formatLength(at('2026-10-14T12:00:00Z'), at('2026-10-14T12:24:00Z'))).toBe('24 min')
    expect(formatLength(at('2026-10-14T12:00:00Z'), at('2026-10-14T13:05:00Z'))).toBe('1 h 5 min')
  })
  it('is at least a minute, and counts an open session up to now', () => {
    expect(formatLength(at('2026-10-14T12:00:00Z'), at('2026-10-14T12:00:10Z'))).toBe('1 min')
    expect(formatLength(at('2026-10-14T12:00:00Z'), null, Date.parse('2026-10-14T12:12:00Z'))).toBe('12 min')
  })
})

describe('formatCountdown', () => {
  it('shows minutes and seconds, rounding up so it never shows 0:00 early', () => {
    expect(formatCountdown(29 * 60_000 + 41_000)).toBe('29:41')
    expect(formatCountdown(59_001)).toBe('1:00')
    expect(formatCountdown(5_000)).toBe('0:05')
  })
  it('stops at zero', () => {
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(-4_000)).toBe('0:00')
  })
})
