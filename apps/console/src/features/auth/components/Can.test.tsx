import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeSession, renderRoutes } from '@/test/render'
import { fetchPermissions } from '../api/permissions'
import type { PermissionMap } from '../api/types'
import { sessionStore } from '../hooks/session'
import { Can } from './Can'

vi.mock('../api/permissions', () => ({
  permissionsKey: ['auth', 'permissions'],
  fetchPermissions: vi.fn(),
}))

const map: PermissionMap = {
  admin: ['tenants.manage'],
  support: ['tenants.view'],
  billing: [],
  auditor: [],
}

function page(permission: 'tenants.view' | 'tenants.manage') {
  return [
    {
      path: '/',
      element: (
        <Can permission={permission} fallback={<p>Hidden</p>}>
          <button type="button">Create tenant</button>
        </Can>
      ),
    },
  ]
}

describe('Can', () => {
  beforeEach(() => {
    sessionStore.reset()
    vi.mocked(fetchPermissions).mockReset().mockResolvedValue(map)
  })

  it('shows children when the role holds the key', async () => {
    sessionStore.setSession(makeSession('admin'))
    renderRoutes(page('tenants.manage'), '/')
    expect(await screen.findByRole('button', { name: 'Create tenant' })).toBeInTheDocument()
  })

  it('shows children for view when the role only has manage', async () => {
    sessionStore.setSession(makeSession('admin'))
    renderRoutes(page('tenants.view'), '/')
    expect(await screen.findByRole('button', { name: 'Create tenant' })).toBeInTheDocument()
  })

  it('shows the fallback when the role only has view', async () => {
    sessionStore.setSession(makeSession('support'))
    renderRoutes(page('tenants.manage'), '/')
    expect(await screen.findByText('Hidden')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create tenant' })).not.toBeInTheDocument()
  })

  it('shows the fallback while permissions are loading', () => {
    sessionStore.setSession(makeSession('admin'))
    vi.mocked(fetchPermissions).mockReturnValue(new Promise(() => {}))
    renderRoutes(page('tenants.view'), '/')
    expect(screen.getByText('Hidden')).toBeInTheDocument()
  })
})
