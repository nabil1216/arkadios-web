import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { Meter } from '@/components/Meter'
import { StatusBadge } from '@/components/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Can } from '@/features/auth/components/Can'
import { SignInAsButton } from '@/features/support/components/SignInAsButton'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Tenant, TenantSortKey } from '../api/types'
import { ariaSort, nextSort, parseSort } from '../hooks/listParams'
import { COMING_LATER, COMING_LATER_ID } from './pendingAction'

// Sorting, filtering and paging all happen on the server; the table only holds the state and the markup.
const features = tableFeatures({ rowSortingFeature, rowPaginationFeature })
const helper = createColumnHelper<typeof features, Tenant>()

// Teal ghost buttons from the demo (.btn--ghost .btn--small). Manage does nothing yet: the manage drawer
// is a later step, so they stay focusable but aria-disabled, with a hint.
const ROW_BUTTON =
  'inline-flex min-h-[30px] cursor-not-allowed items-center rounded-md px-2 text-[13px] font-medium whitespace-nowrap text-teal-ink'

function PendingRowButton({ label, tenantName, children }: { label: string; tenantName: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-describedby={COMING_LATER_ID}
      title={COMING_LATER}
      onClick={(e) => e.preventDefault()}
      className={ROW_BUTTON}
      data-action={label}
    >
      {children}
      {/* A text node carries the space: one inside the hidden span is dropped from the accessible name. */}
      {' '}
      <span className="sr-only">{tenantName}</span>
    </button>
  )
}

function RowActions({ tenant }: { tenant: Tenant }) {
  return (
    <div className="flex justify-end gap-1">
      <PendingRowButton label="manage" tenantName={tenant.name}>
        <Can permission="tenants.manage" fallback="View">
          Manage
        </Can>
      </PendingRowButton>
      {/* As in the demo, only roles that can run support sessions get Sign in as. */}
      <Can permission="support.manage">
        <SignInAsButton tenant={tenant} />
      </Can>
    </div>
  )
}

const columns = helper.columns([
  helper.accessor('name', {
    id: 'name',
    header: 'Tenant',
    cell: ({ row }) => (
      <>
        <strong>{row.original.name}</strong>
        <span className="block text-[12.5px] font-normal text-ink-2">Created {formatDate(row.original.createdAt)}</span>
      </>
    ),
  }),
  helper.accessor('domain', {
    header: 'Domain',
    enableSorting: false,
    cell: ({ row }) => <span className="font-mono text-[12px] whitespace-nowrap">{row.original.domain}</span>,
  }),
  helper.accessor('database', {
    header: 'Database',
    enableSorting: false,
    cell: ({ row }) => <span className="font-mono text-[12px] whitespace-nowrap">{row.original.database}</span>,
  }),
  helper.accessor('planName', { id: 'plan', header: 'Plan' }),
  helper.accessor('usersUsed', {
    id: 'usersUsed',
    header: 'Users',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        <span className="num">
          {row.original.usersUsed} of {row.original.userLimit}
        </span>{' '}
        <Meter value={row.original.usersUsed} max={row.original.userLimit} />
      </span>
    ),
  }),
  helper.accessor('status', {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge kind={row.original.status} />,
  }),
  helper.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    enableSorting: false,
    cell: ({ row }) => <RowActions tenant={row.original} />,
  }),
])

const CELL = 'px-2.5 py-3 align-middle'
const emptyRows: Tenant[] = []

interface TenantsTableProps {
  items: Tenant[] | undefined
  total: number
  page: number
  pageSize: number
  sort: string
  onSort: (sort: string) => void
  /** True while a refetch keeps the previous rows on screen. */
  busy: boolean
  /** Shown instead of rows when there are none. */
  emptyMessage: string
}

export function TenantsTable({ items, total, page, pageSize, sort, onSort, busy, emptyMessage }: TenantsTableProps) {
  const parsed = parseSort(sort)
  const sorting: SortingState = parsed ? [{ id: parsed.key, desc: parsed.descending }] : []
  const pagination: PaginationState = { pageIndex: page - 1, pageSize }

  const table = useTable({
    features,
    columns,
    data: items ?? emptyRows,
    rowCount: total,
    manualSorting: true,
    manualPagination: true,
    state: { sorting, pagination },
    // Clicks go through nextSort() and the address bar, which then feeds state back in.
    onSortingChange: () => {},
    onPaginationChange: () => {},
  })

  const rows = table.getRowModel().rows

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-paper" aria-busy={busy || !items}>
      <Table className={cn('text-[13.5px]', busy && 'opacity-60 transition-opacity')}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const key = header.column.id as TenantSortKey
                const sortable = header.column.getCanSort()
                const direction = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    scope="col"
                    aria-sort={sortable ? ariaSort(sort, key) : undefined}
                    className={cn(CELL, 'h-auto border-b border-line bg-[#f8fafb] font-semibold whitespace-nowrap text-ink-2')}
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(nextSort(sort, key))}
                        className="-mx-1 inline-flex cursor-pointer items-center gap-1 rounded-sm border-0 bg-transparent px-1 font-semibold text-inherit hover:text-ink"
                      >
                        <table.FlexRender header={header} />
                        {direction === 'asc' ? (
                          <ArrowUp size={14} aria-hidden="true" />
                        ) : direction === 'desc' ? (
                          <ArrowDown size={14} aria-hidden="true" />
                        ) : (
                          <ChevronsUpDown size={14} aria-hidden="true" className="opacity-50" />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody id="t-body">
          {!items ? (
            Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i} data-testid="tenant-skeleton">
                {columns.map((_, c) => (
                  <TableCell key={c} className={CELL}>
                    <Skeleton className="h-4 w-full max-w-[140px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="px-3.5 py-8 text-center text-ink-2">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} data-id={row.original.id} className="hover:bg-transparent">
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className={cn(CELL, cell.column.id === 'name' && 'min-w-[150px] whitespace-normal')}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

