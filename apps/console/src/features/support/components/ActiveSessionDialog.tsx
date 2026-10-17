import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useReopenKey } from '@/lib/useReopenKey'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import { useRef, useState } from 'react'
import { supportErrorText } from '../api/problems'
import type { SupportSession } from '../api/types'
import { useEndSession } from '../hooks/useEndSession'

interface ActiveSessionDialogProps {
  /** The session that is in the way; null keeps the dialog closed. */
  session: SupportSession | null
  onClose: () => void
  /** The first session is over: carry on with starting the new one. */
  onEnded: () => void
}

/** One open session per person: starting a second one asks to end the first (the demo's "End that session"). */
export function ActiveSessionDialog({ session, onClose, onEnded }: ActiveSessionDialogProps) {
  const end = useEndSession()
  const guard = useSubmitGuard()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState<string | null>(null)
  const reopenKey = useReopenKey(session !== null)
  // The words stay on screen while the dialog fades out.
  const [shown, setShown] = useState(session)
  if (session && session !== shown) setShown(session)

  function close() {
    setError(null)
    onClose()
  }

  function endIt() {
    if (!session) return
    setError(null)
    void guard.run(async () => {
      try {
        await end.mutateAsync(session.id)
        toast('Support session ended')
        onClose()
        onEnded()
      } catch (e) {
        setError(supportErrorText(e, 'Could not end the session. Try again.'))
      }
    })
  }

  return (
    <Dialog
      key={reopenKey}
      open={session !== null}
      onOpenChange={(next) => {
        if (!next && !guard.pending) close()
      }}
    >
      <DialogContent
        className="bg-paper"
        showCloseButton={!guard.pending}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          cancelRef.current?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-medium">Start a support session</DialogTitle>
          <DialogDescription>Troubleshoot as a tenant user. Every action is logged.</DialogDescription>
        </DialogHeader>
        {shown ? (
          <p>
            A support session is already open on <strong>{shown.tenantName}</strong>. End it before starting another.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-[12.5px] text-red">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button ref={cancelRef} variant="secondary" onClick={close} disabled={guard.pending}>
            Cancel
          </Button>
          <Button onClick={endIt} disabled={guard.pending}>
            End that session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
