import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field } from '@/components/Field'
import { NativeSelect } from '@/components/NativeSelect'
import { Pager } from '@/components/Pager'
import { Textarea } from '@/components/Textarea'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import { useReopenKey } from '@/lib/useReopenKey'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import { fetchSupportTenants, fetchSupportUsers, startSession, supportKey, supportTenantsKey, supportUsersKey } from '../api/support'
import { supportErrorText } from '../api/problems'
import { DEFAULT_DURATION, REASON_RANGE } from '../api/types'
import { editConfirmCopy } from '../hooks/startCopy'
import { openWorkspace } from '../hooks/openWorkspace'
import { REASON_NOTICE, startSchema, type StartValues } from '../hooks/startSchema'
import { DurationChoice } from './DurationChoice'
import { ModeChoice } from './ModeChoice'

const FIELDS = ['tenantId', 'tenantUserId', 'reason', 'durationMinutes', 'mode'] as const
const SEARCH_DEBOUNCE_MS = 300
const EMPTY: StartValues = { tenantId: '', tenantUserId: '', reason: '', durationMinutes: DEFAULT_DURATION, mode: 'read' }

interface StartSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The tenant to preselect, when the dialog is opened from a tenant's row. */
  defaultTenantId?: string
  /** The dialog is opened from state, not from a trigger, so it needs to be told where focus goes back to. */
  returnFocusTo?: RefObject<HTMLElement | null>
}

/**
 * Start a support session: tenant, the user to sign in as, a reason, a length of 15, 30 or 60 minutes and read-only or
 * edit access. Cancel is focused first, and a session that can make changes asks first. The browser gets a one-time code
 * and opens the workspace with it; it never sees a tenant token.
 */
