import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** The demo's .textarea: the same border and focus ring as the text input, for a few lines of text. */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-[96px] w-full resize-y rounded-md border border-input bg-paper px-3 py-2 outline-none placeholder:text-muted-foreground focus-visible:border-teal focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-red',
        className,
      )}
      {...props}
    />
  )
}
