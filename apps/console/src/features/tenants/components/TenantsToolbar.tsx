import { Search } from 'lucide-react'
import { NativeSelect } from '@/components/NativeSelect'
import { Input } from '@/components/ui/input'
import { useDebouncedSearch } from '@/lib/useDebouncedSearch'
import { TENANT_STATUSES } from '../api/types'
import type { TenantListState } from '../hooks/listParams'

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
  /** Applies a change to the list. `replace` keeps typing from filling the back button. */
  onChange: (patch: Partial<TenantListState>, options?: { replace?: boolean }) => void
}

export function TenantsToolbar({ q, status, onChange }: TenantsToolbarProps) {
  // Typing is applied once the person pauses; another filter changing takes a waiting search along with it, in one step.
  const search = useDebouncedSearch(q, (next) => onChange({ q: next }, { replace: true }))

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
          value={search.text}
          onChange={(e) => search.setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search.commit()
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
          onChange={(e) => {
            const pending = search.takePending()
            onChange({ status: e.target.value as TenantListState['status'], ...(pending !== undefined ? { q: pending } : {}) })
          }}
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
