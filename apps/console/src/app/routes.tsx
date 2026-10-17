import type { ComponentType } from 'react'
import { Navigate, type RouteObject } from 'react-router'
import { PageSpinner } from '@/components/PageSpinner'
import { HomeRedirect } from '@/features/auth/components/HomeRedirect'
import { RequireArea } from '@/features/auth/components/RequireArea'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import LoginPage from '@/features/auth/pages/LoginPage'
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage'
import { AppShell } from './layout/AppShell'


const page = (load: () => Promise<{ default: ComponentType }>) => ({
  lazy: async () => ({ Component: (await load()).default }),
})

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  // The stand-in tenant workspace the support handoff opens, in development only. `import.meta.env.DEV` is a build-time
  // constant, so a production build drops the import; scripts/check-bundle.mjs fails the build if it leaks.
  ...(import.meta.env.DEV
    ? [{ path: '/mock-workspace/support-handoff', HydrateFallback: PageSpinner, lazy: async () => (await import('@/mocks/workspace/route')).load() }]
    : []),
  {
    element: <RequireAuth />,
    // Shown while lazy page modules load on the first render.
    HydrateFallback: PageSpinner,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: 'overview', ...page(() => import('@/features/overview/pages/OverviewPage')) },
          {
            element: <RequireArea area="tenants" />,
            children: [{ path: 'tenants', ...page(() => import('@/features/tenants/pages/TenantsPage')) }],
          },
          {
            element: <RequireArea area="plans" />,
            children: [{ path: 'plans', ...page(() => import('@/features/plans/pages/PlansPage')) }],
          },
          {
            element: <RequireArea area="billing" />,
            children: [{ path: 'billing', ...page(() => import('@/features/billing/pages/BillingPage')) }],
          },
          {
            element: <RequireArea area="transactions" />,
            children: [{ path: 'transactions', ...page(() => import('@/features/transactions/pages/TransactionsPage')) }],
          },
          {
            element: <RequireArea area="sms" />,
            children: [{ path: 'sms', ...page(() => import('@/features/sms/pages/SmsPage')) }],
          },
          {
            element: <RequireArea area="support" />,
            children: [{ path: 'support', ...page(() => import('@/features/support/pages/SupportPage')) }],
          },
          {
            element: <RequireArea area="access" />,
            children: [{ path: 'access', ...page(() => import('@/features/access/pages/AccessPage')) }],
          },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
]
