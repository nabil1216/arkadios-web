import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Field } from '@/components/Field'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Role } from '@/features/auth/api/types'
import { ApiError } from '@/lib/api'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import { accessKey, inviteStaff } from '../api/access'
import { accessErrorText } from '../api/problems'
import { EMAIL_MAX_LENGTH, NAME_MAX_LENGTH, type RoleInfo, type StaffMember } from '../api/types'
import { inviteConfirmCopy } from '../hooks/confirmCopy'
import { holdsManage } from '../hooks/permissionDiff'
import { ConfirmDialog } from './ConfirmDialog'

const DEFAULT_ROLE: Role = 'support' // the demo preselects Support lead
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const ALREADY = 'This person already has access.'

// Messages are the demo's. The server checks the same rules again and has the last word.
const schema = z.object({
  name: z.string().trim().min(1, 'Enter their name.').max(NAME_MAX_LENGTH, `Use ${NAME_MAX_LENGTH} characters or fewer.`),
  email: z.string().trim().regex(EMAIL, 'Enter a valid email address.').max(EMAIL_MAX_LENGTH, 'Enter a valid email address.'),
  role: z.string().min(1, 'Choose a role.'),
})
type Values = z.infer<typeof schema>
const FIELDS = ['name', 'email', 'role'] as const

interface InviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: RoleInfo[]
  /** Already listed people, to refuse a duplicate email before asking the server. */
  members: StaffMember[]
  /** The dialog is opened from state, not from a trigger, so it needs to be told where focus goes back to. */
  returnFocusTo?: RefObject<HTMLElement | null>
}

/**
 * Invite a staff member: name, work email and role. There is no password anywhere: the person gets
 * a set-password link. Cancel is focused first, and a role that holds access.manage asks first.
 */
export function InviteDialog({ open, onOpenChange, roles, members, returnFocusTo }: InviteDialogProps) {
  const queryClient = useQueryClient()
  const guard = useSubmitGuard()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [formError, setFormError] = useState<string | null>(null)
  /** Values waiting for the answer to "give this person access.manage?". */
  const [confirming, setConfirming] = useState<Values | null>(null)

  const { register, handleSubmit, setError, setFocus, reset, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', role: roles.some((r) => r.id === DEFAULT_ROLE) ? DEFAULT_ROLE : (roles[0]?.id ?? '') },
  })

  const invite = useMutation({
    mutationFn: inviteStaff,
    onSettled: () => queryClient.invalidateQueries({ queryKey: accessKey }),
  })

  function close() {
    setFormError(null)
    setConfirming(null)
    reset()
    onOpenChange(false)
  }

  /** Sends the invitation. A refusal goes back to the form, field by field or as one line. */
  async function send(values: Values) {
    setFormError(null)
    try {
      await invite.mutateAsync({ name: values.name, email: values.email, role: values.role as Role })
      toast(`Invitation sent to ${values.email}`)
      close()
    } catch (e) {
      setConfirming(null)
      const fields = e instanceof ApiError ? e.errors : undefined
      let first: (typeof FIELDS)[number] | undefined
      for (const name of FIELDS) {
        const message = fields?.[name]?.[0]
        if (!message) continue
        setError(name, { message })
        first ??= name
      }
      if (first) setFocus(first)
      else setFormError(accessErrorText(e, 'Could not send the invitation. Try again.'))
    }
  }

  const onSubmit = handleSubmit((values) => {
    if (members.some((m) => m.email.toLowerCase() === values.email.toLowerCase())) {
      setError('email', { message: ALREADY })
      setFocus('email')
      return
    }
    const role = roles.find((r) => r.id === values.role)
    if (role && holdsManage(role.permissions)) setConfirming(values) // ask before handing out access.manage
    else void guard.run(() => send(values))
  })

  const confirmRole = confirming ? roles.find((r) => r.id === confirming.role) : undefined
  const invalid = (name: keyof Values) => (errors[name] ? true : undefined)

  return (
    <>
      <Dialog
        open={open && !confirming}
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
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo?.current) return
            event.preventDefault()
            returnFocusTo.current.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-[22px] font-medium">Invite a staff member</DialogTitle>
            <DialogDescription>They get an email with a link to set up their sign-in.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            <Field id="iv-name" label="Full name" error={errors.name?.message}>
              {(describedBy) => <Input id="iv-name" autoComplete="off" aria-invalid={invalid('name')} aria-describedby={describedBy} {...register('name')} />}
            </Field>
            <Field id="iv-email" label="Work email" error={errors.email?.message}>
              {(describedBy) => (
                <Input id="iv-email" type="email" autoComplete="off" aria-invalid={invalid('email')} aria-describedby={describedBy} {...register('email')} />
              )}
            </Field>
            <Field id="iv-role" label="Role" error={errors.role?.message}>
              {(describedBy) => (
                <NativeSelect id="iv-role" aria-invalid={invalid('role')} aria-describedby={describedBy} {...register('role')}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            {formError ? (
              <p role="alert" className="text-[12.5px] text-red">
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <Button ref={cancelRef} type="button" variant="secondary" onClick={close} disabled={guard.pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={guard.pending}>
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        copy={confirming && confirmRole ? inviteConfirmCopy(confirming.name, confirmRole) : null}
        onCancel={() => setConfirming(null)}
        onConfirm={() => send(confirming!)}
      />
    </>
  )
}
