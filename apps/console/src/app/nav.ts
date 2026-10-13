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
import type { Area } from '@/features/auth/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** null: every signed-in staff member sees it. */
  area: Area | null
}

// Order and labels follow docs/handoff/platform-console (NAV in platform.js).
export const NAV: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: LayoutGrid, area: null },
  { to: '/tenants', label: 'Tenants', icon: Building2, area: 'tenants' },
  { to: '/plans', label: 'Plans and modules', icon: Layers, area: 'plans' },
  { to: '/billing', label: 'Billing', icon: Receipt, area: 'billing' },
  { to: '/transactions', label: 'Transactions', icon: CreditCard, area: 'transactions' },
  { to: '/sms', label: 'SMS', icon: MessageSquare, area: 'sms' },
  { to: '/support', label: 'Support access', icon: Headset, area: 'support' },
  { to: '/access', label: 'Access control', icon: Lock, area: 'access' },
]
