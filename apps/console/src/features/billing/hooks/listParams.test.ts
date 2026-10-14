import { describe, expect, it } from 'vitest'
import {
  ariaSort,
  DEFAULT_STATE,
  nextSort,
  parseBillListParams,
  parseSort,
  toApiParams,
  toSearchParams,
  toSummaryParams,
  withChange,
} from './listParams'

const parse = (qs: string) => parseBillListParams(new URLSearchParams(qs))

describe('parseBillListParams', () => {
  it('gives the defaults for a plain URL: overdue first, all months, 25 per page', () => {
    expect(parse('')).toEqual(DEFAULT_STATE)
    expect(DEFAULT_STATE).toEqual({ q: '', status: 'all', month: '', sort: 'status', page: 1, pageSize: 25 })
  })

  it('reads every parameter', () => {
    expect(parse('q=north&status=overdue&month=2026-09&sort=-payable&page=2&pageSize=10')).toEqual({
      q: 'north',
      status: 'overdue',
      month: '2026-09',
      sort: '-payable',
      page: 2,
      pageSize: 10,
    })
  })

  it.each([
    ['status=late', 'status', 'all'],
    ['month=2026-13', 'month', ''],
    ['month=2026-9', 'month', ''],
    ['month=September', 'month', ''],
    ['sort=id', 'sort', 'status'],
    ['sort=name', 'sort', 'status'],
    ['page=0', 'page', 1],
    ['page=abc', 'page', 1],
    ['pageSize=101', 'pageSize', 25],
    ['pageSize=0', 'pageSize', 25],
  ] as const)('falls back to the default for %s', (qs, key, expected) => {
    expect(parse(qs)[key]).toBe(expected)
  })

  it('trims q and drops one over 100 characters', () => {
    expect(parse('q=%20north%20').q).toBe('north')
    expect(parse('q=' + 'x'.repeat(101)).q).toBe('')
  })
})

describe('toSearchParams', () => {
  it('writes nothing for the defaults, and only what differs otherwise', () => {
    expect(toSearchParams(DEFAULT_STATE).toString()).toBe('')
    const state = { q: 'north', status: 'paid' as const, month: '2026-10', sort: '-deadline', page: 3, pageSize: 10 }
    expect(toSearchParams(state).toString()).toBe('q=north&status=paid&month=2026-10&sort=-deadline&page=3&pageSize=10')
  })

  it('round-trips through parse', () => {
    const state = { q: 'a & b', status: 'pending' as const, month: '2026-09', sort: 'tenant', page: 2, pageSize: 50 }
    expect(parse(toSearchParams(state).toString())).toEqual(state)
  })
})

describe('toApiParams and toSummaryParams', () => {
  it('sends sort and paging always, and the filters only when set', () => {
    expect(toApiParams(DEFAULT_STATE)).toEqual({ sort: 'status', page: 1, pageSize: 25 })
    expect(toApiParams({ ...DEFAULT_STATE, q: 'n', status: 'paid', month: '2026-09' })).toEqual({
      q: 'n',
      status: 'paid',
      month: '2026-09',
      sort: 'status',
      page: 1,
      pageSize: 25,
    })
  })

  it('gives the totals the search and the month, never the status', () => {
    expect(toSummaryParams(DEFAULT_STATE)).toEqual({})
    expect(toSummaryParams({ ...DEFAULT_STATE, q: 'n', status: 'overdue', month: '2026-09', page: 3 })).toEqual({ q: 'n', month: '2026-09' })
  })
})

describe('withChange and sorting helpers', () => {
  it('goes back to page 1 when a filter or the sort changes, and keeps an explicit page', () => {
    const state = { ...DEFAULT_STATE, page: 4 }
    for (const patch of [{ q: 'x' }, { status: 'paid' as const }, { month: '2026-09' }, { sort: '-month' }, { pageSize: 10 }]) {
      expect(withChange(state, patch).page).toBe(1)
    }
    expect(withChange(DEFAULT_STATE, { page: 3 }).page).toBe(3)
  })

  it('parses a sort, starts a new column ascending and flips the same one', () => {
    expect(parseSort('-payable')).toEqual({ key: 'payable', descending: true })
    expect(parseSort('id')).toBeNull()
    expect(nextSort('status', 'month')).toBe('month')
    expect(nextSort('month', 'month')).toBe('-month')
    expect(nextSort('-month', 'month')).toBe('month')
    expect(nextSort('status', 'status')).toBe('-status')
  })

  it('reports aria-sort for the active column only', () => {
    expect(ariaSort('status', 'status')).toBe('ascending')
    expect(ariaSort('-payable', 'payable')).toBe('descending')
    expect(ariaSort('status', 'tenant')).toBe('none')
  })
})
