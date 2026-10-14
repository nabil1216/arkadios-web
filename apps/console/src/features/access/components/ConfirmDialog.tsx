import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import type { ConfirmCopy } from '../hooks/confirmCopy'

interface ConfirmDialogProps {
  /** Null keeps the dialog closed. */
  copy: ConfirmCopy | null
  /** Runs the change. A rejection is shown in the dialog, which stays open; resolve to close it. */
  onConfirm: () => Promise<void>
  onCancel: () => void
}

/**
 * Asks before a change that takes access away. Cancel is focused first (the alert dialog's
 * default) and the confirm button is guarded in its own click handler, so a double click sends once.
 */
export function ConfirmDialog({ copy, onConfirm, onCancel }: ConfirmDialogProps) {
  const guard = useSubmitGuard()
  const [error, setError] = useState<string | null>(null)

  function cancel() {
    setError(null)
    onCancel()
  }

  function confirm() {
    setError(null)
    void guard.run(async () => {
      try {
        await onConfirm()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not make the change. Try again.')
      }
    })
  }

  return (
    <AlertDialog
      open={copy !== null}
      onOpenChange={(open) => {
        // Not while the request runs: closing would hide whether it went through.
        if (!open && !guard.pending) cancel()
      }}
    >
      <AlertDialogContent>
        {copy ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-[22px] font-medium">{copy.title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="grid gap-2">
                  {copy.intro.map((text) => (
                    <p key={text}>{text}</p>
                  ))}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            {copy.lists.map((list) => (
              <div key={list.title} className="rounded-md border border-line bg-[#f8fafb] px-3 py-2.5">
                <p className="font-medium">{list.title}</p>
                <ul className="m-0 mt-1 list-disc pl-5">
                  {list.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            {copy.outro.map((text) => (
              <p key={text} className="text-ink-2">
                {text}
              </p>
            ))}
            {error ? (
              <p role="alert" className="text-[12.5px] text-red">
                {error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancel} disabled={guard.pending}>
                Cancel
              </AlertDialogCancel>
              <Button
                variant={copy.destructive ? 'destructive' : 'default'}
                disabled={guard.pending}
                onClick={confirm}
              >
                {copy.confirmLabel}
              </Button>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  )
}
