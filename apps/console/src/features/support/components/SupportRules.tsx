import { Clock, Eye, ShieldCheck, Timer } from 'lucide-react'

const RULES = [
  { icon: ShieldCheck, text: "A reason is required, and it is saved with the session. The client's admins can see it." },
  { icon: Eye, text: 'A banner stays on screen for the whole session.' },
  { icon: Clock, text: 'Start, end, and every action are recorded in the audit log.' },
  { icon: Timer, text: 'A session lasts 15, 30 or 60 minutes and cannot be extended. Signing out of the console does not end it.' },
]

/** The demo's three rules, with the rules of this build added. */
export function SupportRules() {
  return (
    <ul className="m-0 mb-5 grid list-none gap-2 p-0 text-ink-2">
      {RULES.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-start gap-2.5">
          <Icon size={17} strokeWidth={1.7} aria-hidden="true" className="mt-0.5 shrink-0 text-teal-ink" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}
