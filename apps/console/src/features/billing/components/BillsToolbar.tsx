import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NativeSelect } from '@/components/NativeSelect'
import { Input } from '@/components/ui/input'
import { BILL_STATUSES } from '../api/types'
import { MONTH_PATTERN, type BillListState } from '../hooks/listParams'

const DEBOUNCE_MS = 300

const STATUS_LABELS = { all: 'All statuses', overdue: 'Overdue', pending: 'Pending', paid: 'Paid' } as const
const STATUS_ORDER = ['all', ...[...BILL_STATUSES].sort((a, b) => Object.keys(STATUS_LABELS).indexOf(a) - Object.keys(STATUS_LABELS).indexOf(b))] as const

interface BillsToolbarProps {
  q: string
  status: BillListState['status']
  month: string
  onSearch: (q: string) => void
  onStatus: (status: BillListState['status']) => void
  onMonth: (month: string) => void
}

export function BillsToolbar({ q, status, month, onSearch, onStatus, onMonth }: BillsToolbarProps) {
  const [text, setText] = useState(q)
  // The address bar changed on its own (back button): show it in the box.
  const [seenQ, setSeenQ] = useState(q)
  if (q !== seenQ) {
    setSeenQ(q)
    if (text.trim() !== q) setText(q)
  }

  // Typing updates the URL (and so the list) once the person pauses.
  const onSearchRef = useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  })
  useEffect(() => {
    if (text.trim() === q) return
    const id = setTimeout(() => onSearchRef.current(text.trim()), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [text, q])

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
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch(text.trim())
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
          onChange={(e) => onStatus(e.target.value as BillListState['status'])}
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
            if (e.target.value === '' || MONTH_PATTERN.test(e.target.value)) onMonth(e.target.value)
          }}
          className="h-[38px] w-[170px] bg-paper"
        />
      </div>
    </div>
  )
}
