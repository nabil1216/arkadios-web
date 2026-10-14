import { ApiError } from '@/lib/api'
import { ACCESS_PROBLEM } from './types'

export type AccessProblem = keyof typeof ACCESS_PROBLEM

/** Which safety rule a 409 is, from the problem `type`; undefined for any other error. */
export function accessProblem(error: unknown): AccessProblem | undefined {
  if (!(error instanceof ApiError) || error.status !== 409) return undefined
  const type = error.problem.type ?? ''
  return (Object.keys(ACCESS_PROBLEM) as AccessProblem[]).find((name) => type.endsWith(`/${ACCESS_PROBLEM[name]}`))
}

/** A stale `version`: someone else changed the same person or role. */
export const isStale = (error: unknown) => error instanceof ApiError && error.status === 409 && !!error.errors?.version

/**
 * The sentence to show for a failed change. The server's own words for a rule or a refusal,
 * a plain line when it could not be reached.
 */
export function accessErrorText(error: unknown, fallback: string): string {
  if (isStale(error)) return 'This was changed by someone else. Reload to see the latest.'
  if (error instanceof ApiError && [403, 404, 409].includes(error.status) && error.problem.detail) return error.problem.detail
  return fallback
}
