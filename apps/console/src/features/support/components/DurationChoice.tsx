import { cn } from '@/lib/utils'
import { DURATIONS, type Duration } from '../api/types'

interface DurationChoiceProps {
  /** Id of the element that names the group. */
  labelledBy: string
  value: Duration
  onChange: (minutes: Duration) => void
  disabled?: boolean
}

/** 15, 30 or 60 minutes: native radios in the pill style of the Extend dialog. There is no custom time. */
export function DurationChoice({ labelledBy, value, onChange, disabled }: DurationChoiceProps) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {DURATIONS.map((minutes) => (
        <label
          key={minutes}
          className={cn(
            'inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-paper px-3 py-2 has-[input:focus-visible]:shadow-[0_0_0_3px_var(--ring)]',
            value === minutes && 'border-teal bg-teal-tint text-teal-ink',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <input
            type="radio"
            name="support-duration"
            value={minutes}
            checked={value === minutes}
            disabled={disabled}
            onChange={() => onChange(minutes)}
            className="accent-teal"
          />
          {minutes} minutes
        </label>
      ))}
    </div>
  )
}
