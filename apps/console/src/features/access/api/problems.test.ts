import { describe, expect, it } from 'vitest'
import { ApiError, type ProblemDetails } from '@/lib/api'
import { accessErrorText, accessProblem, isStale } from './problems'

const error = (status: number, extra: Partial<ProblemDetails> = {}) => new ApiError({ title: 'T', status, ...extra })

describe('accessProblem', () => {
  it.each([
    ['access/self-lockout', 'selfLockout'],
    ['access/last-admin', 'lastAdmin'],
    ['access/last-manager-role', 'lastManagerRole'],
    ['access/escalation', 'escalation'],
    ['access/role-locked', 'roleLocked'],
  ])('knows %s', (slug, name) => {
    expect(accessProblem(error(409, { type: `https://errors.arkadious.example/${slug}` }))).toBe(name)
  })

  it('is undefined for another 409, another status, or something that is not an ApiError', () => {
    expect(accessProblem(error(409, { type: 'https://errors.arkadious.example/conflict' }))).toBeUndefined()
    expect(accessProblem(error(400, { type: 'https://errors.arkadious.example/access/last-admin' }))).toBeUndefined()
    expect(accessProblem(new Error('x'))).toBeUndefined()
  })
})

describe('accessErrorText', () => {
  it('uses the server\'s sentence for a rule, a refusal and a missing person', () => {
    for (const status of [403, 404, 409]) expect(accessErrorText(error(status, { detail: 'Because.' }), 'Fallback.')).toBe('Because.')
  })

  it('says a stale version in one line, whatever the detail', () => {
    const stale = error(409, { detail: 'x', errors: { version: ['y'] } })
    expect(isStale(stale)).toBe(true)
    expect(accessErrorText(stale, 'Fallback.')).toBe('This was changed by someone else. Reload to see the latest.')
  })

  it('falls back for a server error or a network failure', () => {
    expect(accessErrorText(error(500, { detail: 'stack' }), 'Fallback.')).toBe('Fallback.')
    expect(accessErrorText(new TypeError('Failed to fetch'), 'Fallback.')).toBe('Fallback.')
  })
})
