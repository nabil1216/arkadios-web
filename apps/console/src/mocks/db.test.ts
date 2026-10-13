import { describe, expect, it } from 'vitest'
import type { Area, Level, Role } from '@/features/auth/api/types'
import { levelOf } from '@/features/auth/hooks/permissions'
import { permissions } from './db'

// The demo's s.perms (platform.js seed), as [admin, support, billing, auditor].
const demo: Record<Area, Level[]> = {
  tenants: ['manage', 'view', 'view', 'view'],
  plans: ['manage', 'view', 'view', 'view'],
  billing: ['manage', 'view', 'manage', 'view'],
  transactions: ['manage', 'none', 'manage', 'view'],
  sms: ['manage', 'manage', 'none', 'none'],
  support: ['manage', 'manage', 'none', 'view'],
  access: ['manage', 'none', 'none', 'view'],
}
const roles: Role[] = ['admin', 'support', 'billing', 'auditor']

describe('mock permission keys', () => {
  it.each(Object.entries(demo) as [Area, Level[]][])('match the demo for %s', (area, levels) => {
    roles.forEach((role, i) => expect(levelOf(permissions, role, area)).toBe(levels[i]))
  })
})
