export type Role = 'admin' | 'support' | 'billing' | 'auditor'

export type Area =
  | 'tenants'
  | 'plans'
  | 'billing'
  | 'transactions'
  | 'sms'
  | 'support'
  | 'access'

export type Action = 'view' | 'manage'

/** Wire format of GET /api/permissions: "<area>.<action>". `manage` implies `view`. */
export type PermissionKey = `${Area}.${Action}`

export type PermissionMap = Record<Role, PermissionKey[]>

/** What a role can do in an area, derived from its keys. */
export type Level = 'manage' | 'view' | 'none'

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
  /** Access token lifetime in seconds; the client refreshes shortly before it ends. */
  expiresIn: number
  idleMinutes: number
  user: StaffUser
}

/** Every platform user must pass MFA, so sign-in never returns a session directly. */
export interface LoginResponse {
  challengeId: string
}
