import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPermissions } from '@/features/auth/api/permissions'
import type { Role } from '@/features/auth/api/types'
import { sessionStore } from '@/features/auth/hooks/session'
import { permissions } from '@/mocks/db'
import { makeSession, renderRoutes } from '@/test/render'
import { Sidebar } from './Sidebar'

vi.mock('@/features/auth/api/permissions', () => ({
  permissionsKey: ['auth', 'permissions'],
  fetchPermissions: vi.fn(),
}))

// Role menus from the demo (console_ptest3.py).
const menus: Record<Role, string[]> = {
  admin: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions', 'SMS', 'Support access', 'Access control'],
  support: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'SMS', 'Support access'],
  billing: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions'],
  auditor: ['Overview', 'Tenants', 'Plans and modules', 'Billing', 'Transactions', 'Support access', 'Access control'],
}

function renderSidebar(role: Role) {
  const session = makeSession(role)
  sessionStore.setSession(session)
  renderRoutes([{ path: '/', element: <Sidebar user={session.user} /> }], '/')
}

describe('Sidebar', () => {
  beforeEach(() => {
    sessionStore.reset()
    vi.mocked(fetchPermissions).mockReset().mockResolvedValue(permissions)
  })

  it.each(Object.keys(menus) as Role[])('shows the %s menu', async (role) => {
    renderSidebar(role)
    const nav = screen.getByRole('navigation', { name: 'Platform' })
    await within(nav).findByRole('link', { name: menus[role].at(-1)! })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(menus[role])
  })

  it('shows only the Overview until permissions arrive', () => {
    vi.mocked(fetchPermissions).mockReturnValue(new Promise(() => {}))
    renderSidebar('admin')
    expect(within(screen.getByRole('navigation', { name: 'Platform' })).getAllByRole('link')).toHaveLength(1)
  })
})
