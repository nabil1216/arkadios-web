import type { Role } from './permissions'

// Hand-written until packages/api-client is generated; replace then.
export interface StaffUser {
  id: string
  name: string
  email: string
  role: Role
  /** Where this user lands after sign-in, decided by the server. */
  home: string
}

export interface SessionResponse {
  accessToken: string
  idleMinutes: number
  user: StaffUser
}

export type LoginResponse =
  | ({ mfaRequired: false } & SessionResponse)
  | { mfaRequired: true; challengeId: string }
