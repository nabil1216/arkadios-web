import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeSession, renderRoutes } from '@/test/render'
import { sessionStore } from '../hooks/session'
import LoginPage from './LoginPage'

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/tenants', element: <p>Tenants page</p> },
  { path: '/overview', element: <p>Overview page</p> },
  { path: '/billing', element: <p>Billing page</p> },
]

function signedIn(home: string) {
  const session = makeSession('support')
  sessionStore.setSession({ ...session, user: { ...session.user, home } })
}

describe('LoginPage redirects when already signed in', () => {
  beforeEach(() => sessionStore.reset())

  it('goes to a safe next', () => {
    signedIn('/tenants')
    renderRoutes(routes, '/login?next=%2Fbilling')
    expect(screen.getByText('Billing page')).toBeInTheDocument()
  })

  it('ignores an absolute next and uses the home page', () => {
    signedIn('/tenants')
    const { router } = renderRoutes(routes, `/login?next=${encodeURIComponent('https://evil.example/')}`)
    expect(router.state.location.pathname).toBe('/tenants')
  })

  it('ignores an unsafe server home and lands on the overview', () => {
    signedIn('https://evil.example/')
    const { router } = renderRoutes(routes, '/login')
    expect(router.state.location.pathname).toBe('/overview')
  })
})
