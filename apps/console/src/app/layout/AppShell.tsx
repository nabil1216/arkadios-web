import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useIdleSignOut } from '@/features/auth/hooks/useIdleSignOut'
import { useSession } from '@/features/auth/hooks/session'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const session = useSession()
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const first = useRef(true)

  // Move focus to the page after navigating, as the demo does.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    mainRef.current?.focus()
  }, [pathname])

  useIdleSignOut(session.status === 'authenticated' ? session.idleMinutes : 30)

  if (session.status !== 'authenticated') return null

  return (
    <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] max-[860px]:grid-cols-[minmax(0,1fr)]">
      <a
        href="#main"
        className="absolute top-[-48px] left-2 z-[100] rounded-sm bg-paper px-3 py-2 focus:top-2"
      >
        Skip to main content
      </a>
      <Sidebar user={session.user} />
      <div className="flex min-w-0 flex-col">
        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="w-full max-w-[1280px] px-8 pt-7 pb-14 outline-none max-[860px]:px-4 max-[860px]:pt-5 max-[860px]:pb-12"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
