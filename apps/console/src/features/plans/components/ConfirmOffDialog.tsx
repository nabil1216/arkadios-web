import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useReopenKey } from '@/lib/useReopenKey'
import type { OffSummary } from '../hooks/planDraft'

const tenants = (n: number) => `${n} ${n === 1 ? 'tenant' : 'tenants'}`

interface ConfirmOffDialogProps {
  open: boolean
  summaries: OffSummary[]
  onCancel: () => void
  onConfirm: () => void
}

/** Shown before a save that switches modules off on plans that have tenants. Switching on never asks. */
export function ConfirmOffDialog({ open, summaries, onCancel, onConfirm }: ConfirmOffDialogProps) {
  // A fresh dialog on every opening: reopening while the last one fades out would put its overlay over its content.
  const reopenKey = useReopenKey(open)
  return (
    <AlertDialog key={reopenKey} open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-[22px] font-medium">Switch modules off for existing tenants?</AlertDialogTitle>
          <AlertDialogDescription>
            The modules are hidden and become read-only for these tenants. Their data is not deleted, and switching a module back on
            restores it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="m-0 grid list-none gap-2 p-0">
          {summaries.map(({ plan, modules }) => (
            <li key={plan.id} className="rounded-md border border-line bg-[#f8fafb] px-3 py-2.5">
              <strong>{plan.name}</strong>: {tenants(plan.tenantCount)} will lose
              <ul className="m-0 mt-1 list-disc pl-5">
                {modules.map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Switch off and save
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
