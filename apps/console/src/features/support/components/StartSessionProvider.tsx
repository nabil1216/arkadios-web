import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { activeSessionKey, fetchActiveSession } from '../api/support'
import type { SupportSession } from '../api/types'
import { ActiveSessionDialog } from './ActiveSessionDialog'
import { StartSessionDialog } from './StartSessionDialog'
import { StartSessionContext, type StartSession } from './startSessionContext'

type Ui = { kind: 'closed' } | { kind: 'start'; tenantId?: string } | { kind: 'active'; tenantId?: string; session: SupportSession }

/** Owns the Start dialog and the "already open" dialog, so the page and every tenant row share one of each. */
export function StartSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [ui, setUi] = useState<Ui>({ kind: 'closed' })
  const returnFocus = useRef<HTMLElement | null>(null)

  const value = useMemo<StartSession>(
    () => ({
      async open(tenantId) {
        returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        // Ask the server now rather than trust what was read earlier: a session may have ended, or one may have been opened elsewhere.
        const open = await queryClient.fetchQuery({ queryKey: activeSessionKey, queryFn: fetchActiveSession, staleTime: 0 }).catch(() => null)
        setUi(open ? { kind: 'active', tenantId, session: open } : { kind: 'start', tenantId })
      },
    }),
    [queryClient],
  )

  return (
    <StartSessionContext.Provider value={value}>
      {children}
      <StartSessionDialog
        open={ui.kind === 'start'}
        onOpenChange={(open) => !open && setUi({ kind: 'closed' })}
        defaultTenantId={ui.kind === 'start' ? ui.tenantId : undefined}
        returnFocusTo={returnFocus}
      />
      <ActiveSessionDialog
        session={ui.kind === 'active' ? ui.session : null}
        onClose={() => setUi({ kind: 'closed' })}
        onEnded={() => setUi({ kind: 'start', tenantId: ui.kind === 'active' ? ui.tenantId : undefined })}
      />
    </StartSessionContext.Provider>
  )
}
