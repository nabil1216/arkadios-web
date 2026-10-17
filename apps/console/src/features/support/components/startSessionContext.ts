import { createContext, useContext } from 'react'

export interface StartSession {
  /** Opens "Start a support session", for a tenant if given. If you already have one open it asks to end that first. */
  open: (tenantId?: string) => Promise<void>
}

export const StartSessionContext = createContext<StartSession | null>(null)

export function useStartSession(): StartSession {
  const value = useContext(StartSessionContext)
  if (!value) throw new Error('useStartSession needs a StartSessionProvider')
  return value
}
