import type { ReactNode } from 'react'
import type { PermissionKey } from '../api/types'
import { usePermission } from '../hooks/usePermission'

interface CanProps {
  permission: PermissionKey
  fallback?: ReactNode
  children: ReactNode
}

/** Renders children only when the signed-in role holds the key. */
export function Can({ permission, fallback = null, children }: CanProps) {
  const { allowed } = usePermission(permission)
  return <>{allowed ? children : fallback}</>
}
