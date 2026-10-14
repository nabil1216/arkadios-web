import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearResetToken, takeResetToken } from './resetToken'

function visit(url: string, state: unknown = null) {
  window.history.replaceState(state, '', url)
}

describe('takeResetToken', () => {
  beforeEach(() => clearResetToken())
  afterEach(() => visit('/'))

  it('reads the token from the fragment and removes it from the address bar', () => {
    visit('/reset-password#token=abc123')
    expect(takeResetToken()).toBe('abc123')
    expect(window.location.hash).toBe('')
    expect(window.location.pathname + window.location.search).toBe('/reset-password')
  })

  it('keeps the path and query string and the router history state', () => {
    visit('/reset-password?x=1#token=abc123', { usr: null, key: 'k', idx: 3 })
    takeResetToken()
    expect(window.location.href).toBe('http://localhost:3000/reset-password?x=1')
    expect(window.history.state).toEqual({ usr: null, key: 'k', idx: 3 })
  })

  it('keeps returning the token from memory after the fragment is gone', () => {
    visit('/reset-password#token=abc123')
    takeResetToken()
    expect(takeResetToken()).toBe('abc123')
    expect(takeResetToken()).toBe('abc123')
  })

  it('returns null when there is no token', () => {
    visit('/reset-password')
    expect(takeResetToken()).toBeNull()
    visit('/reset-password#other=1')
    expect(takeResetToken()).toBeNull()
  })

  it('treats an empty token as no token', () => {
    visit('/reset-password#token=')
    expect(takeResetToken()).toBeNull()
  })

  it('decodes a URL-encoded token', () => {
    visit('/reset-password#token=a%2Bb%3Dc')
    expect(takeResetToken()).toBe('a+b=c')
  })

  it('uses a newer fragment over the one in memory', () => {
    visit('/reset-password#token=old')
    takeResetToken()
    visit('/reset-password#token=new')
    expect(takeResetToken()).toBe('new')
  })

  it('forgets the token once cleared', () => {
    visit('/reset-password#token=abc123')
    takeResetToken()
    clearResetToken()
    expect(takeResetToken()).toBeNull()
  })

  it('never writes the token to web storage', () => {
    visit('/reset-password#token=abc123')
    takeResetToken()
    expect(JSON.stringify({ ...localStorage })).not.toContain('abc123')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('abc123')
  })
})
