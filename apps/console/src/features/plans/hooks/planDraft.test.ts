import { describe, expect, it } from 'vitest'
import type { Plan, PlanModule } from '../api/types'
import { isChanged, offSummaries, parseTrialDays, savedDraft, switchedOff, toUpdate, trialError, TRIAL_MESSAGE } from './planDraft'

const catalog: PlanModule[] = [
  { id: 'directory', name: 'Firm and advisor directory', note: '', comingLater: false },
  { id: 'reports', name: 'Report builder', note: '', comingLater: false },
  { id: 'integrations', name: 'Integrations', note: '', comingLater: false },
  { id: 'ticketing', name: 'Ticketing', note: '', comingLater: true },
]
const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 'professional',
  name: 'Professional',
  blurb: '',
  tenantCount: 3,
  trialDays: 30,
  modules: { directory: true, reports: true, integrations: false, ticketing: false },
  version: 4,
  ...over,
})

describe('parseTrialDays', () => {
  it.each([['0', 0], ['30', 30], ['90', 90], [' 21 ', 21], ['007', 7]])('reads %j as %d', (text, days) => {
    expect(parseTrialDays(text)).toBe(days)
  })

  it.each(['', ' ', '-1', '91', '100', '1.5', '1e1', 'abc', '30 days', '9999'])('rejects %j', (text) => {
    expect(parseTrialDays(text)).toBeNull()
  })

  it('has the demo-style message', () => {
    expect(TRIAL_MESSAGE).toBe('Enter a number from 0 to 90.')
    expect(trialError({ modules: {}, trialDays: '' })).toBe(TRIAL_MESSAGE)
    expect(trialError({ modules: {}, trialDays: '45' })).toBeUndefined()
  })
})

describe('isChanged', () => {
  it('is false for what the server has', () => {
    expect(isChanged(plan(), savedDraft(plan()), catalog)).toBe(false)
  })

  it('is true when a module is switched either way', () => {
    const p = plan()
    expect(isChanged(p, { ...savedDraft(p), modules: { ...p.modules, integrations: true } }, catalog)).toBe(true)
    expect(isChanged(p, { ...savedDraft(p), modules: { ...p.modules, reports: false } }, catalog)).toBe(true)
  })

  it('is true when the trial length differs, and false when it only looks different', () => {
    const p = plan()
    expect(isChanged(p, { ...savedDraft(p), trialDays: '21' }, catalog)).toBe(true)
    expect(isChanged(p, { ...savedDraft(p), trialDays: '030' }, catalog)).toBe(false)
    expect(isChanged(p, { ...savedDraft(p), trialDays: ' 30 ' }, catalog)).toBe(false)
  })

  it('counts an unreadable trial length as a change, so it can be seen and fixed', () => {
    const p = plan()
    expect(isChanged(p, { ...savedDraft(p), trialDays: '' }, catalog)).toBe(true)
    expect(isChanged(p, { ...savedDraft(p), trialDays: 'abc' }, catalog)).toBe(true)
  })
})

describe('switchedOff', () => {
  it('lists the modules that are on now and off in the draft, in catalog order', () => {
    const p = plan()
    const draft = { ...savedDraft(p), modules: { ...p.modules, directory: false, reports: false } }
    expect(switchedOff(p, draft, catalog).map((m) => m.id)).toEqual(['directory', 'reports'])
  })

  it('ignores modules switched on, and modules that were already off', () => {
    const p = plan()
    const draft = { ...savedDraft(p), modules: { ...p.modules, integrations: true } }
    expect(switchedOff(p, draft, catalog)).toEqual([])
  })

  it('is empty for an untouched draft', () => {
    expect(switchedOff(plan(), savedDraft(plan()), catalog)).toEqual([])
  })
})

describe('offSummaries', () => {
  const professional = plan()
  const enterprise = plan({ id: 'enterprise', name: 'Enterprise', tenantCount: 2, modules: { ...professional.modules, integrations: true } })
  const empty = plan({ id: 'essentials', name: 'Essentials', tenantCount: 0 })

  it('names the plan, the tenant count and the modules for each plan that needs a confirmation', () => {
    const drafts = {
      professional: { ...savedDraft(professional), modules: { ...professional.modules, reports: false } },
      enterprise: { ...savedDraft(enterprise), modules: { ...enterprise.modules, integrations: false, directory: false } },
    }
    const result = offSummaries([professional, enterprise], drafts, catalog)
    expect(result.map((r) => [r.plan.id, r.plan.tenantCount, r.modules.map((m) => m.id)])).toEqual([
      ['professional', 3, ['reports']],
      ['enterprise', 2, ['directory', 'integrations']],
    ])
  })

  it('needs no confirmation for switching a module on', () => {
    const drafts = { professional: { ...savedDraft(professional), modules: { ...professional.modules, integrations: true } } }
    expect(offSummaries([professional], drafts, catalog)).toEqual([])
  })

  it('needs no confirmation for a plan with no tenants', () => {
    const drafts = { essentials: { ...savedDraft(empty), modules: { ...empty.modules, directory: false } } }
    expect(offSummaries([empty], drafts, catalog)).toEqual([])
  })

  it('needs no confirmation for a trial length change alone', () => {
    const drafts = { professional: { ...savedDraft(professional), trialDays: '10' } }
    expect(offSummaries([professional], drafts, catalog)).toEqual([])
  })

  it('skips plans without a draft', () => {
    expect(offSummaries([professional], {}, catalog)).toEqual([])
  })
})

describe('toUpdate', () => {
  it('builds the PUT body with the version the edit started from', () => {
    const p = plan()
    const draft = { modules: { ...p.modules, integrations: true }, trialDays: ' 21 ' }
    expect(toUpdate(p, draft)).toEqual({ modules: { ...p.modules, integrations: true }, trialDays: 21, version: 4 })
  })

  it('does not share the draft object with the request', () => {
    const p = plan()
    const draft = savedDraft(p)
    const body = toUpdate(p, draft)
    body.modules.directory = false
    expect(draft.modules.directory).toBe(true)
  })
})
