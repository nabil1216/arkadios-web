import type { ReactNode } from 'react'
import type { Area } from '../permissions'
import { usePermission } from '../hooks/usePermissions'

interface CanProps {
  area: Area
  /** `manage` (default) shows children only to roles that can change the area. */
  level?: 'view' | 'manage'
  fallback?: ReactNode
  children: ReactNode
}

export function Can({ area, level = 'manage', fallback = null, children }: CanProps) {
  const perm = usePermission(area)
  const allowed = level === 'manage' ? perm.canManage : perm.canView
  return <>{allowed ? children : fallback}</>
}
