import { describe, expect, it } from 'vitest'
import { DEFAULT_STATE, parseSessionListParams, toApiParams, toSearchParams, withChange } from './listParams'

const parse = (s: string) => parseSessionListParams(new URLSearchParams(s))

describe('the address bar', () => {
  it('defaults to every status, page 1', () => {
    expect(parse('')).toEqual(DEFAULT_STATE)
  })
  it('reads a status and a page', () => {
    expect(parse('status=revoked&page=3')).toEqual({ status: 'revoked', page: 3, pageSize: 25 })
  })
  it('falls back to the defaults for anything invalid', () => {
    expect(parse('status=live&page=-2&pageSize=9999')).toEqual(DEFAULT_STATE)
    expect(parse('page=abc')).toEqual(DEFAULT_STATE)
  })
  it('writes only what differs from the defaults, and sends no status for "all"', () => {
    expect(toSearchParams(DEFAULT_STATE).toString()).toBe('')
    expect(toSearchParams({ status: 'active', page: 2, pageSize: 25 }).toString()).toBe('status=active&page=2')
    expect(toApiParams(DEFAULT_STATE)).toEqual({ page: 1, pageSize: 25 })
    expect(toApiParams({ status: 'expired', page: 2, pageSize: 25 })).toEqual({ status: 'expired', page: 2, pageSize: 25 })
  })
  it('starts again from page 1 when the filter changes', () => {
    expect(withChange({ status: 'all', page: 4, pageSize: 25 }, { status: 'ended' }).page).toBe(1)
    expect(withChange({ status: 'all', page: 4, pageSize: 25 }, { page: 5 }).page).toBe(5)
  })
})
