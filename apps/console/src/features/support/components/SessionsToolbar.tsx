import { NativeSelect } from '@/components/NativeSelect'
import { SESSION_STATUSES } from '../api/types'
import type { SessionListState } from '../hooks/listParams'
import { STATUS_LABEL } from '../hooks/sessionText'

interface SessionsToolbarProps {
  status: SessionListState['status']
  onStatus: (status: SessionListState['status']) => void
}

export function SessionsToolbar({ status, onStatus }: SessionsToolbarProps) {
  return (
    <div className="mb-3.5 flex flex-wrap gap-3">
      <div>
        <label htmlFor="su-status" className="sr-only">
          Filter by status
        </label>
        <NativeSelect id="su-status" value={status} onChange={(e) => onStatus(e.target.value as SessionListState['status'])} className="w-[180px]">
          <option value="all">All statuses</option>
          {SESSION_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABEL[value]}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  )
}
