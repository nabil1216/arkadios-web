import { describe, expect, it } from 'vitest'
import { redirectTarget, safeNext } from './safe-redirect'

describe('safeNext', () => {
  it('keeps relative paths with query and hash', () => {
    expect(safeNext('/tenants')).toBe('/tenants')
    expect(safeNext('/tenants?status=trial#row-3')).toBe('/tenants?status=trial#row-3')
  })

  it.each([
    'https://evil.example/',
    '//evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    'tenants',
    '/ok\nnext',
    '/login',
    '',
  ])('rejects %j', (value) => {
    expect(safeNext(value)).toBeNull()
  })

  it('rejects missing values', () => {
    expect(safeNext(null)).toBeNull()
    expect(safeNext(undefined)).toBeNull()
  })
})

describe('redirectTarget', () => {
  it('prefers a safe next', () => {
    expect(redirectTarget('/billing', '/tenants')).toBe('/billing')
  })

  it('falls back to the server home when next is missing or unsafe', () => {
    expect(redirectTarget(null, '/tenants')).toBe('/tenants')
    expect(redirectTarget('https://evil.example/', '/tenants')).toBe('/tenants')
  })

  it('falls back to the overview when home is unsafe too', () => {
    expect(redirectTarget('//evil.example', 'https://evil.example/')).toBe('/overview')
    expect(redirectTarget(null, undefined)).toBe('/overview')
  })
})
