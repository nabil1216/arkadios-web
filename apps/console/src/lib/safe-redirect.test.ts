import { describe, expect, it } from 'vitest'
import { safeNext } from './safe-redirect'

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
