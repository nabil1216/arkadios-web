import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'

interface QueryErrorPanelProps {
  title: string
  error: unknown
  onRetry: () => void
}

/** A list that could not load: what went wrong, the support reference when the server gave one, and Try again. */
export function QueryErrorPanel({ title, error, onRetry }: QueryErrorPanelProps) {
  return (
    <div role="alert" className="rounded-md border border-line bg-paper p-5">
      <h2 className="mb-1">{title}</h2>
      <p className="text-ink-2">{error instanceof ApiError ? error.message : 'Something went wrong. Check your connection and try again.'}</p>
      {error instanceof ApiError && error.traceId ? (
        <p className="mt-1 text-[12.5px] text-ink-2">
          Reference: <span className="font-mono">{error.traceId}</span>
        </p>
      ) : null}
      <Button variant="secondary" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}
