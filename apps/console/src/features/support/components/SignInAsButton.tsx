import { Button } from '@/components/ui/button'
import { canSignInTo, SIGN_IN_UNAVAILABLE, SIGN_IN_UNAVAILABLE_ID } from './signInAs'
import { useStartSession } from './startSessionContext'

/**
 * "Sign in as" on a tenant's row: opens the Start dialog for that tenant. For a suspended or offboarding tenant it stays
 * focusable but does nothing, and says why.
 */
export function SignInAsButton({ tenant }: { tenant: { id: string; name: string; status: string } }) {
  const start = useStartSession()
  const available = canSignInTo(tenant.status)
  return (
    <Button
      variant="ghost"
      size="sm"
      className={available ? 'px-2 text-teal-ink' : 'cursor-not-allowed px-2 text-ink-2 opacity-60'}
      aria-disabled={available ? undefined : true}
      aria-describedby={available ? undefined : SIGN_IN_UNAVAILABLE_ID}
      title={available ? undefined : SIGN_IN_UNAVAILABLE}
      data-action="sign-in-as"
      onClick={() => {
        if (available) void start.open(tenant.id)
      }}
    >
      Sign in as
      {/* A text node carries the space: one inside the hidden span is dropped from the accessible name. */}{' '}
      <span className="sr-only">a user of {tenant.name}</span>
    </Button>
  )
}
