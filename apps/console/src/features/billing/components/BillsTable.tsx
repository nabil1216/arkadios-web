import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Eye } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Can } from '@/features/auth/components/Can'
import { formatDay, formatMonth, formatMonthLong } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { Bill, BillSortKey } from '../api/types'
import { ariaSort, nextSort, parseSort } from '../hooks/listParams'

// Sorting, filtering and paging all happen on the server; the table only holds the state and the markup.
const features = tableFeatures({ rowSortingFeature, rowPaginationFeature })
const helper = createColumnHelper<typeof features, Bill>()

const RIGHT = new Set(['billedUsers', 'unitPrice', 'subtotal', 'tax', 'payable'])

interface RowActions {
  onPreview: (bill: Bill) => void
  onExtend: (bill: Bill) => void
  onInvoice: (bill: Bill) => void
  /** The bill whose invoice is being fetched, if any. */
  invoicing: string | null
}

const iconButton =
  'inline-grid size-9 place-items-center rounded-md border-0 bg-transparent text-ink-2 hover:bg-gray-tint hover:text-ink disabled:cursor-wait disabled:opacity-50'

function Actions({ bill, actions }: { bill: Bill; actions: RowActions }) {
  const month = formatMonthLong(bill.month)
  return (
    <div className="flex items-center justify-end gap-1">
      {bill.status === 'paid' ? (
        <button
          type="button"
          className={iconButton}
          aria-label={`Download invoice for ${bill.tenantName}, ${month}`}
          disabled={actions.invoicing === bill.id}
          onClick={() => actions.onInvoice(bill)}
        >
          <Download size={18} strokeWidth={1.7} aria-hidden="true" />
        </button>
      ) : (
        <>
          <button
            type="button"
            className={iconButton}
            aria-label={`Preview the bill notice ${bill.tenantName} sees`}
            onClick={() => actions.onPreview(bill)}
          >
            <Eye size={18} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <Can permission="billing.manage">
            <Button variant="ghost" size="sm" onClick={() => actions.onExtend(bill)} className="px-2 text-teal-ink">
              Extend
              {/* A text node carries the space: one inside the hidden span is dropped from the accessible name. */}{' '}
              <span className="sr-only">deadline for {bill.tenantName}</span>
            </Button>
          </Can>
        </>
      )}
    </div>
  )
}

const columns = helper.columns([
  helper.accessor('tenantName', {
    id: 'tenant',
    header: 'Tenant',
    cell: ({ row }) => <strong>{row.original.tenantName}</strong>,
  }),
  helper.accessor('month', {
    id: 'month',
    header: 'Month',
    cell: ({ row }) => <span className="whitespace-nowrap">{formatMonth(row.original.month)}</span>,
  }),
  helper.accessor('planName', { id: 'plan', header: 'Plan', enableSorting: false, cell: ({ row }) => <span className="whitespace-nowrap">{row.original.planName}</span> }),
  helper.accessor('billedUsers', { id: 'billedUsers', header: 'Billed users', enableSorting: false, cell: ({ row }) => <span className="tabular-nums">{row.original.billedUsers}</span> }),
  helper.accessor((b) => b.unitPrice.amountMinor, { id: 'unitPrice', header: 'Unit price', enableSorting: false, cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.unitPrice)}</span> }),
  helper.accessor((b) => b.subtotal.amountMinor, { id: 'subtotal', header: 'Subtotal', enableSorting: false, cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.subtotal)}</span> }),
  helper.accessor((b) => b.tax.amountMinor, { id: 'tax', header: 'Tax', enableSorting: false, cell: ({ row }) => <span className="tabular-nums">{formatMoney(row.original.tax)}</span> }),
  helper.accessor((b) => b.payable.amountMinor, {
    id: 'payable',
    header: 'Payable',
    cell: ({ row }) => <strong className="tabular-nums">{formatMoney(row.original.payable)}</strong>,
  }),
  helper.accessor('deadline', {
    id: 'deadline',
    header: 'Deadline',
    // Shown in the viewer's local time; the full local date and time is in the tooltip.
    cell: ({ row }) => (
      <time dateTime={row.original.deadline} title={new Date(row.original.deadline).toLocaleString('en-US')} className="whitespace-nowrap">
        {formatDay(row.original.deadline)}
      </time>
    ),
  }),
  helper.accessor('status', { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge kind={row.original.status} /> }),
  helper.display({ id: 'actions', header: () => <span className="sr-only">Actions</span>, enableSorting: false }),
])

const CELL = 'px-2.5 py-3 align-middle'
const emptyRows: Bill[] = []

interface BillsTableProps extends RowActions {
  items: Bill[] | undefined
  total: number
  page: number
  pageSize: number
  sort: string
  onSort: (sort: string) => void
  /** True while a refetch keeps the previous rows on screen. */
  busy: boolean
  emptyMessage: string
  /** Mark the first overdue row (the Overview links here with #overdue). */
  highlightOverdue: boolean
}

export function BillsTable({ items, total, page, pageSize, sort, onSort, busy, emptyMessage, highlightOverdue, ...actions }: BillsTableProps) {
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
  const firstOverdue = rows.find((r) => r.original.status === 'overdue')?.original.id

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-paper" aria-busy={busy || !items}>
      <Table className={cn('text-[13.5px]', busy && 'opacity-60 transition-opacity')}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const id = header.column.id
                const sortable = header.column.getCanSort()
                const direction = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    scope="col"
                    aria-sort={sortable ? ariaSort(sort, id as BillSortKey) : undefined}
                    className={cn(CELL, 'h-auto border-b border-line bg-[#f8fafb] font-semibold whitespace-nowrap text-ink-2', RIGHT.has(id) && 'text-right')}
                  >
                    {header.isPlaceholder ? null : sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(nextSort(sort, id as BillSortKey))}
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
        <TableBody id="b-body">
          {!items ? (
            Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i} data-testid="bill-skeleton">
                {columns.map((_, c) => (
                  <TableCell key={c} className={CELL}>
                    <Skeleton className="h-4 w-full max-w-[100px]" />
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
            rows.map((row) => {
              const bill = row.original
              const highlighted = highlightOverdue && bill.id === firstOverdue
              return (
                <TableRow
                  key={row.id}
                  data-id={bill.id}
                  data-highlighted={highlighted || undefined}
                  id={bill.status === 'overdue' ? `overdue-${bill.id}` : undefined}
                  className={cn('hover:bg-transparent', highlighted && 'bg-[#fff7e6] hover:bg-[#fff7e6]')}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(CELL, 'whitespace-normal', RIGHT.has(cell.column.id) && 'text-right', cell.column.id === 'tenant' && 'min-w-[150px]')}
                    >
                      {cell.column.id === 'actions' ? <Actions bill={bill} actions={actions} /> : <table.FlexRender cell={cell} />}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

