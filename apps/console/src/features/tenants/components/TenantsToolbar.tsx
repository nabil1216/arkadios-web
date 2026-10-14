import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NativeSelect } from '@/components/NativeSelect'
import { Input } from '@/components/ui/input'
import { TENANT_STATUSES } from '../api/types'
import type { TenantListState } from '../hooks/listParams'

const DEBOUNCE_MS = 300

const STATUS_LABELS = {
  all: 'All statuses',
  active: 'Active',
  trial: 'Trial',
  suspended: 'Suspended',
  offboarding: 'Offboarding',
} as const

interface TenantsToolbarProps {
  q: string
  status: TenantListState['status']
  onSearch: (q: string) => void
  onStatus: (status: TenantListState['status']) => void
}

export function TenantsToolbar({ q, status, onSearch, onStatus }: TenantsToolbarProps) {
  const [text, setText] = useState(q)
  // The address bar changed on its own (back button, "clear"): show it in the box.
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

  return (
    <div className="mb-3.5 flex flex-wrap gap-3">
      <div className="relative min-w-[240px] max-w-[420px] flex-1">
        <label htmlFor="t-q" className="sr-only">
          Search tenants
        </label>
        <Search
          size={16}
          strokeWidth={1.7}
          aria-hidden="true"
          className="pointer-events-none absolute top-[11px] left-[11px] text-ink-2"
        />
        <Input
          id="t-q"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearch(text.trim())
          }}
          placeholder="Search by name, domain, or database"
          autoComplete="off"
          maxLength={100}
          className="h-[38px] bg-paper pl-[34px]"
        />
      </div>
      <div>
        <label htmlFor="t-status" className="sr-only">
          Filter by status
        </label>
        <NativeSelect
          id="t-status"
          value={status}
          onChange={(e) => onStatus(e.target.value as TenantListState['status'])}
          className="w-[180px]"
        >
          {(['all', ...TENANT_STATUSES] as const).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}
