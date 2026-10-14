import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** The demo's plain <select class="select">: native, so it works with every keyboard and screen reader. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-[38px] w-full rounded-md border border-input bg-paper px-2.5 outline-none focus-visible:border-teal aria-invalid:border-red',
        className,
      )}
      {...props}
    />
  )
}
