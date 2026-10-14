import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listPlans, MODULES, planOptions, resetMockPlans, updatePlan } from './plans'
import { createTenant, provisioningOf, resetMockTenants, settleProvisioning, setProvisionStepMs, tenantOptions } from './tenantCreate'

const plan = (id: string) => listPlans().plans.find((p) => p.id === id)!
const allOff = Object.fromEntries(MODULES.map((m) => [m.id, false]))
const update = (id: string, patch: Record<string, unknown> = {}) => {
  const current = plan(id)
  return updatePlan(id, { modules: current.modules, trialDays: current.trialDays, version: current.version, ...patch })
}
const errorsOf = (id: string, patch: Record<string, unknown>) => {
  const result = update(id, patch)
  if (result.ok || result.status === 404) throw new Error('expected errors')
  return result
}

beforeEach(() => {
  resetMockPlans()
  resetMockTenants()
})
afterEach(() => {
  resetMockPlans()
  resetMockTenants()
  setProvisionStepMs(850)
})

describe('seed (the demo)', () => {
  it('has Essentials, Professional and Enterprise with their trial lengths and blurbs', () => {
    expect(listPlans().plans.map((p) => [p.id, p.name, p.trialDays, p.blurb])).toEqual([
      ['essentials', 'Essentials', 14, 'Directory and service history'],
      ['professional', 'Professional', 30, 'Adds workflows, reports, AI'],
      ['enterprise', 'Enterprise', 30, 'Adds integrations and audit'],
    ])
  })

  it('has the 11 modules, the last two coming later', () => {
    expect(MODULES.map((m) => m.id)).toEqual([
      'directory', 'lifetime', 'workstreams', 'reports', 'dashboards', 'ai', 'sso', 'audit', 'integrations', 'ticketing', 'documents',
    ])
    expect(MODULES.filter((m) => m.comingLater).map((m) => m.id)).toEqual(['ticketing', 'documents'])
    expect(MODULES[0]).toEqual({ id: 'directory', name: 'Firm and advisor directory', note: 'Firms, advisors, staff, custom fields', comingLater: false })
  })

  it('switches on what each plan includes, as the demo does', () => {
    const on = (id: string) => Object.entries(plan(id).modules).filter(([, v]) => v).map(([k]) => k)
    expect(on('essentials')).toEqual(['directory', 'lifetime'])
    expect(on('professional')).toEqual(['directory', 'lifetime', 'workstreams', 'reports', 'dashboards', 'ai', 'sso', 'audit'])
    expect(on('enterprise')).toEqual([...on('professional'), 'integrations'])
    for (const p of listPlans().plans) expect(Object.keys(p.modules)).toEqual(MODULES.map((m) => m.id))
  })

  it('counts the tenants on each plan from the tenants list', () => {
    expect(listPlans().plans.map((p) => [p.id, p.tenantCount])).toEqual([['essentials', 1], ['professional', 3], ['enterprise', 2]])
  })

  it('starts every plan at version 1', () => {
    expect(listPlans().plans.map((p) => p.version)).toEqual([1, 1, 1])
  })
})

describe('updatePlan: success', () => {
  it('replaces the modules and the trial length, bumps the version and returns the plan', () => {
    const result = update('professional', { modules: { ...plan('professional').modules, integrations: true }, trialDays: 21 })
    expect(result).toMatchObject({ ok: true, plan: { id: 'professional', trialDays: 21, version: 2, tenantCount: 3 } })
    if (result.ok) expect(result.plan.modules.integrations).toBe(true)
    expect(plan('professional')).toMatchObject({ trialDays: 21, version: 2 })
    expect(plan('professional').modules.integrations).toBe(true)
  })

  it('leaves the other plans alone', () => {
    update('professional', { trialDays: 21 })
    expect(plan('essentials')).toMatchObject({ trialDays: 14, version: 1 })
    expect(plan('enterprise')).toMatchObject({ trialDays: 30, version: 1 })
  })

  it('accepts switching a module off, and the edges 0 and 90 days', () => {
    expect(update('enterprise', { modules: { ...plan('enterprise').modules, integrations: false } }).ok).toBe(true)
    expect(update('enterprise', { trialDays: 0 }).ok).toBe(true)
    expect(update('enterprise', { trialDays: 90 }).ok).toBe(true)
  })

  it('does not change what the caller sent afterwards', () => {
    const modules = { ...plan('essentials').modules }
    updatePlan('essentials', { modules, trialDays: 14, version: 1 })
    modules.directory = false
    expect(plan('essentials').modules.directory).toBe(true)
  })

  it('bumps the version on every save, and a version can be used once', () => {
    expect(update('essentials').ok).toBe(true)
    expect(plan('essentials').version).toBe(2)
    expect(update('essentials').ok).toBe(true)
    expect(plan('essentials').version).toBe(3)
    expect(updatePlan('essentials', { modules: plan('essentials').modules, trialDays: 14, version: 2 })).toMatchObject({ ok: false, status: 409 })
  })
})

