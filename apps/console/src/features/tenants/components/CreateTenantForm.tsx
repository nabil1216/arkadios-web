import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Field } from '@/components/Field'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useSubmitGuard } from '@/lib/useSubmitGuard'
import { createTenant } from '../api/tenants'
import {
  DOMAIN_PATTERN,
  NAME_MAX_LENGTH,
  USER_LIMIT_RANGE,
  type CreateTenantInput,
  type PlanId,
  type TenantOptions,
} from '../api/types'
import { slugify } from '../hooks/slug'

const LIMIT_MESSAGE = `Enter a number from ${USER_LIMIT_RANGE.min} to ${USER_LIMIT_RANGE.max}.`

// Messages are the demo's. The server checks the same rules again and has the last word.
const schema = z.object({
  name: z.string().trim().min(1, 'Enter the company name.').max(NAME_MAX_LENGTH, `Use ${NAME_MAX_LENGTH} characters or fewer.`),
  domain: z.string().regex(DOMAIN_PATTERN, 'Use 3 to 30 lowercase letters, numbers, or hyphens.'),
  planId: z.string().min(1, 'Choose a plan.'),
  userLimit: z
    .number({ error: LIMIT_MESSAGE })
    .int(LIMIT_MESSAGE)
    .min(USER_LIMIT_RANGE.min, LIMIT_MESSAGE)
    .max(USER_LIMIT_RANGE.max, LIMIT_MESSAGE),
  region: z.string().min(1, 'Choose a hosting region.'),
  adminEmail: z.string().trim().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Enter a valid email address.'),
})
type Values = z.infer<typeof schema>

const FIELD_NAMES = ['name', 'domain', 'planId', 'userLimit', 'region', 'adminEmail'] as const

interface CreateTenantFormProps {
  options: TenantOptions
  /** The server accepted the request (202); provisioning has started under `id`. */
  onAccepted: (accepted: { id: string; input: CreateTenantInput }) => void
  onCancel: () => void
}

export function CreateTenantForm({ options, onAccepted, onCancel }: CreateTenantFormProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const guard = useSubmitGuard()
  // The domain follows the company name until the person types in it, as in the demo.
  const domainEdited = useRef(false)
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      domain: '',
      planId: options.plans.find((p) => p.id === 'professional')?.id ?? options.plans[0]?.id ?? '',
      userLimit: 50,
      region: options.regions[0]?.id ?? '',
      adminEmail: '',
    },
  })

  const selectedPlan = useWatch({ control, name: 'planId' })
  const plan = options.plans.find((p) => p.id === selectedPlan)

  const create = useMutation({
    mutationFn: createTenant,
    onSuccess: ({ id }, input) => onAccepted({ id, input }),
    onError: (error) => {
      const fields = error instanceof ApiError ? error.errors : undefined
      let first: (typeof FIELD_NAMES)[number] | undefined
      for (const name of FIELD_NAMES) {
        const message = fields?.[name]?.[0]
        if (!message) continue
        setError(name, { message })
        first ??= name
      }
      if (first) setFocus(first)
      else if (error instanceof ApiError && error.status === 403) setFormError('Your role cannot create tenants.')
      else setFormError('Could not create the tenant. Try again.')
    },
  })

  const onSubmit = handleSubmit((values) => {
    setFormError(null)
    // Creating starts provisioning: a second submit in the same instant must not start another.
    void guard.run(() =>
      create.mutateAsync({
        name: values.name,
        domain: values.domain,
        planId: values.planId as PlanId,
        userLimit: values.userLimit,
        region: values.region,
        adminEmail: values.adminEmail,
      }),
    )
  })

  const invalid = (name: keyof Values) => (errors[name] ? true : undefined)

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Field id="ct-name" label="Company name" error={errors.name?.message}>
        {(describedBy) => (
          <Input
            id="ct-name"
            autoComplete="off"
            aria-invalid={invalid('name')}
            aria-describedby={describedBy}
            {...register('name', {
              onChange: (e) => {
                if (!domainEdited.current) setValue('domain', slugify(e.target.value), { shouldValidate: !!errors.domain })
              },
            })}
          />
        )}
      </Field>

      <Field
        id="ct-sub"
        label="Domain"
        hint="The tenant signs in here. It also names the database."
        error={errors.domain?.message}
      >
        {(describedBy) => (
          <div className="flex items-stretch">
            <Input
              id="ct-sub"
              autoComplete="off"
              aria-invalid={invalid('domain')}
              aria-describedby={describedBy}
              className="rounded-r-none font-mono text-[12.5px]"
              {...register('domain', {
                onChange: (e) => {
                  domainEdited.current = true
                  e.target.value = e.target.value.toLowerCase()
                },
              })}
            />
            <span className="grid place-items-center rounded-r-md border border-l-0 border-line bg-gray-tint px-2.5 font-mono text-[12.5px] whitespace-nowrap text-ink-2">
              .{options.baseDomain}
            </span>
          </div>
        )}
      </Field>

      <Field
        id="ct-plan"
        label="Plan"
        hint={plan ? `${plan.blurb}. Starts with a ${plan.trialDays}-day trial.` : undefined}
        error={errors.planId?.message}
      >
        {(describedBy) => (
          <NativeSelect id="ct-plan" aria-invalid={invalid('planId')} aria-describedby={describedBy} {...register('planId')}>
            {options.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="ct-limit" label="User limit" error={errors.userLimit?.message}>
        {(describedBy) => (
          <Input
            id="ct-limit"
            type="number"
            min={USER_LIMIT_RANGE.min}
            max={USER_LIMIT_RANGE.max}
            aria-invalid={invalid('userLimit')}
            aria-describedby={describedBy}
            {...register('userLimit', { valueAsNumber: true })}
          />
        )}
      </Field>

      <Field id="ct-region" label="Hosting region" hint="Where this tenant's database is hosted." error={errors.region?.message}>
        {(describedBy) => (
          <NativeSelect id="ct-region" aria-invalid={invalid('region')} aria-describedby={describedBy} {...register('region')}>
            {options.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="ct-email" label="First admin email" error={errors.adminEmail?.message}>
        {(describedBy) => (
          <Input
            id="ct-email"
            type="email"
            autoComplete="off"
            aria-invalid={invalid('adminEmail')}
            aria-describedby={describedBy}
            {...register('adminEmail')}
          />
        )}
      </Field>

      {formError ? (
        <p role="alert" className="text-[12.5px] text-red">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-line-2 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Create tenant
        </Button>
      </div>
    </form>
  )
}
