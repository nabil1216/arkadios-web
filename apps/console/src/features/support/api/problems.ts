import { ApiError } from '@/lib/api'
import { SUPPORT_PROBLEM } from './types'

export type SupportProblem = keyof typeof SUPPORT_PROBLEM

/** Which support rule a 403 or 409 is, from the problem `type`; undefined for any other error. */
export function supportProblem(error: unknown): SupportProblem | undefined {
  if (!(error instanceof ApiError) || (error.status !== 409 && error.status !== 403)) return undefined
  const type = error.problem.type ?? ''
  return (Object.keys(SUPPORT_PROBLEM) as SupportProblem[]).find((name) => type.endsWith(`/${SUPPORT_PROBLEM[name]}`))
}

/** The sentence to show for a failed request: the server's words for a refusal or a limit, a plain line when it could not be reached. */
export function supportErrorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError && [403, 404, 409, 429].includes(error.status) && error.problem.detail) return error.problem.detail
  return fallback
}
