import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useLatestSearchParams } from './useLatestSearchParams'

/** Renders the hook inside a router and gives back the router, to read the address from. */
function setup(initial = '/list') {
  let hook!: ReturnType<typeof useLatestSearchParams>
  function Probe(): ReactNode {
    hook = useLatestSearchParams()
    useLocation()
    return null
  }
  const router = createMemoryRouter([{ path: '/list', element: <Probe /> }], { initialEntries: [initial] })
  const { rerender } = renderHook(() => null, { wrapper: () => <RouterProvider router={router} /> })
  return { router, rerender, hook: () => hook }
}
const query = (router: { state: { location: { search: string } } }) => Object.fromEntries(new URLSearchParams(router.state.location.search))

describe('useLatestSearchParams', () => {
  it('reads the address', () => {
    const { hook } = setup('/list?status=active&page=2')
    expect(Object.fromEntries(hook().searchParams)).toEqual({ status: 'active', page: '2' })
  })

  it('changes the address from what it is now', () => {
    const { hook, router } = setup('/list?status=active')
    act(() => hook().commit((latest) => (latest.set('q', 'o'), latest)))
    expect(query(router)).toEqual({ status: 'active', q: 'o' })
  })

  it('lets a handler from an earlier render change one value without undoing another changed since', () => {
    const { hook, router } = setup('/list')
    const fromTheFirstRender = hook().commit // what a search that waited keeps hold of
    act(() => hook().commit((latest) => (latest.set('status', 'suspended'), latest)))
    act(() => fromTheFirstRender((latest) => (latest.set('q', 'o'), latest)))
    expect(query(router)).toEqual({ status: 'suspended', q: 'o' })
  })

  it('starts from a change that was asked for and has not rendered yet', () => {
    const { hook, router } = setup('/list')
    act(() => {
      hook().commit((latest) => (latest.set('status', 'suspended'), latest))
      hook().commit((latest) => (latest.set('q', 'o'), latest)) // the first has not been rendered
    })
    expect(query(router)).toEqual({ status: 'suspended', q: 'o' })
  })

  it('follows the address when it changes on its own (the back button)', async () => {
    const { hook, router } = setup('/list?status=active')
    await act(async () => void (await router.navigate('/list?status=trial')))
    act(() => hook().commit((latest) => (latest.set('q', 'x'), latest)))
    expect(query(router)).toEqual({ status: 'trial', q: 'x' })
  })

  it('passes the navigation options on, so typing can replace instead of push', () => {
    const { hook, router } = setup('/list')
    act(() => hook().commit((latest) => (latest.set('q', 'a'), latest), { replace: true }))
    expect(router.state.historyAction).toBe('REPLACE')
    act(() => hook().commit((latest) => (latest.set('status', 'active'), latest)))
    expect(router.state.historyAction).toBe('PUSH')
  })
})
