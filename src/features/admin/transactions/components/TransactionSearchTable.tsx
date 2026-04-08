// src/features/admin/transactions/components/TransactionSearchTable.tsx
import { useCallback, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Updater,
  type PaginationState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  List,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { TransactionSearchResult, PageMetadata } from '@/types/transactionSearch';
import { formatLocalDate } from '@/utils/dates';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import { columnWidthClass } from '@/utils/columnWidth';
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/features/admin/transactions/utils/urlState';

interface TransactionSearchTableProps {
  data: TransactionSearchResult[];
  metadata: PageMetadata | undefined;
  sort: string[];
  isLoading: boolean;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: PageSize) => void;
  onSortChange: (sort: string[]) => void;
}

/**
 * Translate the URL sort representation (['date,DESC', 'id,DESC']) into
 * TanStack Table's SortingState ([{ id: 'date', desc: true }, ...]).
 */
function parseSortStateFromQuery(sort: string[]): SortingState {
  return sort
    .map((entry) => {
      const [id, dirRaw] = entry.split(',');
      if (!id) return null;
      return { id, desc: (dirRaw ?? 'ASC').toUpperCase() === 'DESC' };
    })
    .filter((s): s is { id: string; desc: boolean } => s !== null);
}

/**
 * Translate TanStack Table's SortingState back to the URL sort representation.
 */
function serializeSortStateToQuery(sortingState: SortingState): string[] {
  return sortingState.map((s) => `${s.id},${s.desc ? 'DESC' : 'ASC'}`);
}

interface SortableHeaderProps {
  label: string;
  field: string;
  sort: string[];
  align?: 'left' | 'right';
  onSortChange: (sort: string[]) => void;
}

function SortableHeader({ label, field, sort, align = 'left', onSortChange }: SortableHeaderProps) {
  const current = sort.find((s) => s.split(',')[0] === field);
  const isActive = current !== undefined;
  const isAsc = current?.split(',')[1] === 'ASC';
  const handleClick = () => {
    // Toggle: none -> DESC -> ASC -> DESC, but to keep the URL stable we replace
    // any existing entry for this field. Multi-column sort is supported by the
    // backend but we keep the UI single-column for v1.
    const nextDir = current ? (isAsc ? 'DESC' : 'ASC') : 'DESC';
    // Append `id,DESC` as a stable secondary key so paged results don't
    // duplicate or skip rows when the primary sort key has duplicates
    // (matches the default sort in urlState.ts). Skip when the user is
    // already sorting by id.
    const next = field === 'id' ? [`${field},${nextDir}`] : [`${field},${nextDir}`, 'id,DESC'];
    onSortChange(next);
  };
  const Icon = isActive ? (isAsc ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className={cn(
        'px-0 hover:bg-transparent',
        isActive && 'text-foreground',
        align === 'right' && 'w-full justify-end',
      )}
    >
      {label}
      <Icon className={cn('ml-2 h-4 w-4', !isActive && 'opacity-40')} />
    </Button>
  );
}

