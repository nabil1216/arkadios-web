import { Search } from 'lucide-react'
import { useState } from 'react'
import { NativeSelect } from '@/components/NativeSelect'
import { Input } from '@/components/ui/input'
import { useDebouncedSearch } from '@/lib/useDebouncedSearch'
import { BILL_STATUSES } from '../api/types'
import { MONTH_PATTERN, type BillListState } from '../hooks/listParams'

const STATUS_LABELS = { all: 'All statuses', overdue: 'Overdue', pending: 'Pending', paid: 'Paid' } as const
const STATUS_ORDER = ['all', ...[...BILL_STATUSES].sort((a, b) => Object.keys(STATUS_LABELS).indexOf(a) - Object.keys(STATUS_LABELS).indexOf(b))] as const

interface BillsToolbarProps {
  q: string
  status: BillListState['status']
  month: string
  /** Applies a change to the list. `replace` keeps typing from filling the back button. */
  onChange: (patch: Partial<BillListState>, options?: { replace?: boolean }) => void
}

export function BillsToolbar({ q, status, month, onChange }: BillsToolbarProps) {
  // Typing is applied once the person pauses; another filter changing takes a waiting search along with it, in one step.
  const search = useDebouncedSearch(q, (next) => onChange({ q: next }, { replace: true }))
  const withSearch = (patch: Partial<BillListState>): Partial<BillListState> => {
    const pending = search.takePending()
    return pending !== undefined ? { ...patch, q: pending } : patch
  }

  // A browser without a month picker shows a text box: only a complete "2026-09" (or nothing) reaches the address bar.
  const [monthText, setMonthText] = useState(month)
  const [seenMonth, setSeenMonth] = useState(month)
  if (month !== seenMonth) {
    setSeenMonth(month)
    if (monthText !== month) setMonthText(month)
  }

  return (
    <div className="mb-3.5 flex flex-wrap gap-3">
      <div className="relative min-w-[240px] max-w-[420px] flex-1">
        <label htmlFor="b-q" className="sr-only">
          Search bills by tenant
        </label>
        <Search size={16} strokeWidth={1.7} aria-hidden="true" className="pointer-events-none absolute top-[11px] left-[11px] text-ink-2" />
        <Input
          id="b-q"
          value={search.text}
          onChange={(e) => search.setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search.commit()
          }}
          placeholder="Search by tenant"
          autoComplete="off"
          maxLength={100}
          className="h-[38px] bg-paper pl-[34px]"
        />
      </div>
      <div>
        <label htmlFor="b-status" className="sr-only">
          Filter by status
        </label>
        <NativeSelect
          id="b-status"
          value={status}
          onChange={(e) => onChange(withSearch({ status: e.target.value as BillListState['status'] }))}
          className="w-[180px]"
        >
          {STATUS_ORDER.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor="b-month" className="sr-only">
          Filter by month
        </label>
        <Input
          id="b-month"
          type="month"
          value={monthText}
          placeholder="YYYY-MM"
          pattern="\d{4}-\d{2}"
          onChange={(e) => {
            setMonthText(e.target.value)
            if (e.target.value === '' || MONTH_PATTERN.test(e.target.value)) onChange(withSearch({ month: e.target.value }))
          }}
          className="h-[38px] w-[170px] bg-paper"
        />
      </div>
    </div>
  )
}
