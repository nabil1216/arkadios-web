import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTenant, provisioningOf, resetMockTenants, settleProvisioning, setProvisionStepMs } from './tenantCreate'
import { queryTenants } from './tenants'

const GOOD = {
  name: 'Harbor Lane Advisors',
  domain: 'harbor-lane-advisors',
  planId: 'enterprise',
  userLimit: 80,
  region: 'us-west',
  adminEmail: 'it@harborlane.example',
}
const STEP = 850

const create = (body: unknown = GOOD) => createTenant(body)
const errorsOf = (body: unknown) => {
  const result = createTenant(body)
  if (result.ok) throw new Error('expected errors')
  return result
}
const total = () => {
  const result = queryTenants(new URLSearchParams())
  return result.ok ? result.body.total : -1
}

beforeEach(() => {
  resetMockTenants()
  setProvisionStepMs(STEP)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T09:00:00Z'))
})
afterEach(() => {
  vi.useRealTimers()
  resetMockTenants()
})

describe('createTenant: accepted', () => {
  it('accepts a valid body and returns an opaque GUID', () => {
    const result = create()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('trims the name and the email', () => {
    const result = create({ ...GOOD, name: '  Harbor Lane Advisors  ', adminEmail: ' it@harborlane.example ' })
    if (!result.ok) throw new Error('expected ok')
    const job = provisioningOf(result.id)!
    expect(job.steps[4].label).toBe('Inviting it@harborlane.example as the first admin')
  })

  it('accepts the edges: 3 and 30 character domains, 1 and 1000 users, 100 character name', () => {
    expect(create({ ...GOOD, domain: 'abc' }).ok).toBe(true)
    expect(create({ ...GOOD, domain: 'a'.repeat(30) }).ok).toBe(true)
    expect(create({ ...GOOD, domain: 'edge-one', userLimit: 1 }).ok).toBe(true)
    expect(create({ ...GOOD, domain: 'edge-max', userLimit: 1000 }).ok).toBe(true)
    expect(create({ ...GOOD, domain: 'long-name', name: 'x'.repeat(100) }).ok).toBe(true)
  })
})

describe('createTenant: validation', () => {
  it('reports every bad field at once, with the demo wording', () => {
    const result = errorsOf({ name: ' ', domain: 'No', planId: 'gold', userLimit: 0, region: 'mars', adminEmail: 'nope' })
    expect(result.status).toBe(400)
    expect(result.errors).toEqual({
      name: ['Enter the company name.'],
      domain: ['Use 3 to 30 lowercase letters, numbers, or hyphens.'],
      planId: ['Choose a plan.'],
      userLimit: ['Enter a number from 1 to 1000.'],
      region: ['Choose a hosting region.'],
      adminEmail: ['Enter a valid email address.'],
    })
  })

  it.each([undefined, null, 'text', 42, [], {}])('treats %j as an empty body', (body) => {
    expect(Object.keys(errorsOf(body).errors).sort()).toEqual(['adminEmail', 'domain', 'name', 'planId', 'region', 'userLimit'])
  })

  it.each(['ab', 'a'.repeat(31), 'Upper', '-leading', 'under_score', 'with space', 'dot.ted', ''])('rejects the domain %j', (domain) => {
    expect(errorsOf({ ...GOOD, domain }).errors.domain).toBeDefined()
  })

  it.each([0, -1, 1001, 2.5, '50', null, NaN])('rejects the user limit %j', (userLimit) => {
    expect(errorsOf({ ...GOOD, userLimit }).errors.userLimit).toBeDefined()
  })

  it('rejects a name over 100 characters', () => {
    expect(errorsOf({ ...GOOD, name: 'x'.repeat(101) }).errors.name).toEqual(['Use 100 characters or fewer.'])
  })

  it('refuses unknown fields', () => {
    const result = errorsOf({ ...GOOD, status: 'active', id: 'x' })
    expect(result.errors).toEqual({ status: ['Unknown field.'], id: ['Unknown field.'] })
  })
})

describe('createTenant: domain', () => {
  it('answers 409 with errors.domain for a domain that is already in use', () => {
    const result = errorsOf({ ...GOOD, domain: 'northwind' })
    expect(result).toEqual({ ok: false, status: 409, errors: { domain: ['This domain is already taken.'] } })
  })

  it('reserves the domain while the tenant is still being provisioned', () => {
    expect(create().ok).toBe(true)
    expect(errorsOf(GOOD).status).toBe(409)
  })

  it('reports a bad body (400) before a taken domain (409)', () => {
    expect(errorsOf({ ...GOOD, domain: 'northwind', userLimit: 0 }).status).toBe(400)
  })
})

describe('provisioning', () => {
  function start() {
    const result = create()
    if (!result.ok) throw new Error('expected ok')
    return result.id
  }
  const states = (id: string, afterMs: number) =>
    provisioningOf(id, Date.now() + afterMs)!.steps.map((s) => s.state)

  it('has the five steps of the demo, with the database, release, domain and email in the wording', () => {
    const job = provisioningOf(start())!
    expect(job.steps.map((s) => s.label)).toEqual([
      'Creating the database tenant_harbor_lane_advisors',
      'Running migrations for release 2.4.0',
      'Seeding default stages, checklists, and roles',
      'Setting up the domain harbor-lane-advisors.platform.example',
      'Inviting it@harborlane.example as the first admin',
    ])
    expect(job.steps.map((s) => s.key)).toEqual(['database', 'migrations', 'seed', 'domain', 'invite'])
  })

  it('starts with the first step running and the rest waiting', () => {
    const id = start()
    expect(provisioningOf(id)).toMatchObject({ status: 'running' })
    expect(states(id, 0)).toEqual(['running', 'waiting', 'waiting', 'waiting', 'waiting'])
  })

  it('moves one step every 850 ms', () => {
    const id = start()
    expect(states(id, STEP - 1)).toEqual(['running', 'waiting', 'waiting', 'waiting', 'waiting'])
    expect(states(id, STEP)).toEqual(['done', 'running', 'waiting', 'waiting', 'waiting'])
    expect(states(id, STEP * 3 + 5)).toEqual(['done', 'done', 'done', 'running', 'waiting'])
    expect(states(id, STEP * 4)).toEqual(['done', 'done', 'done', 'done', 'running'])
  })

  it('succeeds after the last step, with what the ready note needs', () => {
    const id = start()
    const job = provisioningOf(id, Date.now() + STEP * 5)!
    expect(job.status).toBe('succeeded')
    expect(job.steps.every((s) => s.state === 'done')).toBe(true)
    expect(job.result).toEqual({
      name: 'Harbor Lane Advisors',
      domain: 'harbor-lane-advisors.platform.example',
      adminEmail: 'it@harborlane.example',
      trialDays: 30,
    })
  })

  it('takes the trial length from the plan', () => {
    const result = create({ ...GOOD, domain: 'small-firm', planId: 'essentials' })
    if (!result.ok) throw new Error('expected ok')
    expect(provisioningOf(result.id, Date.now() + STEP * 5)!.result!.trialDays).toBe(14)
  })

  it('does not know a job it never started', () => {
    expect(provisioningOf('00000000-0000-4000-8000-000000000000')).toBeUndefined()
  })

  it('adds the tenant to the list only when provisioning has finished: trial, one user', () => {
    const id = start()
    settleProvisioning(Date.now() + STEP * 5 - 1)
    expect(total()).toBe(6)
    settleProvisioning(Date.now() + STEP * 5)
    expect(total()).toBe(7)
    const list = queryTenants(new URLSearchParams({ q: 'harbor' }))
    if (!list.ok) throw new Error('expected ok')
    expect(list.body.items[0]).toMatchObject({
      id,
      name: 'Harbor Lane Advisors',
      domain: 'harbor-lane-advisors.platform.example',
      database: 'tenant_harbor_lane_advisors',
      planId: 'enterprise',
      planName: 'Enterprise',
      usersUsed: 1,
      userLimit: 80,
      status: 'trial',
    })
    expect(JSON.stringify(list.body)).not.toMatch(/Server=|Password/)
  })

  it('adds a tenant once, however often it is settled', () => {
    start()
    settleProvisioning(Date.now() + STEP * 6)
    settleProvisioning(Date.now() + STEP * 7)
    expect(total()).toBe(7)
  })

  it('still reserves the domain after the tenant exists', () => {
    start()
    settleProvisioning(Date.now() + STEP * 5)
    expect(errorsOf(GOOD).status).toBe(409)
  })
})

describe('resetMockTenants', () => {
  it('goes back to the six demo tenants and forgets jobs', () => {
    const result = create()
    settleProvisioning(Date.now() + STEP * 5)
    expect(total()).toBe(7)
    resetMockTenants()
    expect(total()).toBe(6)
    if (result.ok) expect(provisioningOf(result.id)).toBeUndefined()
    expect(create().ok).toBe(true) // the domain is free again
  })
})
