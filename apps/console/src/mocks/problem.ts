import { HttpResponse } from 'msw'
import type { ProblemDetails } from '@/lib/api'

const TYPE_BASE = 'https://errors.arkadious.example/'

/** An application/problem+json response with the fields from the Wire conventions. */
export function problem(
  status: number,
  slug: string,
  title: string,
  extra: Pick<ProblemDetails, 'detail' | 'errors'> = {},
) {
  const body: ProblemDetails = {
    type: TYPE_BASE + slug,
    title,
    status,
    ...extra,
    traceId: crypto.randomUUID(),
  }
  return HttpResponse.json(body, { status, headers: { 'Content-Type': 'application/problem+json' } })
}

/** Every sign-in failure (bad password, unknown email, disabled or invited account) looks the same. */
export const signInFailed = () =>
  problem(401, 'auth/sign-in-failed', 'Sign-in failed', { detail: 'Incorrect email or password.' })

export const verificationFailed = () =>
  problem(401, 'auth/verification-failed', 'Verification failed', { detail: 'That code is not right.' })

export const signInRequired = () =>
  problem(401, 'auth/unauthenticated', 'Authentication required', { detail: 'Sign in required.' })

export const sessionExpired = () =>
  problem(401, 'auth/session-expired', 'Session expired', { detail: 'Session expired.' })
