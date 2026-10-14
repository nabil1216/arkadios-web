import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { PageSpinner } from '@/components/PageSpinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { redirectTarget } from '@/lib/safe-redirect'
import { login, startSession, verifyMfa } from '../api/auth'
import { AuthLayout } from '../components/AuthLayout'
import { ForgotPasswordDialog } from '../components/ForgotPasswordDialog'
import { useSession } from '../hooks/session'

const credentialsSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})
type Credentials = z.infer<typeof credentialsSchema>
type Code = z.infer<typeof codeSchema>

const NOTICES = {
  idle: 'You were signed out after a period of inactivity.',
  expired: 'Your session has ended. Sign in again to continue.',
  user: null,
} as const

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="text-[12.5px] text-red">
      {message}
    </p>
  ) : null
}

function CredentialsForm({ onChallenge }: { onChallenge: (id: string) => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({ resolver: zodResolver(credentialsSchema) })
  const [forgotOpen, setForgotOpen] = useState(false)

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const res = await login(values.email, values.password)
      onChallenge(res.challengeId)
    } catch (e) {
      // Field errors from the server (a 400 ProblemDetails) land on the fields.
      const fields = e instanceof ApiError ? e.errors : undefined
      const email = fields?.email?.[0]
      const password = fields?.password?.[0]
      if (email) setError('email', { message: email })
      if (password) setError('password', { message: password })
      if (email || password) return
      setFormError(e instanceof ApiError && e.status === 401 ? 'Incorrect email or password.' : 'Could not sign in. Try again.')
    }
  })

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="lg-email">Email</Label>
          <Input
            id="lg-email"
            type="email"
            autoComplete="username"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'lg-email-err' : undefined}
            {...register('email')}
          />
          <FieldError id="lg-email-err" message={errors.email?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lg-password">Password</Label>
          <Input
            id="lg-password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'lg-password-err' : undefined}
            {...register('password')}
          />
          <FieldError id="lg-password-err" message={errors.password?.message} />
        </div>
        <div className="-mt-1.5 text-[13.5px]">
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="cursor-pointer border-0 bg-transparent p-0 text-teal-ink underline"
          >
            Forgot password?
          </button>
        </div>
        <FieldError id="lg-form-err" message={formError ?? undefined} />
        <Button type="submit" disabled={isSubmitting}>
          Sign in
        </Button>
      </form>
      {/* Outside the form: React events from a portal bubble to the parent form's onSubmit. */}
      {forgotOpen ? (
        <ForgotPasswordDialog open onOpenChange={setForgotOpen} defaultEmail={getValues('email')} />
      ) : null}
    </>
  )
}

function CodeForm({ challengeId, onBack }: { challengeId: string; onBack: () => void }) {
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Code>({ resolver: zodResolver(codeSchema) })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      startSession(await verifyMfa(challengeId, values.code))
    } catch (e) {
      setFormError(e instanceof ApiError && e.status === 401 ? 'That code is not right.' : 'Could not verify the code. Try again.')
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="lg-code">Authentication code</Label>
        <Input
          id="lg-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="font-mono"
          aria-invalid={!!errors.code}
          aria-describedby={errors.code ? 'lg-code-err' : undefined}
          {...register('code')}
        />
        <FieldError id="lg-code-err" message={errors.code?.message} />
      </div>
      <FieldError id="lg-form-err" message={formError ?? undefined} />
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          Verify
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </form>
  )
}

export default function LoginPage() {
  const session = useSession()
  const [params] = useSearchParams()
  const [challengeId, setChallengeId] = useState<string | null>(null)

  if (session.status === 'loading') return <PageSpinner />
  if (session.status === 'authenticated') {
    return <Navigate to={redirectTarget(params.get('next'), session.user.home)} replace />
  }

  const notice = session.reason ? NOTICES[session.reason] : null

  return (
    <AuthLayout heading="Sign in">
      {notice ? (
        <p role="status" className="mb-4 rounded-md bg-amber-tint px-3 py-2.5 text-[#5c3d00]">
          {notice}
        </p>
      ) : null}
      {challengeId ? (
        <CodeForm challengeId={challengeId} onBack={() => setChallengeId(null)} />
      ) : (
        <CredentialsForm onChallenge={setChallengeId} />
      )}
    </AuthLayout>
  )
}
