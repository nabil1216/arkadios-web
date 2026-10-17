/** Why Sign in as is off for a tenant. The page that shows the buttons renders this once, under SIGN_IN_UNAVAILABLE_ID. */
export const SIGN_IN_UNAVAILABLE = 'Support sessions are only available for active and trial tenants.'
export const SIGN_IN_UNAVAILABLE_ID = 'sign-in-unavailable-hint'

/** The tenant statuses a support session can target: a business rule to confirm with the client (docs/ARCHITECTURE.md). */
export const canSignInTo = (status: string) => status === 'active' || status === 'trial'
