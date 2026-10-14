import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { requestPasswordReset } from '../api/auth'

const schema = z.object({ email: z.email('Enter a valid email address.') })
type Values = z.infer<typeof schema>

// Same wording whether or not the account exists (copy from the demo).
export const RESET_REQUESTED = 'If that email has an account, a reset link is on its way'

interface ForgotPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-fills the field, for example with the email typed on the sign-in form. */
  defaultEmail?: string
}

export function ForgotPasswordDialog({ open, onOpenChange, defaultEmail = '' }: ForgotPasswordDialogProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: defaultEmail } })

  function close(next: boolean) {
    if (!next) {
      reset({ email: defaultEmail })
      setFormError(null)
    }
    onOpenChange(next)
  }

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null)
    try {
      await requestPasswordReset(email.trim())
      close(false)
      toast(RESET_REQUESTED)
    } catch (e) {
      const message = e instanceof ApiError ? e.errors?.email?.[0] : undefined
      if (message) setError('email', { message })
      else setFormError('Could not send the reset link. Try again.')
    }
  })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="font-display text-[22px] font-medium">Reset your password</DialogTitle>
            <DialogDescription>
              Enter your work email. If it matches a staff account, we send a link to set a new password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="fp-email">Work email</Label>
            <Input
              id="fp-email"
              type="email"
              autoComplete="off"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'fp-email-err' : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <p id="fp-email-err" role="alert" className="text-[12.5px] text-red">
                {errors.email.message}
              </p>
            ) : null}
          </div>
          {formError ? (
            <p role="alert" className="text-[12.5px] text-red">
              {formError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Send reset link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