export function StartSessionDialog({ open, onOpenChange, defaultTenantId, returnFocusTo }: StartSessionDialogProps) {
  const queryClient = useQueryClient()
  const guard = useSubmitGuard()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [formError, setFormError] = useState<string | null>(null)
  /** Values waiting for the answer to "start a session that can make changes?". */
  const [confirming, setConfirming] = useState<StartValues | null>(null)
  const reopenKey = useReopenKey(open && !confirming)

  const { register, handleSubmit, setValue, getValues, setError, setFocus, reset, control, formState: { errors } } = useForm<StartValues>({
    resolver: zodResolver(startSchema),
    defaultValues: EMPTY,
  })
  const tenantId = useWatch({ control, name: 'tenantId' })
  const tenantUserId = useWatch({ control, name: 'tenantUserId' })
  const durationMinutes = useWatch({ control, name: 'durationMinutes' })
  const mode = useWatch({ control, name: 'mode' })
  const reasonLength = useWatch({ control, name: 'reason' }).trim().length

  const tenants = useQuery({ queryKey: supportTenantsKey(''), queryFn: () => fetchSupportTenants(''), enabled: open, staleTime: 0 })
  // The users of a tenant can be many: search them (once the typing pauses) and page through the matches.
  const [userText, setUserText] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [userPage, setUserPage] = useState(1)
  const users = useQuery({
    queryKey: supportUsersKey(tenantId, userQuery, userPage),
    queryFn: () => fetchSupportUsers(tenantId, userQuery, userPage),
    enabled: open && tenantId !== '',
    staleTime: 0,
    placeholderData: keepPreviousData,
  })
  useEffect(() => {
    if (userText.trim() === userQuery) return
    const id = setTimeout(() => {
      setUserQuery(userText.trim())
      setUserPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [userText, userQuery])

  // Preselect the tenant the dialog was opened for (or the first), and the first user of the chosen tenant, as the demo does.
  useEffect(() => {
    if (!open || !tenants.data) return
    const ids = tenants.data.items.map((t) => t.id)
    if (!ids.includes(getValues('tenantId'))) setValue('tenantId', defaultTenantId && ids.includes(defaultTenantId) ? defaultTenantId : (ids[0] ?? ''))
  }, [open, tenants.data, defaultTenantId, getValues, setValue])
  useEffect(() => {
    if (!users.data) return
    if (!users.data.items.some((u) => u.id === getValues('tenantUserId'))) setValue('tenantUserId', users.data.items[0]?.id ?? '')
  }, [users.data, getValues, setValue])

  const start = useMutation({ mutationFn: startSession, onSettled: () => queryClient.invalidateQueries({ queryKey: supportKey }) })

  function close() {
    setFormError(null)
    setConfirming(null)
    setUserText('')
    setUserQuery('')
    setUserPage(1)
    reset(EMPTY)
    onOpenChange(false)
  }

  /** Starts the session. A refusal goes back to the form, field by field or as one line. */
  async function send(values: StartValues) {
    setFormError(null)
    try {
      const { session, handoff } = await start.mutateAsync(values)
      toast(`Support session started on ${session.tenantName}`)
      openWorkspace(handoff.url)
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
      else setFormError(supportErrorText(e, 'Could not start the session. Try again.'))
    }
  }

  const onSubmit = handleSubmit((values) => {
    if (values.mode === 'edit') setConfirming(values) // a session that can make changes asks first
    else void guard.run(() => send(values))
  })

  const tenantName = tenants.data?.items.find((t) => t.id === (confirming?.tenantId ?? tenantId))?.name ?? ''
  const userName = users.data?.items.find((u) => u.id === (confirming?.tenantUserId ?? tenantUserId))?.name ?? ''
  const noTenants = tenants.data && tenants.data.items.length === 0
  const noUsers = users.data && users.data.items.length === 0
  const ready = !!tenants.data && !noTenants && !!users.data && !noUsers && tenantUserId !== ''
  const invalid = (name: keyof StartValues) => (errors[name] ? true : undefined)

  return (
    <>
      <Dialog
        key={reopenKey}
        open={open && !confirming}
        onOpenChange={(next) => {
          if (!next && !guard.pending) close()
        }}
      >
        <DialogContent
          className="max-h-[calc(100vh-32px)] overflow-y-auto bg-paper"
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
            <DialogTitle className="font-display text-[22px] font-medium">Start a support session</DialogTitle>
            <DialogDescription>Troubleshoot as a tenant user. Every action is logged.</DialogDescription>
          </DialogHeader>

          {tenants.isError ? (
            <div role="alert" className="grid gap-2 text-red">
              <p>{tenants.error instanceof ApiError ? tenants.error.message : 'Could not load the tenants. Check your connection and try again.'}</p>
              <Button variant="secondary" size="sm" className="w-fit" onClick={() => void tenants.refetch()}>
                Try again
              </Button>
            </div>
          ) : null}
          {noTenants ? <p className="text-ink-2">No tenant can be signed in to right now. Only active and trial tenants can.</p> : null}

          <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-busy={tenants.isPending}>
            <Field id="si-tenant" label="Tenant" error={errors.tenantId?.message}>
              {(describedBy) => (
                <NativeSelect
                  id="si-tenant"
                  aria-invalid={invalid('tenantId')}
                  aria-describedby={describedBy}
                  disabled={!tenants.data || guard.pending}
                  value={tenantId}
                  onChange={(e) => {
                    setValue('tenantId', e.target.value, { shouldValidate: !!errors.tenantId })
                    setValue('tenantUserId', '') // the users belong to the tenant
                    setUserText('')
                    setUserQuery('')
                    setUserPage(1)
                  }}
                >
                  {tenants.data ? (
                    tenants.data.items.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Loading tenants</option>
                  )}
                </NativeSelect>
              )}
            </Field>

            <div className="relative">
              <label htmlFor="si-user-search" className="sr-only">
                Search users
              </label>
              <Search size={16} strokeWidth={1.7} aria-hidden="true" className="pointer-events-none absolute top-[11px] left-[11px] text-ink-2" />
              <Input
                id="si-user-search"
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault() // Enter searches, it does not start the session
                }}
                placeholder="Search this tenant's users"
                autoComplete="off"
                maxLength={100}
                disabled={guard.pending}
                className="h-[38px] bg-paper pl-[34px]"
              />
            </div>

            <Field id="si-user" label="Sign in as" hint="You act with this user's permissions, without their password." error={errors.tenantUserId?.message}>
              {(describedBy) => (
                <NativeSelect
                  id="si-user"
                  aria-invalid={invalid('tenantUserId')}
                  aria-describedby={describedBy}
                  disabled={!users.data || noUsers || guard.pending}
                  value={tenantUserId}
                  onChange={(e) => setValue('tenantUserId', e.target.value, { shouldValidate: !!errors.tenantUserId })}
                >
                  {users.data ? (
                    users.data.items.length > 0 ? (
                      users.data.items.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))
                    ) : (
                      <option value="">{userQuery ? 'No users match' : 'No active users'}</option>
                    )
                  ) : (
                    <option value="">Loading users</option>
                  )}
                </NativeSelect>
              )}
            </Field>
            {users.data ? (
              <Pager
                page={users.data.page}
                pageSize={users.data.pageSize}
                total={users.data.total}
                onPage={(page) => {
                  setUserPage(page)
                  setValue('tenantUserId', '')
                }}
              />
            ) : null}
            {users.isError ? (
              <p role="alert" className="-mt-2 text-[12.5px] text-red">
                Could not load the users of this tenant. Choose it again to retry.
              </p>
            ) : null}

            <Field
              id="si-reason"
              label="Reason"
              hint={
                <>
                  {REASON_NOTICE}{' '}
                  <span aria-hidden="true" className="whitespace-nowrap tabular-nums">
                    {reasonLength} / {REASON_RANGE.max}
                  </span>
                </>
              }
              error={errors.reason?.message}
            >
              {(describedBy) => <Textarea id="si-reason" autoComplete="off" aria-invalid={invalid('reason')} aria-describedby={describedBy} {...register('reason')} />}
            </Field>

            <div className="grid gap-2">
              <span id="si-length" className="font-medium">
                Length
              </span>
              <DurationChoice labelledBy="si-length" value={durationMinutes} onChange={(minutes) => setValue('durationMinutes', minutes)} disabled={guard.pending} />
              {errors.durationMinutes ? (
                <p role="alert" className="text-[12.5px] text-red">
                  {errors.durationMinutes.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <span id="si-access" className="font-medium">
                Access
              </span>
              <ModeChoice labelledBy="si-access" value={mode} onChange={(m) => setValue('mode', m)} disabled={guard.pending} />
              {errors.mode ? (
                <p role="alert" className="text-[12.5px] text-red">
                  {errors.mode.message}
                </p>
              ) : null}
            </div>

            {formError ? (
              <p role="alert" className="text-[12.5px] text-red">
                {formError}
              </p>
            ) : null}

            <DialogFooter>
              <Button ref={cancelRef} type="button" variant="secondary" onClick={close} disabled={guard.pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={guard.pending || !ready}>
                Start support session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        copy={confirming ? editConfirmCopy(tenantName, userName, confirming.durationMinutes) : null}
        onCancel={() => setConfirming(null)}
        onConfirm={() => send(confirming!)}
      />
    </>
  )
}
