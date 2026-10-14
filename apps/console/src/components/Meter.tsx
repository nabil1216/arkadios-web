import { cn } from '@/lib/utils'

/**
 * Usage bar from the demo's .meter: teal, amber from 90%, red at 100%.
 * Decorative: put the numbers next to it as text ("64 of 100").
 */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const ratio = max > 0 ? value / max : 0
  const tone = ratio >= 1 ? 'full' : ratio >= 0.9 ? 'warn' : 'ok'
  return (
    <span
      aria-hidden="true"
      data-meter={tone}
      className={cn('inline-block h-1.5 w-[52px] overflow-hidden rounded-[3px] bg-gray-tint align-middle', className)}
    >
      <span
        className={cn('block h-full', tone === 'full' ? 'bg-red' : tone === 'warn' ? 'bg-[#c27a00]' : 'bg-teal')}
        style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}
      />
    </span>
  )
}
