import { Button } from '@/components/ui/button'

interface PagerProps {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
}

/** Previous and Next for any paged list. Shown only when the list does not fit on one page. */
export function Pager({ page, pageSize, total, onPage }: PagerProps) {
  if (total <= pageSize) return null
  const pages = Math.ceil(total / pageSize)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <nav aria-label="Pages" className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-ink-2">
        Showing <span className="num">{from}</span> to <span className="num">{to}</span> of <span className="num">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <span aria-current="page" className="text-ink-2">
          Page {page} of {pages}
        </span>
        <Button type="button" variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  )
}
