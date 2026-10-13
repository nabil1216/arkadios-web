import { useEffect, useMemo } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { restoreSession } from '@/features/auth/api/auth'
import { routes } from './routes'

export function App() {
  const router = useMemo(() => createBrowserRouter(routes), [])

  // A reload loses the in-memory session; the httpOnly refresh cookie brings it back.
  useEffect(() => {
    void restoreSession()
  }, [])

  return (
    <RouterProvider router={router} />
  )
}
