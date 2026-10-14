import { cn } from '@/lib/utils'

// Kinds and colours follow .badge--* in docs/handoff/platform-console/assets/platform.css.
// The text and the dot carry the status, so colour is never the only signal.
const KINDS = {
  active: { label: 'Active', tone: 'green' },
  paid: { label: 'Paid', tone: 'green' },
  ok: { label: 'Up to date', tone: 'green' },
  succeeded: { label: 'Succeeded', tone: 'green' },
  delivered: { label: 'Delivered', tone: 'green' },
  trial: { label: 'Trial', tone: 'blue' },
  pending: { label: 'Pending', tone: 'blue' },
  suspended: { label: 'Suspended', tone: 'amber' },
  overdue: { label: 'Overdue', tone: 'red' },
  failed: { label: 'Failed', tone: 'red' },
  offboarding: { label: 'Offboarding', tone: 'gray' },
  ended: { label: 'Ended', tone: 'gray' },
  refunded: { label: 'Refunded', tone: 'gray' },
  live: { label: 'In progress', tone: 'teal' },
} as const

export type StatusKind = keyof typeof KINDS

const TONES = {
  green: 'bg-green-tint text-green',
  blue: 'bg-blue-tint text-blue',
  amber: 'bg-amber-tint text-amber',
  red: 'bg-red-tint text-red',
  gray: 'bg-gray-tint text-ink-2',
  teal: 'bg-teal-tint text-teal-ink',
} as const

export function StatusBadge({ kind, className }: { kind: StatusKind; className?: string }) {
  const { label, tone } = KINDS[kind]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-[9px] py-0.5 text-[12.5px] font-medium whitespace-nowrap before:size-[7px] before:rounded-full before:bg-current before:content-['']",
        TONES[tone],
        className,
      )}
    >
      {label}
    </span>
  )
}
