import type { UseQueryResult } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { BillSummary, BillTotals } from '../api/types'

const TILES = [
  { key: 'billable', label: 'Billable' },
  { key: 'collected', label: 'Collected' },
  { key: 'notYetPaid', label: 'Not yet paid' },
  { key: 'overdue', label: 'Overdue' },
] as const

/** The demo's totals strip, one per currency (there is one today). Amounts are integer minor units on the wire. */
export function BillsTotals({ summary }: { summary: UseQueryResult<BillSummary> }) {
  if (summary.isError && !summary.data) {
    return (
      <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-line bg-paper px-4 py-3">
        <span>Could not load the totals.</span>
        <Button variant="secondary" size="sm" onClick={() => void summary.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!summary.data) {
    return (
      <dl aria-busy="true" data-testid="totals-skeleton" className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {TILES.map((t) => (
          <div key={t.key} className="rounded-md border border-line bg-paper px-4 py-3.5">
            <dt className="text-ink-2">{t.label}</dt>
            <dd className="mt-1">
              <Skeleton className="h-7 w-28" />
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <>
      {summary.data.totals.map((totals) => (
        <TotalsStrip key={totals.currency} totals={totals} showCurrency={summary.data.totals.length > 1} busy={summary.isPlaceholderData} />
      ))}
    </>
  )
}

function TotalsStrip({ totals, showCurrency, busy }: { totals: BillTotals; showCurrency: boolean; busy: boolean }) {
  return (
    <dl
      aria-label={showCurrency ? `Totals in ${totals.currency}` : undefined}
      aria-busy={busy}
      className={cn('mb-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3', busy && 'opacity-60 transition-opacity')}
    >
      {TILES.map(({ key, label }) => {
        const alert = key === 'overdue' && totals.overdue > 0
        return (
          <div key={key} className={cn('rounded-md border bg-paper px-4 py-3.5', alert ? 'border-red bg-red-tint' : 'border-line')}>
            <dt className={cn('text-ink-2', alert && 'text-red')}>{label}</dt>
            <dd className={cn('mt-1 text-[22px] font-semibold tabular-nums', alert && 'text-red')}>
              {formatMoney({ amountMinor: totals[key], currency: totals.currency })}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
