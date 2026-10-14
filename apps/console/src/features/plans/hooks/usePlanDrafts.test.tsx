import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Plan, PlanModule } from '../api/types'
import { usePlanDrafts } from './usePlanDrafts'

const catalog: PlanModule[] = [
  { id: 'directory', name: 'Directory', note: '', comingLater: false },
  { id: 'reports', name: 'Reports', note: '', comingLater: false },
]
const make = (id: string, over: Partial<Plan> = {}): Plan => ({
  id,
  name: id,
  blurb: '',
  tenantCount: 1,
  trialDays: 30,
  modules: { directory: true, reports: false },
  version: 1,
  ...over,
})

function setup(initial: Plan[]) {
  return renderHook(({ plans }) => usePlanDrafts(plans, catalog), { initialProps: { plans: initial } })
}

describe('usePlanDrafts', () => {
  it('starts with what the server has, and nothing changed', () => {
    const { result } = setup([make('a'), make('b')])
    expect(result.current.drafts.a).toEqual({ modules: { directory: true, reports: false }, trialDays: '30' })
    expect(result.current.dirty).toBe(false)
    expect(result.current.changedIds).toEqual([])
  })

  it('tracks a module switch and marks only that plan changed', () => {
    const { result } = setup([make('a'), make('b')])
    act(() => result.current.setModule('a', 'reports', true))
    expect(result.current.drafts.a.modules.reports).toBe(true)
    expect(result.current.drafts.b.modules.reports).toBe(false)
    expect(result.current.changedIds).toEqual(['a'])
    expect(result.current.dirty).toBe(true)
  })

  it('tracks the trial length as text', () => {
    const { result } = setup([make('a')])
    act(() => result.current.setTrialDays('a', '2'))
    expect(result.current.drafts.a.trialDays).toBe('2')
    expect(result.current.dirty).toBe(true)
    act(() => result.current.setTrialDays('a', '30'))
    expect(result.current.dirty).toBe(false)
  })

  it('is clean again when a switch is put back', () => {
    const { result } = setup([make('a')])
    act(() => result.current.setModule('a', 'reports', true))
    act(() => result.current.setModule('a', 'reports', false))
    expect(result.current.dirty).toBe(false)
  })

  it('keeps edits to different modules of the same plan', () => {
    const { result } = setup([make('a')])
    act(() => result.current.setModule('a', 'reports', true))
    act(() => result.current.setModule('a', 'directory', false))
    expect(result.current.drafts.a.modules).toEqual({ directory: false, reports: true })
  })

  it('discards everything, or only the plans named', () => {
    const { result } = setup([make('a'), make('b')])
    act(() => result.current.setModule('a', 'reports', true))
    act(() => result.current.setModule('b', 'reports', true))
    act(() => result.current.discard(['a']))
    expect(result.current.changedIds).toEqual(['b'])
    act(() => result.current.discard())
    expect(result.current.dirty).toBe(false)
  })

  it('drops an edit when the server version moves on, and keeps the others', () => {
    const { result, rerender } = setup([make('a'), make('b')])
    act(() => result.current.setModule('a', 'reports', true))
    act(() => result.current.setModule('b', 'reports', true))
    // someone saved plan a: new version, new content
    rerender({ plans: [make('a', { version: 2, trialDays: 14 }), make('b')] })
    expect(result.current.drafts.a).toEqual({ modules: { directory: true, reports: false }, trialDays: '14' })
    expect(result.current.drafts.b.modules.reports).toBe(true)
    expect(result.current.changedIds).toEqual(['b'])
  })

  it('starts the next edit from the new version', () => {
    const { result, rerender } = setup([make('a')])
    act(() => result.current.setModule('a', 'reports', true))
    rerender({ plans: [make('a', { version: 2, modules: { directory: true, reports: true } })] })
    expect(result.current.dirty).toBe(false)
    act(() => result.current.setModule('a', 'directory', false))
    expect(result.current.drafts.a.modules).toEqual({ directory: false, reports: true })
  })

  it('ignores an edit for a plan it does not have', () => {
    const { result } = setup([make('a')])
    act(() => result.current.setModule('zzz', 'reports', true))
    expect(result.current.dirty).toBe(false)
  })
})
