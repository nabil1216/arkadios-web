import { useId } from 'react'
import { cn } from '@/lib/utils'
import type { SupportMode } from '../api/types'

const OPTIONS: Array<{ value: SupportMode; title: string; note: string }> = [
  { value: 'read', title: 'Read only', note: 'Look at their screens and data. Nothing can be changed.' },
  { value: 'edit', title: 'Can make changes', note: 'Ordinary changes only. Passwords, users, exports, deletes and approvals stay blocked.' },
]

interface ModeChoiceProps {
  /** Id of the element that names the group. */
  labelledBy: string
  value: SupportMode
  onChange: (mode: SupportMode) => void
  disabled?: boolean
}

/** Read only is the default; changes are a separate, explicit choice (and are confirmed before the session starts). */
export function ModeChoice({ labelledBy, value, onChange, disabled }: ModeChoiceProps) {
  const base = useId()
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2">
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-paper px-3 py-2.5 has-[input:focus-visible]:shadow-[0_0_0_3px_var(--ring)]',
            value === o.value && 'border-teal bg-teal-tint',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name="support-mode"
            value={o.value}
            checked={value === o.value}
            disabled={disabled}
            aria-labelledby={`${base}-${o.value}-t`}
            aria-describedby={`${base}-${o.value}-n`}
            onChange={() => onChange(o.value)}
            className="mt-1 accent-teal"
          />
          <span>
            <strong id={`${base}-${o.value}-t`}>{o.title}</strong>
            <span id={`${base}-${o.value}-n`} className="block text-[12.5px] text-ink-2">
              {o.note}
            </span>
          </span>
        </label>
      ))}
    </div>
  )
}
