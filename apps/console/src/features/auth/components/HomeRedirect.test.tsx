import { beforeEach, describe, expect, it } from 'vitest'
import { makeSession, renderRoutes } from '@/test/render'
import { sessionStore } from '../hooks/session'
import { HomeRedirect } from './HomeRedirect'

const routes = [
  { path: '/', element: <HomeRedirect /> },
  { path: '/billing', element: <p>Billing page</p> },
  { path: '/overview', element: <p>Overview page</p> },
]

function signedIn(home: string) {
  const session = makeSession('billing')
  sessionStore.setSession({ ...session, user: { ...session.user, home } })
}

describe('HomeRedirect', () => {
  beforeEach(() => sessionStore.reset())

  it('sends the user to their home page', () => {
    signedIn('/billing')
    const { router } = renderRoutes(routes, '/')
    expect(router.state.location.pathname).toBe('/billing')
  })

  it('sends the user to the overview when home is unsafe', () => {
    signedIn('//evil.example')
    const { router } = renderRoutes(routes, '/')
    expect(router.state.location.pathname).toBe('/overview')
  })
})
