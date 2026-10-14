// Mock of tenant creation (docs/ARCHITECTURE.md, "Create tenant"): validation, the domain
// reservation, and a provisioning job whose five steps finish one after another.
// Steps and wording follow provision() in docs/handoff/platform-console/assets/platform.js.
import {
  DOMAIN_PATTERN,
  NAME_MAX_LENGTH,
  USER_LIMIT_RANGE,
  type CreateTenantInput,
  type PlanId,
  type Provisioning,
  type ProvisioningStep,
  type RegionOption,
  type TenantOptions,
} from '@/features/tenants/api/types'
import { planOptions } from './plans'
import { BASE_DOMAIN, makeTenantRecord, tenantRecords } from './tenants'

/** The release new tenants are migrated to (LATEST in the demo). */
const RELEASE = '2.4.0'
/** Time each step takes (850 ms in the demo). Tests shorten it. */
let stepMs = 850
export const setProvisionStepMs = (ms: number) => {
  stepMs = ms
}

export const REGION_OPTIONS: RegionOption[] = [
  { id: 'us-east', name: 'US East' },
  { id: 'us-west', name: 'US West' },
  { id: 'eu-frankfurt', name: 'EU Frankfurt' },
]

export const tenantOptions = (): TenantOptions => ({ plans: planOptions(), regions: REGION_OPTIONS, baseDomain: BASE_DOMAIN })

const FIELDS = ['name', 'domain', 'planId', 'userLimit', 'region', 'adminEmail'] as const
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface Job {
  input: CreateTenantInput
  startedAt: number
  materialized: boolean
}
const jobs = new Map<string, Job>()
const seed = [...tenantRecords]

/** Back to the six demo tenants and no jobs (tests). */
export function resetMockTenants() {
  tenantRecords.length = 0
  tenantRecords.push(...seed)
  jobs.clear()
}

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; status: 400 | 409; errors: Record<string, string[]> }

const domainTaken = (domain: string) =>
  tenantRecords.some((t) => t.domain === `${domain}.${BASE_DOMAIN}`) ||
  [...jobs.values()].some((j) => j.input.domain === domain)

/** Validates the body like the real endpoint: every bad field at once, unknown fields refused. */
export function createTenant(body: unknown): CreateResult {
  const raw = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>
  const errors: Record<string, string[]> = {}
  for (const key of Object.keys(raw)) {
    if (!(FIELDS as readonly string[]).includes(key)) errors[key] = ['Unknown field.']
  }

  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) errors.name = ['Enter the company name.']
  else if (name.length > NAME_MAX_LENGTH) errors.name = [`Use ${NAME_MAX_LENGTH} characters or fewer.`]

  const domain = typeof raw.domain === 'string' ? raw.domain : ''
  if (!DOMAIN_PATTERN.test(domain)) errors.domain = ['Use 3 to 30 lowercase letters, numbers, or hyphens.']

  const plan = planOptions().find((p) => p.id === raw.planId)
  if (!plan) errors.planId = ['Choose a plan.']

  const limit = raw.userLimit
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < USER_LIMIT_RANGE.min || limit > USER_LIMIT_RANGE.max) {
    errors.userLimit = [`Enter a number from ${USER_LIMIT_RANGE.min} to ${USER_LIMIT_RANGE.max}.`]
  }

  const region = REGION_OPTIONS.find((r) => r.id === raw.region)
  if (!region) errors.region = ['Choose a hosting region.']

  const adminEmail = typeof raw.adminEmail === 'string' ? raw.adminEmail.trim() : ''
  if (!EMAIL.test(adminEmail)) errors.adminEmail = ['Enter a valid email address.']

  if (Object.keys(errors).length) return { ok: false, status: 400, errors }
  if (domainTaken(domain)) return { ok: false, status: 409, errors: { domain: ['This domain is already taken.'] } }

  const id = crypto.randomUUID()
  jobs.set(id, {
    input: { name, domain, planId: plan!.id, userLimit: limit as number, region: region!.id, adminEmail },
    startedAt: Date.now(),
    materialized: false,
  })
  return { ok: true, id }
}

function stepLabels(input: CreateTenantInput): Omit<ProvisioningStep, 'state'>[] {
  const database = 'tenant_' + input.domain.replace(/-/g, '_')
  return [
    { key: 'database', label: `Creating the database ${database}` },
    { key: 'migrations', label: `Running migrations for release ${RELEASE}` },
    { key: 'seed', label: 'Seeding default stages, checklists, and roles' },
    { key: 'domain', label: `Setting up the domain ${input.domain}.${BASE_DOMAIN}` },
    { key: 'invite', label: `Inviting ${input.adminEmail} as the first admin` },
  ]
}

/** Finished jobs become tenants (status trial, one user), as in the demo. */
export function settleProvisioning(now = Date.now()) {
  for (const [id, job] of jobs) {
    if (job.materialized || now - job.startedAt < stepLabels(job.input).length * stepMs) continue
    job.materialized = true
    tenantRecords.unshift(
      makeTenantRecord(id, job.input.name, job.input.domain, job.input.planId as PlanId, 1, job.input.userLimit, 'trial', 0),
    )
  }
}

export function provisioningOf(id: string, now = Date.now()): Provisioning | undefined {
  const job = jobs.get(id)
  if (!job) return undefined
  const labels = stepLabels(job.input)
  const done = Math.min(labels.length, Math.floor((now - job.startedAt) / stepMs))
  const steps = labels.map<ProvisioningStep>((s, i) => ({ ...s, state: i < done ? 'done' : i === done ? 'running' : 'waiting' }))
  if (done < labels.length) return { id, status: 'running', steps }
  const plan = planOptions().find((p) => p.id === job.input.planId)!
  return {
    id,
    status: 'succeeded',
    steps,
    result: {
      name: job.input.name,
      domain: `${job.input.domain}.${BASE_DOMAIN}`,
      adminEmail: job.input.adminEmail,
      trialDays: plan.trialDays,
    },
  }
}