export function TransactionSearchTable({
  data,
  metadata,
  sort,
  isLoading,
  isFetching,
  onPageChange,
  onSizeChange,
  onSortChange,
}: TransactionSearchTableProps) {
  const handleSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const current = parseSortStateFromQuery(sort);
      const next = typeof updater === 'function' ? updater(current) : updater;
      onSortChange(serializeSortStateToQuery(next));
    },
    [sort, onSortChange],
  );

  const handlePaginationChange = useCallback(
    (updater: Updater<PaginationState>) => {
      const current: PaginationState = {
        pageIndex: metadata?.page ?? 0,
        pageSize: metadata?.size ?? 50,
      };
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next.pageIndex !== current.pageIndex) {
        onPageChange(next.pageIndex);
      }
      if (next.pageSize !== current.pageSize) {
        onSizeChange(next.pageSize as PageSize);
      }
    },
    [metadata, onPageChange, onSizeChange],
  );

  const columns = useMemo<ColumnDef<TransactionSearchResult>[]>(
    () => [
      {
        accessorKey: 'date',
        header: () => (
          <SortableHeader label="Date" field="date" sort={sort} onSortChange={onSortChange} />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{formatLocalDate(row.original.date)}</span>
        ),
        size: 120,
        minSize: 120,
        maxSize: 120,
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => <div className="truncate">{row.original.description}</div>,
        size: 400,
        minSize: 200,
      },
      {
        accessorKey: 'bankName',
        header: () => (
          <SortableHeader label="Bank" field="bankName" sort={sort} onSortChange={onSortChange} />
        ),
        cell: ({ row }) => <div className="truncate">{row.original.bankName}</div>,
        size: 150,
        minSize: 120,
        maxSize: 150,
      },
      {
        accessorKey: 'accountId',
        header: () => (
          <SortableHeader
            label="Account"
            field="accountId"
            sort={sort}
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => {
          const accountId = row.original.accountId;
          const truncated = accountId.length > 6 ? `…${accountId.slice(-6)}` : accountId;
          return (
            <span className="font-mono text-xs" title={accountId}>
              {truncated}
            </span>
          );
        },
        size: 100,
        minSize: 100,
        maxSize: 100,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) =>
          row.original.type === 'CREDIT' ? (
            <Badge variant="outline" className="border-emerald-500 text-emerald-600">
              CREDIT
            </Badge>
          ) : (
            <Badge variant="secondary">DEBIT</Badge>
          ),
        size: 100,
        minSize: 100,
        maxSize: 100,
      },
      {
        accessorKey: 'amount',
        header: () => (
          <SortableHeader
            label="Amount"
            field="amount"
            sort={sort}
            align="right"
            onSortChange={onSortChange}
          />
        ),
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2 font-medium">
            <span>{formatCurrency(row.original.amount, row.original.currencyIsoCode)}</span>
            {row.original.currencyIsoCode !== 'USD' && (
              <Badge variant="outline" className="text-[10px]">
                {row.original.currencyIsoCode}
              </Badge>
            )}
          </div>
        ),
        size: 150,
        minSize: 130,
        maxSize: 150,
      },
    ],
    [sort, onSortChange],
  );

  const table = useReactTable({
    data,
    columns,
    pageCount: metadata?.totalPages ?? -1,
    rowCount: metadata?.totalElements ?? 0,
    state: {
      pagination: {
        pageIndex: metadata?.page ?? 0,
        pageSize: metadata?.size ?? 50,
      },
      sorting: parseSortStateFromQuery(sort),
    },
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
  });

  const showInitialSkeleton = isLoading && data.length === 0;
  const showEmpty = !isLoading && data.length === 0;

  const totalElements = metadata?.totalElements ?? 0;
  const numberOfElements = metadata?.numberOfElements ?? 0;
  const pageIndex = metadata?.page ?? 0;
  const pageSize = metadata?.size ?? 50;
  const totalPages = metadata?.totalPages ?? 0;
  const showingFrom = totalElements === 0 ? 0 : pageIndex * pageSize + 1;
  const showingTo = totalElements === 0 ? 0 : pageIndex * pageSize + numberOfElements;

  const canPrev = pageIndex > 0;
  const canNext = pageIndex + 1 < totalPages;

  const handlePageSizeChange = useCallback(
    (value: string) => {
      const next = Number(value);
      if (PAGE_SIZE_OPTIONS.includes(next as PageSize)) {
        onSizeChange(next as PageSize);
      }
    },
    [onSizeChange],
  );

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm">
        {isFetching && data.length > 0 && (
          <div className="absolute left-0 right-0 top-0 h-0.5 animate-pulse bg-primary" />
        )}
        <Table hideScrollbar={false}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b bg-muted/50 hover:bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn('h-12 font-semibold', columnWidthClass(header.getSize()))}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {showInitialSkeleton ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  {table.getAllColumns().map((col) => (
                    <TableCell
                      key={`skeleton-${idx}-${col.id}`}
                      className={cn('py-3', columnWidthClass(col.getSize()))}
                    >
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : showEmpty ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <List className="h-12 w-12 text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">
                      No transactions found
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Adjust filters to broaden the search
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn('py-3', columnWidthClass(cell.column.getSize()))}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!showInitialSkeleton && totalElements > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {showingFrom}–{showingTo} of {totalElements.toLocaleString()} transactions
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="w-[80px]">
                <SelectValue>{pageSize}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => onPageChange(0)} disabled={!canPrev}>
              <ChevronsLeft className="h-4 w-4" />
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pageIndex - 1)}
              disabled={!canPrev}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm">
              Page {pageIndex + 1} of {Math.max(totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pageIndex + 1)}
              disabled={!canNext}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages - 1)}
              disabled={!canNext}
            >
              Last
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
