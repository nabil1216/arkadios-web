// The mocked PlatformAuditLog (mother DB): who did what, with old and new values, for every change made through the
// platform API (docs/ARCHITECTURE.md, section 8b). Shared by the access control and support session mocks.

export interface AuditChange {
  field: string
  old: unknown
  new: unknown
}

/** One entry. The display name is a copy, so history still reads after the person or tenant is gone. */
export interface AuditEntry {
  id: string
  occurredAt: string
  actorId: string
  actorName: string
  action: string
  entityType: 'StaffUser' | 'Role' | 'SupportSession'
  entityId: string
  entityName: string
  changes: AuditChange[]
  /** Extra context that is not a before and after, for example the tenant of a support session. */
  details?: Record<string, unknown>
  isSecurity: true
}

export interface Actor {
  id: string
  name: string
}

let entries: AuditEntry[] = []

export const platformAuditLog = (): readonly AuditEntry[] => entries

export function writeAudit(
  actor: Actor,
  action: string,
  entityType: AuditEntry['entityType'],
  entityId: string,
  entityName: string,
  changes: AuditChange[],
  details?: Record<string, unknown>,
) {
  entries.push({
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType,
    entityId,
    entityName,
    changes,
    ...(details ? { details } : {}),
    isSecurity: true,
  })
}

/** An empty audit log (tests). */
export function resetAudit() {
  entries = []
}
