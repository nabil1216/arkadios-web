import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Pager } from '@/components/Pager'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { downloadInvoice } from '../api/bills'
import type { Bill } from '../api/types'
import { BillsTable } from '../components/BillsTable'
import { BillsToolbar } from '../components/BillsToolbar'
import { BillsTotals } from '../components/BillsTotals'
import { ExtendDialog } from '../components/ExtendDialog'
import { NoticeDialog } from '../components/NoticeDialog'
import { useBillList } from '../hooks/useBillList'

const NO_MATCH = 'No bills match. Clear the search or choose another status or month.'
const NONE_YET = 'There are no bills yet.'

export default function BillingPage() {
  const { state, list, summary, update } = useBillList()
  const { data, isError, error, isPlaceholderData, refetch } = list
  const filtered = state.q !== '' || state.status !== 'all' || state.month !== ''
  const highlight = useLocation().hash === '#overdue'

  const [preview, setPreview] = useState<Bill | null>(null)
  const [extending, setExtending] = useState<Bill | null>(null)
  const [invoicing, setInvoicing] = useState<string | null>(null)

  // The Overview links here with #overdue: bring the first overdue bill into view.
  const items = data?.items
  useEffect(() => {
    if (!highlight || !items) return
    const first = items.find((b) => b.status === 'overdue')
    document.getElementById(first ? `overdue-${first.id}` : '')?.scrollIntoView?.({ block: 'center' })
  }, [highlight, items])

  async function onInvoice(bill: Bill) {
    setInvoicing(bill.id)
    try {
      await downloadInvoice(bill)
      toast('Invoice downloaded')
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 409 ? e.message : 'Could not download the invoice. Try again.')
    } finally {
      setInvoicing(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Billing"
        description="Monthly subscription bills for every tenant. Tenants pay online through Stripe or PayPal from their own bill notice."
      />

      <BillsTotals summary={summary} />

      <BillsToolbar q={state.q} status={state.status} month={state.month} onChange={update} />

      {isError && !data ? (
        <div role="alert" className="rounded-md border border-line bg-paper p-5">
          <h2 className="mb-1">Could not load bills.</h2>
          <p className="text-ink-2">{error instanceof ApiError ? error.message : 'Something went wrong. Check your connection and try again.'}</p>
          {error instanceof ApiError && error.traceId ? (
            <p className="mt-1 text-[12.5px] text-ink-2">
              Reference: <span className="font-mono">{error.traceId}</span>
            </p>
          ) : null}
          <Button variant="secondary" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <BillsTable
            items={data?.items}
            total={data?.total ?? 0}
            page={state.page}
            pageSize={state.pageSize}
            sort={state.sort}
            onSort={(sort) => update({ sort })}
            busy={isPlaceholderData}
            emptyMessage={filtered ? NO_MATCH : NONE_YET}
            highlightOverdue={highlight}
            onPreview={setPreview}
            onExtend={setExtending}
            onInvoice={(bill) => void onInvoice(bill)}
            invoicing={invoicing}
          />
          {data ? <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => update({ page })} /> : null}
        </>
      )}

      <NoticeDialog bill={preview} onClose={() => setPreview(null)} />
      <ExtendDialog bill={extending} onClose={() => setExtending(null)} />
    </>
  )
}
