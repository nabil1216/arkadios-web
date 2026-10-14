import { describe, expect, it } from 'vitest'
import {
  ariaSort,
  DEFAULT_STATE,
  nextSort,
  parseSort,
  parseTenantListParams,
  toApiParams,
  toSearchParams,
  withChange,
} from './listParams'

const parse = (qs: string) => parseTenantListParams(new URLSearchParams(qs))

describe('parseTenantListParams', () => {
  it('gives the defaults for a plain URL', () => {
    expect(parse('')).toEqual(DEFAULT_STATE)
    expect(DEFAULT_STATE).toEqual({ q: '', status: 'all', sort: 'name', page: 1, pageSize: 25 })
  })

  it('reads every parameter', () => {
    expect(parse('q=north&status=trial&sort=-usersUsed&page=2&pageSize=10')).toEqual({
      q: 'north',
      status: 'trial',
      sort: '-usersUsed',
      page: 2,
      pageSize: 10,
    })
  })

  it('trims q', () => {
    expect(parse('q=%20north%20').q).toBe('north')
  })

  it.each([
    ['status=deleted', 'status', 'all'],
    ['sort=id', 'sort', 'name'],
    ['sort=-database', 'sort', 'name'],
    ['sort=name%3Bdrop', 'sort', 'name'],
    ['page=0', 'page', 1],
    ['page=-3', 'page', 1],
    ['page=1.5', 'page', 1],
    ['page=abc', 'page', 1],
    ['page=', 'page', 1],
    ['pageSize=0', 'pageSize', 25],
    ['pageSize=101', 'pageSize', 25],
    ['pageSize=abc', 'pageSize', 25],
  ] as const)('falls back to the default for %s', (qs, key, expected) => {
    expect(parse(qs)[key]).toBe(expected)
  })

  it('drops a q longer than 100 characters', () => {
    expect(parse('q=' + 'x'.repeat(101)).q).toBe('')
    expect(parse('q=' + 'x'.repeat(100)).q).toHaveLength(100)
  })

  it('ignores parameters it does not know', () => {
    expect(parse('foo=bar&q=a')).toEqual({ ...DEFAULT_STATE, q: 'a' })
  })
})

describe('toSearchParams', () => {
  it('writes nothing for the defaults', () => {
    expect(toSearchParams(DEFAULT_STATE).toString()).toBe('')
  })

  it('writes only what differs, in a stable order', () => {
    const state = { q: 'north', status: 'trial' as const, sort: '-name', page: 3, pageSize: 10 }
    expect(toSearchParams(state).toString()).toBe('q=north&status=trial&sort=-name&page=3&pageSize=10')
    expect(toSearchParams({ ...DEFAULT_STATE, status: 'suspended' }).toString()).toBe('status=suspended')
  })

  it('round-trips through parse', () => {
    const state = { q: 'a & b', status: 'active' as const, sort: 'usersUsed', page: 2, pageSize: 50 }
    expect(parse(toSearchParams(state).toString())).toEqual(state)
  })
})

describe('toApiParams', () => {
  it('leaves out an empty q and the "all" status, and always sends sort and paging', () => {
    expect(toApiParams(DEFAULT_STATE)).toEqual({ sort: 'name', page: 1, pageSize: 25 })
  })

  it('sends q and status when set', () => {
    expect(toApiParams({ ...DEFAULT_STATE, q: 'north', status: 'trial' })).toEqual({
      q: 'north',
      status: 'trial',
      sort: 'name',
      page: 1,
      pageSize: 25,
    })
  })
})

describe('withChange', () => {
  it('goes back to page 1 when a filter changes', () => {
    const state = { ...DEFAULT_STATE, page: 4 }
    expect(withChange(state, { q: 'x' }).page).toBe(1)
    expect(withChange(state, { status: 'trial' }).page).toBe(1)
    expect(withChange(state, { sort: '-name' }).page).toBe(1)
    expect(withChange(state, { pageSize: 10 }).page).toBe(1)
  })

  it('keeps an explicit page', () => {
    expect(withChange(DEFAULT_STATE, { page: 3 }).page).toBe(3)
  })
})

describe('sorting helpers', () => {
  it('parses direction and key, and rejects unknown keys', () => {
    expect(parseSort('usersUsed')).toEqual({ key: 'usersUsed', descending: false })
    expect(parseSort('-status')).toEqual({ key: 'status', descending: true })
    expect(parseSort('id')).toBeNull()
    expect(parseSort('')).toBeNull()
  })

  it('starts a new column ascending and flips the same column', () => {
    expect(nextSort('name', 'plan')).toBe('plan')
    expect(nextSort('plan', 'plan')).toBe('-plan')
    expect(nextSort('-plan', 'plan')).toBe('plan')
    expect(nextSort('name', 'name')).toBe('-name')
  })

  it('reports aria-sort for the active column only', () => {
    expect(ariaSort('name', 'name')).toBe('ascending')
    expect(ariaSort('-name', 'name')).toBe('descending')
    expect(ariaSort('name', 'plan')).toBe('none')
  })
})
