import { handoffLoader } from './loader'
import { SupportHandoffPage } from './SupportHandoffPage'

/** The stand-in workspace route. The console adds it in development only; the build guard fails if it reaches dist. */
export const STAND_IN_PATH = '/mock-workspace/support-handoff'

export function load() {
  return { Component: SupportHandoffPage, loader: handoffLoader }
}
