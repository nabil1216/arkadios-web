/// <reference types="node" />
import { afterEach, describe, expect, it } from 'vitest'
import { formatAgo, formatDate, formatDay, formatMonth, formatMonthLong } from './format'

const ORIGINAL_TZ = process.env.TZ
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ
  else process.env.TZ = ORIGINAL_TZ
})

const LATE_UTC = '2026-10-21T23:30:00.000Z' // still the 21st in UTC, already the 22nd in Auckland

describe('deadlines are shown in the viewer\'s local time', () => {
  it.each([
    ['UTC', 'Oct 21'],
    ['America/Los_Angeles', 'Oct 21'],
    ['Pacific/Auckland', 'Oct 22'],
  ])('formatDay in %s is %s', (tz, text) => {
    process.env.TZ = tz
    expect(formatDay(LATE_UTC)).toBe(text)
  })

  it.each([
    ['UTC', 'Oct 21, 2026'],
    ['Pacific/Auckland', 'Oct 22, 2026'],
  ])('formatDate in %s is %s', (tz, text) => {
    process.env.TZ = tz
    expect(formatDate(LATE_UTC)).toBe(text)
  })
})

describe('formatMonth', () => {
  it.each([
    ['2026-09', 'Sep 2026'],
    ['2026-10', 'Oct 2026'],
    ['2026-01', 'Jan 2026'],
    ['2027-12', 'Dec 2027'],
  ])('%s is %s', (month, text) => {
    expect(formatMonth(month)).toBe(text)
  })

  it('does not move to another month in a far time zone', () => {
    process.env.TZ = 'Pacific/Kiritimati' // UTC+14
    expect(formatMonth('2026-10')).toBe('Oct 2026')
    process.env.TZ = 'Pacific/Pago_Pago' // UTC-11
    expect(formatMonth('2026-10')).toBe('Oct 2026')
  })
})

describe('formatMonthLong', () => {
  it.each([
    ['2026-09', 'September 2026'],
    ['2026-10', 'October 2026'],
    ['2027-01', 'January 2027'],
  ])('%s is %s', (month, text) => {
    expect(formatMonthLong(month)).toBe(text)
  })
})

describe('formatAgo', () => {
  const now = Date.parse('2026-10-14T12:00:00.000Z')
  const before = (ms: number) => new Date(now - ms).toISOString()
  it.each([
    [0, 'this minute'],
    [12 * 60_000, '12 minutes ago'],
    [2 * 3_600_000, '2 hours ago'],
    [24 * 3_600_000, 'yesterday'],
    [6 * 86_400_000, '6 days ago'],
  ])('%i ms ago reads "%s"', (ms, text) => {
    expect(formatAgo(before(ms), now)).toBe(text)
  })
})
