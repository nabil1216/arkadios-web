import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { formatDate, formatMonthLong } from '@/lib/format'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import { billsKey, extendBill } from '../api/bills'
import type { Bill, ExtendDays } from '../api/types'
import { DaysChoice } from './DaysChoice'

const DEFAULT_DAYS: ExtendDays = 14

interface ExtendDialogProps {
  bill: Bill | null
  onClose: () => void
}

/** "Extend the deadline": 7, 14 or 30 days. The button stays off while the request runs: it is not idempotent. */
export function ExtendDialog({ bill, onClose }: ExtendDialogProps) {
  const queryClient = useQueryClient()
  const [days, setDays] = useState<ExtendDays>(DEFAULT_DAYS)
  const [error, setError] = useState<string | null>(null)
  // Extending is not idempotent and the button only turns off after the next render: the guard
  // is set in the click handler itself, so a fast double click sends one request.
  const guard = useSubmitGuard()

  const extend = useMutation({
    mutationFn: ({ id, days }: { id: string; days: ExtendDays }) => extendBill(id, { days }),
    onSuccess: (_bill, { days }) => {
      void queryClient.invalidateQueries({ queryKey: billsKey })
      toast(`Deadline extended by ${days} days`)
      close()
    },
    onError: (e) => {
      void queryClient.invalidateQueries({ queryKey: billsKey }) // the bill may have changed under us
      if (e instanceof ApiError && (e.status === 409 || e.status === 403 || e.status === 404)) setError(e.message)
      else setError('Could not extend the deadline. Try again.')
    },
  })

  function submit() {
    if (!bill) return
    void guard.run(() => extend.mutateAsync({ id: bill.id, days }))
  }

  function close() {
    setDays(DEFAULT_DAYS)
    setError(null)
    extend.reset()
    onClose()
  }

  return (
    <Dialog
      open={bill !== null}
      onOpenChange={(open) => {
        // Not while the request is running: closing would hide whether it went through.
        if (!open && !extend.isPending) close()
      }}
    >
      <DialogContent className="bg-paper" showCloseButton={!extend.isPending}>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-medium">Extend the deadline</DialogTitle>
          <DialogDescription>
            {bill ? `${bill.tenantName}, ${formatMonthLong(bill.month)} bill. Currently due ${formatDate(bill.deadline)}.` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <span id="extend-by" className="font-medium">
            Extend by
          </span>
          <DaysChoice labelledBy="extend-by" value={days} onChange={setDays} disabled={extend.isPending} />
        </div>

        {error ? (
          <p role="alert" className="text-[12.5px] text-red">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={close} disabled={extend.isPending}>
            Cancel
          </Button>
          <Button disabled={extend.isPending || !bill} onClick={submit}>
            Extend deadline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
