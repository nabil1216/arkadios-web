import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { formatMoney } from '@/lib/money'
import { billNoticeKey, fetchBillNotice } from '../api/bills'
import type { Bill } from '../api/types'

const METHOD_NAMES: Record<string, string> = { stripe: 'Stripe', paypal: 'PayPal' }
const methodName = (id: string) => METHOD_NAMES[id] ?? id

const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : (items[0] ?? ''))

interface NoticeDialogProps {
  bill: Bill | null
  onClose: () => void
}

/** "What the tenant sees": the notice the server wrote for this bill. Pay now is a preview and does nothing. */
export function NoticeDialog({ bill, onClose }: NoticeDialogProps) {
  const { data, isError, error, refetch } = useQuery({
    queryKey: billNoticeKey(bill?.id ?? ''),
    queryFn: () => fetchBillNotice(bill!.id),
    enabled: bill !== null,
    // The notice depends on the deadline, which an extension changes.
    staleTime: 0,
  })

  return (
    <Dialog open={bill !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-paper" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-medium">What the tenant sees</DialogTitle>
          <DialogDescription>The notice shown at the top of {bill?.tenantName}&rsquo;s workspace.</DialogDescription>
        </DialogHeader>

        {isError ? (
          <div role="alert" className="grid gap-3">
            <p>{error instanceof ApiError && error.status === 409 ? error.message : 'Could not load the notice.'}</p>
            {error instanceof ApiError && error.status === 409 ? null : (
              <div>
                <Button variant="secondary" onClick={() => void refetch()}>
                  Try again
                </Button>
              </div>
            )}
          </div>
        ) : data ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-[#f8fafb] px-4 py-3">
              {/* Plain text: the message is rendered as a text node, never as HTML. */}
              <p data-testid="notice-message">{data.message}</p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" aria-disabled="true" aria-describedby="notice-preview-only" onClick={(e) => e.preventDefault()} className="cursor-not-allowed">
                  Pay now
                </Button>
                <span id="notice-preview-only" className="text-[12.5px] font-medium text-ink-2">
                  Preview only
                </span>
              </div>
            </div>
            <p className="text-[12.5px] text-ink-2">
              Amount due {formatMoney(data.amountDue)}. The tenant picks {list(data.paymentMethods.map(methodName))} on the payment page.
            </p>
          </div>
        ) : (
          <div role="status" aria-label="Loading the notice" className="grid gap-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
