import { cn } from '@/lib/utils'
import { EXTEND_DAYS, type ExtendDays } from '../api/types'

interface DaysChoiceProps {
  /** Id of the element that names the group. */
  labelledBy: string
  value: ExtendDays
  onChange: (days: ExtendDays) => void
  disabled?: boolean
}

/** The demo's pill choice for "Extend by": native radios, so arrow keys and screen readers just work. */
export function DaysChoice({ labelledBy, value, onChange, disabled }: DaysChoiceProps) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {EXTEND_DAYS.map((days) => (
        <label
          key={days}
          className={cn(
            'inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 has-[input:focus-visible]:shadow-[0_0_0_3px_var(--ring)]',
            value === days && 'border-teal bg-teal-tint text-teal-ink',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name="extend-days"
            value={days}
            checked={value === days}
            disabled={disabled}
            onChange={() => onChange(days)}
            className="accent-teal"
          />
          {days} days
        </label>
      ))}
    </div>
  )
}
