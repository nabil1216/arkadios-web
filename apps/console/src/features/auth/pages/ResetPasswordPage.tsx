import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { resetPassword } from '../api/auth'
import { AuthLayout } from '../components/AuthLayout'
import { clearResetToken, takeResetToken } from '../hooks/resetToken'

export const MIN_PASSWORD_LENGTH = 12

const schema = z
  .object({
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })
type Values = z.infer<typeof schema>

type View = 'form' | 'invalid' | 'done'

function BackToSignIn({ children }: { children: string }) {
  return (
    <p className="mt-5">
      <Button asChild>
        <Link to="/login">{children}</Link>
      </Button>
    </p>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-[12.5px] text-red">
      {message}
    </p>
  ) : null
}

function NewPasswordForm({ token, onInvalid, onDone }: { token: string; onInvalid: () => void; onDone: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setFormError(null)
    try {
      await resetPassword(token, newPassword)
      onDone()
    } catch (e) {
      const weak = e instanceof ApiError && e.status === 400 ? e.errors?.newPassword?.[0] : undefined
      if (weak) setError('newPassword', { message: weak })
      // One generic 400 covers an unknown, expired and already-used token.
      else if (e instanceof ApiError && e.status === 400) onInvalid()
      else setFormError('Could not change the password. Try again.')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="rp-new">New password</Label>
        <Input
          id="rp-new"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.newPassword}
          aria-describedby={errors.newPassword ? 'rp-new-hint rp-new-err' : 'rp-new-hint'}
          {...register('newPassword')}
        />
        <p id="rp-new-hint" className="text-[12.5px] text-ink-2">
          At least {MIN_PASSWORD_LENGTH} characters. A longer phrase is better; there are no other rules.
        </p>
        <FieldError id="rp-new-err" message={errors.newPassword?.message} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="rp-confirm">Confirm new password</Label>
        <Input
          id="rp-confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          aria-describedby={errors.confirm ? 'rp-confirm-err' : undefined}
          {...register('confirm')}
        />
        <FieldError id="rp-confirm-err" message={errors.confirm?.message} />
      </div>
      <FieldError id="rp-form-err" message={formError ?? undefined} />
      <Button type="submit" disabled={isSubmitting}>
        Set new password
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  // Read the fragment once; it is stripped from the address bar and lives in memory only.
  const [token] = useState(takeResetToken)
  const [view, setView] = useState<View>(token ? 'form' : 'invalid')

  function invalid() {
    clearResetToken()
    setView('invalid')
  }

  function done() {
    clearResetToken()
    setView('done')
  }

  if (view === 'done') {
    return (
      <AuthLayout heading="Password changed">
        <p role="status" className="mt-2 text-ink-2">
          Your password was changed. Sign in with the new password. You will still be asked for an authentication code.
        </p>
        <BackToSignIn>Sign in</BackToSignIn>
      </AuthLayout>
    )
  }

  if (view === 'invalid' || !token) {
    return (
      <AuthLayout heading="Reset link problem">
        <p role="alert" className="mt-2">
          This reset link is invalid or has expired.
        </p>
        <p className="mt-2 text-ink-2">Ask for a new link with Forgot password? on the sign-in page.</p>
        <BackToSignIn>Back to sign in</BackToSignIn>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout heading="Set a new password">
      <NewPasswordForm token={token} onInvalid={invalid} onDone={done} />
    </AuthLayout>
  )
}
