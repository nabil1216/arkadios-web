import {
  Building2,
  CreditCard,
  Headset,
  Layers,
  LayoutGrid,
  Lock,
  MessageSquare,
  Receipt,
  type LucideIcon,
} from 'lucide-react'
import type { PermissionKey } from '@/features/auth/api/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Key needed to see the item; null: every signed-in staff member sees it. */
  permission: PermissionKey | null
}

// Order and labels follow docs/handoff/platform-console (NAV in platform.js).
export const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: LayoutGrid, permission: null },
  { to: '/tenants', label: 'Tenants', icon: Building2, permission: 'tenants.view' },
  { to: '/plans', label: 'Plans and modules', icon: Layers, permission: 'plans.view' },
  { to: '/billing', label: 'Billing', icon: Receipt, permission: 'billing.view' },
  { to: '/transactions', label: 'Transactions', icon: CreditCard, permission: 'transactions.view' },
  { to: '/sms', label: 'SMS', icon: MessageSquare, permission: 'sms.view' },
  { to: '/support', label: 'Support access', icon: Headset, permission: 'support.view' },
  { to: '/access', label: 'Access control', icon: Lock, permission: 'access.view' },
]
