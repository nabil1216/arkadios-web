import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

interface FieldProps {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  /** Gets the aria-describedby value for the control. */
  children: (describedBy: string | undefined) => ReactNode
}

/** Label, control, hint and error, as the demo's .field: the error is announced, the control is marked invalid by the caller. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(' ')
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="font-medium">
        {label}
      </Label>
      {children(ids || undefined)}
      {hint ? (
        <p id={`${id}-hint`} className="text-[12.5px] text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-[12.5px] text-red">
          {error}
        </p>
      ) : null}
    </div>
  )
}
