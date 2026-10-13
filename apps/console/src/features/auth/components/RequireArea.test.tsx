import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api'
import { makeSession, renderRoutes } from '@/test/render'
import { fetchPermissions } from '../api/permissions'
import type { PermissionMatrix } from '../api/types'
import { sessionStore } from '../hooks/session'
import { RequireArea } from './RequireArea'

vi.mock('../api/permissions', () => ({
  permissionsKey: ['auth', 'permissions'],
  fetchPermissions: vi.fn(),
}))

// Made up for the test; the real matrix comes from GET /api/permissions.
const matrix = {
  tenants: { admin: 'manage', support: 'view', billing: 'view', auditor: 'view' },
  sms: { admin: 'manage', support: 'manage', billing: 'none', auditor: 'none' },
  plans: { admin: 'manage', support: 'view', billing: 'view', auditor: 'view' },
  billing: { admin: 'manage', support: 'view', billing: 'manage', auditor: 'view' },
  transactions: { admin: 'manage', support: 'none', billing: 'manage', auditor: 'view' },
  support: { admin: 'manage', support: 'manage', billing: 'none', auditor: 'view' },
  access: { admin: 'manage', support: 'none', billing: 'none', auditor: 'view' },
} satisfies PermissionMatrix

const routes = [
  {
    element: <RequireArea area="transactions" />,
    children: [{ path: '/transactions', element: <p>Transactions page</p> }],
  },
]

describe('RequireArea', () => {
  beforeEach(() => {
    vi.mocked(fetchPermissions).mockReset()
    sessionStore.reset()
  })

  it('shows a loading state while permissions load', () => {
    sessionStore.setSession(makeSession('billing'))
    vi.mocked(fetchPermissions).mockReturnValue(new Promise(() => {}))
    renderRoutes(routes, '/transactions')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Transactions page')).not.toBeInTheDocument()
  })

  it('renders the page when the role can view the area', async () => {
    sessionStore.setSession(makeSession('billing'))
    vi.mocked(fetchPermissions).mockResolvedValue(matrix)
    renderRoutes(routes, '/transactions')
    expect(await screen.findByText('Transactions page')).toBeInTheDocument()
  })

  it('shows No access, with a link home, when the role has no level', async () => {
    sessionStore.setSession(makeSession('support'))
    vi.mocked(fetchPermissions).mockResolvedValue(matrix)
    renderRoutes(routes, '/transactions')
    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
    expect(screen.getByText(/does not include Transactions/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/tenants')
    expect(screen.queryByText('Transactions page')).not.toBeInTheDocument()
  })

  it('does not link home to an unsafe server path', async () => {
    const session = makeSession('support')
    sessionStore.setSession({ ...session, user: { ...session.user, home: 'https://evil.example/' } })
    vi.mocked(fetchPermissions).mockResolvedValue(matrix)
    renderRoutes(routes, '/transactions')
    expect(await screen.findByRole('link', { name: 'Go to your home page' })).toHaveAttribute('href', '/overview')
  })

  it('shows an error with retry when permissions fail to load', async () => {
    sessionStore.setSession(makeSession('billing'))
    vi.mocked(fetchPermissions).mockRejectedValue(new ApiError(500, 'boom'))
    renderRoutes(routes, '/transactions')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByText('Transactions page')).not.toBeInTheDocument()
  })
})
