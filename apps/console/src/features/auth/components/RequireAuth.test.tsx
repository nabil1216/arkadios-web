import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeSession, renderRoutes } from '@/test/render'
import { sessionStore } from '../hooks/session'
import { RequireAuth } from './RequireAuth'

const routes = [
  { path: '/login', element: <p>Login page</p> },
  { element: <RequireAuth />, children: [{ path: '/tenants', element: <p>Tenants page</p> }] },
]

describe('RequireAuth', () => {
  beforeEach(() => sessionStore.reset())

  it('shows a loading state while the session is being restored', () => {
    renderRoutes(routes, '/tenants')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Tenants page')).not.toBeInTheDocument()
  })

  it('renders the page for a signed-in user', () => {
    sessionStore.setSession(makeSession())
    renderRoutes(routes, '/tenants')
    expect(screen.getByText('Tenants page')).toBeInTheDocument()
  })

  it('sends a signed-out visitor to login and remembers the page', () => {
    sessionStore.setAnonymous()
    const { router } = renderRoutes(routes, '/tenants?status=trial')
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/tenants?status=trial')}`)
  })

  it('does not remember the page after an explicit sign-out', () => {
    sessionStore.setAnonymous('user')
    const { router } = renderRoutes(routes, '/tenants')
    expect(router.state.location.search).toBe('')
  })

  it('remembers the page after an idle sign-out', () => {
    sessionStore.setAnonymous('idle')
    const { router } = renderRoutes(routes, '/tenants')
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/tenants')}`)
  })
})
