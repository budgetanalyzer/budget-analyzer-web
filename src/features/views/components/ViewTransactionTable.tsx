// src/features/views/components/ViewTransactionTable.tsx
import { useCallback, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import { ViewTransaction } from '@/types/view';
import { ExchangeRateResponse } from '@/types/currency';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
} from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { TransactionAmountBadge } from '@/features/transactions/components/TransactionAmountBadge';
import { formatLocalDate, compareDates } from '@/utils/dates';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pin,
  PinOff,
  EyeOff,
  MoreHorizontal,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { cn } from '@/utils/cn';
import { usePinTransaction, useUnpinTransaction, useExcludeTransaction } from '@/hooks/useViews';
import { columnWidthClass } from '@/utils/columnWidth';

interface ViewTransactionTableProps {
  transactions: ViewTransaction[];
  viewId: string;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isExchangeRatesLoading: boolean;
}

export function ViewTransactionTable({
  transactions,
  viewId,
  displayCurrency,
  exchangeRatesMap,
  isExchangeRatesLoading,
}: ViewTransactionTableProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [pageIndex, setPageIndex] = useState(0);
  const pageSize = 20;

  // Mutations for pin/unpin/exclude
  const { mutate: pinTransaction, isPending: isPinning } = usePinTransaction();
  const { mutate: unpinTransaction, isPending: isUnpinning } = useUnpinTransaction();
  const { mutate: excludeTransaction, isPending: isExcluding } = useExcludeTransaction();

  const isMutating = isPinning || isUnpinning || isExcluding;

  // Handle row click to navigate to transaction detail
  const handleRowClick = useCallback(
    (transaction: ViewTransaction) => {
      // Pass the view context so we can return to the view
      navigate(`/transactions/${transaction.id}?returnTo=/views/${viewId}&breadcrumbLabel=View`);
    },
    [navigate, viewId],
  );

  // Handle pin action
  const handlePin = useCallback(
    (txnId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      pinTransaction({ viewId, txnId });
    },
    [pinTransaction, viewId],
  );

  // Handle unpin action
  const handleUnpin = useCallback(
    (txnId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      unpinTransaction({ viewId, txnId });
    },
    [unpinTransaction, viewId],
  );

  // Handle exclude action
  const handleExclude = useCallback(
    (txnId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      excludeTransaction({ viewId, txnId });
    },
    [excludeTransaction, viewId],
  );

  // Define columns for TanStack Table
  const columns = useMemo<ColumnDef<ViewTransaction>[]>(
    () => [
      {
        id: 'pinned',
        header: '',
        cell: ({ row }) => {
          if (row.original.membershipType === 'PINNED') {
            return (
              <div className="flex items-center justify-center">
                <Pin className="h-4 w-4 text-primary" />
              </div>
            );
          }
          return null;
        },
        size: 40,
        minSize: 40,
        maxSize: 40,
      },
      {
        accessorKey: 'date',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="hover:bg-transparent"
            >
              Date
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => formatLocalDate(row.original.date),
        sortingFn: (rowA, rowB) => {
          return compareDates(rowA.getValue('date') as string, rowB.getValue('date') as string);
        },
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
        header: 'Bank',
        cell: ({ row }) => <div className="truncate">{row.original.bankName}</div>,
        size: 150,
        minSize: 120,
        maxSize: 150,
      },
      {
        accessorKey: 'accountId',
        header: 'Account',
        cell: ({ row }) => <div className="truncate">{row.original.accountId || ''}</div>,
        size: 180,
        minSize: 150,
        maxSize: 200,
      },
      {
        accessorKey: 'type',
        header: 'Type',
        cell: ({ row }) => (
          <Badge variant={row.original.type === 'CREDIT' ? 'success' : 'secondary'}>
            {row.original.type}
          </Badge>
        ),
        size: 100,
        minSize: 100,
        maxSize: 100,
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="w-full justify-end hover:bg-transparent"
            >
              Amount
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
        cell: ({ row }) => {
          if (isExchangeRatesLoading) {
            return (
              <div className="flex items-center justify-end gap-2">
                <Skeleton className="h-5 w-24" />
              </div>
            );
          }
          return (
            <TransactionAmountBadge
              amount={row.original.amount}
              date={row.original.date}
              currencyCode={row.original.currencyIsoCode}
              displayCurrency={displayCurrency}
              exchangeRatesMap={exchangeRatesMap}
              isCredit={row.original.type === 'CREDIT'}
            />
          );
        },
        size: 150,
        minSize: 130,
        maxSize: 150,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const isPinned = row.original.membershipType === 'PINNED';
          return (
            <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={isMutating}>
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {isPinned ? (
                    <DropdownMenuItem
                      onClick={(e) =>
                        handleUnpin(row.original.id, e as unknown as React.MouseEvent)
                      }
                    >
                      <PinOff className="mr-2 h-4 w-4" />
                      Unpin
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={(e) => handlePin(row.original.id, e as unknown as React.MouseEvent)}
                    >
                      <Pin className="mr-2 h-4 w-4" />
                      Pin to View
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) =>
                      handleExclude(row.original.id, e as unknown as React.MouseEvent)
                    }
                    destructive
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Exclude
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        size: 60,
        minSize: 60,
        maxSize: 60,
      },
    ],
    [
      displayCurrency,
      exchangeRatesMap,
      isExchangeRatesLoading,
      isMutating,
      handlePin,
      handleUnpin,
      handleExclude,
    ],
  );

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const currentPagination = { pageIndex, pageSize };
      const newPagination = typeof updater === 'function' ? updater(currentPagination) : updater;
      setPageIndex(newPagination.pageIndex);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
    autoResetPageIndex: false,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={columnWidthClass(header.getSize())}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => handleRowClick(row.original)}
                  className={cn(
                    'cursor-pointer border-b transition-colors hover:bg-muted/50',
                    row.original.membershipType === 'PINNED' &&
                      'border-l-2 border-l-primary bg-primary/5',
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={columnWidthClass(cell.column.getSize())}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No transactions in this view.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {table.getRowModel().rows.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing{' '}
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              transactions.length,
            )}{' '}
            of {transactions.length} transactions
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="h-4 w-4" />
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
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
