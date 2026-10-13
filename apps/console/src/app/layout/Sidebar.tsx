import { NavLink } from 'react-router'
import { usePermissionMatrix } from '@/features/auth/hooks/usePermissions'
import { canView, ROLE_LABELS } from '@/features/auth/hooks/permissions'
import { signOut } from '@/features/auth/api/auth'
import { cn } from '@/lib/utils'
import { NAV } from '../nav'
import type { StaffUser } from '@/features/auth/api/types'

export function Sidebar({ user }: { user: StaffUser }) {
  const { permissions } = usePermissionMatrix()
  // Until the permissions arrive only the Overview (open to all staff) is shown.
  const items = NAV.filter((n) => n.area === null || canView(permissions, user.role, n.area))

  return (
    <aside
      aria-label="Platform console"
      className="sticky top-0 flex h-screen flex-col gap-[22px] bg-sidebar px-3.5 py-5 text-sidebar-foreground max-[860px]:static max-[860px]:h-auto max-[860px]:flex-row max-[860px]:items-center max-[860px]:gap-3 max-[860px]:overflow-x-auto max-[860px]:px-3 max-[860px]:py-2.5"
    >
      <div className="flex items-center gap-3 px-2 text-white">
        <span
          aria-hidden="true"
          className="grid size-9 place-items-center rounded-[9px] bg-teal font-display text-[21px] font-semibold"
        >
          P
        </span>
        <div className="leading-tight">
          <strong className="block font-semibold">Platform console</strong>
          <small className="text-graphite-text max-[860px]:hidden">Staff only</small>
        </div>
      </div>

      <nav aria-label="Platform" className="grid gap-0.5 max-[860px]:flex">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-2.5 py-[9px] font-medium whitespace-nowrap text-graphite-text no-underline hover:bg-graphite-2 hover:text-white focus-visible:shadow-[0_0_0_3px_var(--sidebar-ring)]',
                isActive &&
                  'bg-graphite-2 text-white shadow-[inset_3px_0_0_var(--teal)] max-[860px]:shadow-[inset_0_-3px_0_var(--teal)]',
              )
            }
          >
            <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto grid gap-2 px-2 text-[12.5px] text-graphite-muted max-[860px]:mt-0 max-[860px]:ml-auto max-[860px]:flex max-[860px]:items-center max-[860px]:gap-3.5">
        <div className="grid leading-snug text-white">
          <strong>{user.name}</strong>
          <span className="text-graphite-muted max-[860px]:hidden">{ROLE_LABELS[user.role]}</span>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="cursor-pointer border-0 bg-transparent p-0 text-left text-[12.5px] text-graphite-muted underline hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