describe('updatePlan: refused', () => {
  it('answers 404 for a plan that does not exist', () => {
    expect(updatePlan('gold', { modules: allOff, trialDays: 1, version: 1 })).toEqual({ ok: false, status: 404 })
  })

  it.each([-1, 91, 2.5, '30', null, NaN, undefined])('rejects a trial length of %j', (trialDays) => {
    expect(errorsOf('essentials', { trialDays }).errors.trialDays).toEqual(['Enter a number from 0 to 90.'])
  })

  it('rejects an unknown module', () => {
    const result = errorsOf('essentials', { modules: { ...plan('essentials').modules, quantum: true } })
    expect(result.errors).toEqual({ 'modules.quantum': ['Unknown module.'] })
  })

  it('rejects a body that leaves a module out, or sends it as something else', () => {
    const { audit: _omitted, ...rest } = plan('essentials').modules
    void _omitted
    expect(errorsOf('essentials', { modules: rest }).errors).toEqual({ 'modules.audit': ['Send true or false.'] })
    expect(errorsOf('essentials', { modules: { ...rest, audit: 'yes' } }).errors['modules.audit']).toBeDefined()
  })

  it.each([undefined, null, [], 'x'])('rejects modules sent as %j', (modules) => {
    expect(errorsOf('essentials', { modules }).errors.modules).toEqual(['Send every module as true or false.'])
  })

  it('refuses to switch a coming-later module on, but allows it off', () => {
    const result = errorsOf('enterprise', { modules: { ...plan('enterprise').modules, ticketing: true, documents: true } })
    expect(result.errors).toEqual({
      'modules.ticketing': ['Coming later: it cannot be switched on yet.'],
      'modules.documents': ['Coming later: it cannot be switched on yet.'],
    })
    expect(update('enterprise', { modules: { ...plan('enterprise').modules, ticketing: false } }).ok).toBe(true)
  })

  it('refuses unknown fields', () => {
    expect(errorsOf('essentials', { name: 'Gold', tenantCount: 9 }).errors).toEqual({ name: ['Unknown field.'], tenantCount: ['Unknown field.'] })
    expect(plan('essentials').name).toBe('Essentials')
  })

  it.each([undefined, null, '1', 1.5])('asks for the version when it is %j', (version) => {
    expect(errorsOf('essentials', { version }).errors.version).toEqual(['Send the version you loaded.'])
  })

  it.each([undefined, null, [], 'text', 7])('treats %j as an empty body', (body) => {
    const result = updatePlan('essentials', body)
    expect(result.ok).toBe(false)
    if (!result.ok && result.status === 400) expect(Object.keys(result.errors).sort()).toEqual(['modules', 'trialDays', 'version'])
  })

  it('reports every bad field at once', () => {
    const result = errorsOf('essentials', { modules: { quantum: true }, trialDays: 500, version: 'x' })
    expect(Object.keys(result.errors)).toEqual(expect.arrayContaining(['modules.quantum', 'modules.directory', 'trialDays', 'version']))
  })

  it('answers 409 for a stale version, with the Reload wording', () => {
    update('essentials') // someone else saved
    const stale = updatePlan('essentials', { modules: plan('essentials').modules, trialDays: 25, version: 1 })
    expect(stale).toEqual({ ok: false, status: 409, errors: { version: ['This plan was changed by someone else. Reload to see the latest.'] } })
    expect(plan('essentials').trialDays).toBe(14) // nothing was applied
  })

  it('answers 400 before 409', () => {
    update('essentials')
    expect(errorsOf('essentials', { version: 1, trialDays: 500 })).toMatchObject({ status: 400 })
  })

  it('changes nothing when it refuses', () => {
    errorsOf('essentials', { trialDays: -5 })
    expect(plan('essentials')).toMatchObject({ trialDays: 14, version: 1 })
  })
})

describe('plans and the rest of the console', () => {
  it('counts a new tenant on its plan once it has been provisioned', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-10-14T09:00:00Z'))
      setProvisionStepMs(850)
      const result = createTenant({
        name: 'Harbor Lane Advisors',
        domain: 'harbor-lane-advisors',
        planId: 'enterprise',
        userLimit: 80,
        region: 'us-west',
        adminEmail: 'it@harborlane.example',
      })
      expect(result.ok).toBe(true)
      expect(plan('enterprise').tenantCount).toBe(2) // still provisioning
      settleProvisioning(Date.now() + 850 * 5)
      expect(plan('enterprise').tenantCount).toBe(3)
      expect(plan('professional').tenantCount).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers the create form the same plans, with the trial length just saved', () => {
    update('essentials', { trialDays: 21 })
    expect(tenantOptions().plans.find((p) => p.id === 'essentials')).toEqual({
      id: 'essentials',
      name: 'Essentials',
      blurb: 'Directory and service history',
      trialDays: 21,
    })
    expect(planOptions().map((p) => p.id)).toEqual(['essentials', 'professional', 'enterprise'])
  })

  it('tells a tenant created after the change how long its trial runs', () => {
    update('essentials', { trialDays: 21 })
    setProvisionStepMs(1)
    const result = createTenant({
      name: 'Small Firm',
      domain: 'small-firm',
      planId: 'essentials',
      userLimit: 10,
      region: 'us-east',
      adminEmail: 'a@small.example',
    })
    if (!result.ok) throw new Error('expected ok')
    expect(provisioningOf(result.id, Date.now() + 100)?.result?.trialDays).toBe(21)
  })

  it('resets to the demo plans', () => {
    update('essentials', { trialDays: 21 })
    resetMockPlans()
    expect(plan('essentials')).toMatchObject({ trialDays: 14, version: 1 })
  })
})
