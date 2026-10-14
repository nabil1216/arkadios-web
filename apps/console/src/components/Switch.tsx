import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * The demo's .switch: a native checkbox with role="switch" laid over a track and a thumb, so the
 * keyboard, the label and the checked state all come from the browser. Give it an aria-label.
 */
export function Switch({ className, ...props }: Omit<ComponentProps<'input'>, 'type' | 'role'>) {
  return (
    <span className={cn('relative inline-block h-[22px] w-[38px] align-middle', className)}>
      <input
        type="checkbox"
        role="switch"
        className="peer absolute inset-0 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-[#b8c2cb] transition-colors peer-checked:bg-teal peer-focus-visible:shadow-[0_0_0_3px_var(--ring)] peer-disabled:opacity-45 after:absolute after:top-[3px] after:left-[3px] after:size-4 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-4"
      />
    </span>
  )
}
