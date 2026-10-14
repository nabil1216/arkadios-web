import type { ReactNode } from 'react'

function Row({ title, note, value }: { title: string; note: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <strong>{title}</strong>
        <div className="text-ink-2">{note}</div>
      </div>
      <span className="rounded-full bg-gray-tint px-[9px] py-0.5 text-[12.5px] font-medium whitespace-nowrap text-ink-2">{value}</span>
    </div>
  )
}

/**
 * Sign-in rules that apply to every staff member. All of them are read only: MFA and the support
 * reason are always on, and the inactivity time is the server's value. Nothing here can be turned off.
 */
export function SignInSecurity({ idleMinutes }: { idleMinutes: number | undefined }) {
  return (
    <div className="grid gap-3.5 p-[18px]">
      <Row title="MFA is required for every staff member" note="Staff who have not set it up must do so at their next sign-in." value="Required" />
      <Row title="Support sessions need a reason" note="The reason is saved with the session." value="Always on" />
      <Row
        title="Sign staff out after inactivity"
        note="Applies to every staff member."
        value={idleMinutes ? `${idleMinutes} minutes` : '...'}
      />
    </div>
  )
}
