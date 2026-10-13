import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import type { SessionResponse } from '@/features/auth/api/types'

export function makeSession(role: SessionResponse['user']['role'] = 'support'): SessionResponse {
  return {
    accessToken: 'test-token',
    idleMinutes: 30,
    user: { id: 'u1', name: 'Omar Haddad', email: 'omar@platform.example', role, home: '/tenants' },
  }
}

export function renderRoutes(routes: RouteObject[], initialEntry: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, ...utils }
}
