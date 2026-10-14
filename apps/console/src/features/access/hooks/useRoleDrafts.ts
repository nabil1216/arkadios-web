import { useState } from 'react'
import type { Area, Level } from '@/features/auth/api/types'
import type { RoleInfo } from '../api/types'
import { roleChanges, savedRoleDraft, type RoleChange, type RoleDraft } from './roleDraft'

interface Edit extends RoleDraft {
  /** The role version the edit started from. */
  version: number
}
type Edits = Record<string, Edit>

/**
 * The edits on the role matrix, one per role. An edit belongs to the version it started from: when the
 * server's version moves on (a save, or someone else's change) the edit stops applying, so the page never
 * shows a draft on top of a role it was not made from.
 */
export function useRoleDrafts(roles: RoleInfo[]) {
  const [edits, setEdits] = useState<Edits>({})

  const drafts: Record<string, RoleDraft> = {}
  for (const role of roles) {
    const edit = edits[role.id]
    drafts[role.id] = edit && edit.version === role.version ? edit : savedRoleDraft(role)
  }
  const changes: RoleChange[] = roleChanges(roles, drafts)

  return {
    drafts,
    changes,
    dirty: changes.length > 0,
    setLevel(roleId: string, area: Area, level: Level) {
      const role = roles.find((r) => r.id === roleId)
      if (!role || role.locked) return
      setEdits((current) => ({ ...current, [roleId]: { ...drafts[roleId], [area]: level, version: role.version } }))
    },
    /** Drop the edits for these roles, or for all of them. */
    discard: (roleIds?: string[]) =>
      setEdits((current) => (roleIds ? Object.fromEntries(Object.entries(current).filter(([id]) => !roleIds.includes(id))) : {})),
  }
}
