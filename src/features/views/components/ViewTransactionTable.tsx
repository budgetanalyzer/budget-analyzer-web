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
  RowSelectionState,
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
import { Checkbox } from '@/components/ui/Checkbox';
import { Skeleton } from '@/components/ui/Skeleton';
import { TransactionFilterBar } from '@/components/TransactionFilterBar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { TransactionAmountBadge } from '@/features/transactions/components/TransactionAmountBadge';
import { BulkViewTransactionBar } from '@/features/views/components/BulkViewTransactionBar';
import {
  BulkViewTransactionAction,
  BulkViewTransactionModal,
} from '@/features/views/components/BulkViewTransactionModal';
import { formatLocalDate, compareLocalDates } from '@/utils/dates';
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
import { useLocation, useNavigate } from 'react-router';
import { cn } from '@/utils/cn';
import { usePinTransaction, useUnpinTransaction, useExcludeTransaction } from '@/hooks/useViews';
import { columnWidthClass } from '@/utils/columnWidth';
import type { TransactionType } from '@/types/transaction';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import { hasActiveTransactionFilters } from '@/utils/transactionFilters';

interface ViewTransactionTableProps {
  transactions: ViewTransaction[];
  viewId: string;
  filters: TransactionFilterValues;
  availableBankNames: string[];
  availableAccountIds: string[];
  onSearchChange: (query: string) => void;
  onDateFilterChange: (from: string | null, to: string | null) => void;
  onBankNameFilterChange: (bankName: string | null) => void;
  onAccountIdFilterChange: (accountId: string | null) => void;
  onTypeFilterChange: (type: TransactionType | null) => void;
  onAmountFilterChange: (min: number | null, max: number | null) => void;
  onClearAllFilters: () => void;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isExchangeRatesLoading: boolean;
}

interface ViewTransactionTableContentProps {
  transactions: ViewTransaction[];
  viewId: string;
  filters: TransactionFilterValues;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isExchangeRatesLoading: boolean;
}

export function ViewTransactionTable({
  transactions,
  viewId,
  filters,
  availableBankNames,
  availableAccountIds,
  onSearchChange,
  onDateFilterChange,
  onBankNameFilterChange,
  onAccountIdFilterChange,
  onTypeFilterChange,
  onAmountFilterChange,
  onClearAllFilters,
  displayCurrency,
  exchangeRatesMap,
  isExchangeRatesLoading,
}: ViewTransactionTableProps) {
  return (
    <div className="space-y-4">
      <TransactionFilterBar
        key={viewId}
        filters={filters}
        availableBankNames={availableBankNames}
        availableAccountIds={availableAccountIds}
        onSearchChange={onSearchChange}
        onDateFilterChange={onDateFilterChange}
        onBankNameFilterChange={onBankNameFilterChange}
        onAccountIdFilterChange={onAccountIdFilterChange}
        onTypeFilterChange={onTypeFilterChange}
        onAmountFilterChange={onAmountFilterChange}
        onClearAllFilters={onClearAllFilters}
      />

      <ViewTransactionTableContent
        key={JSON.stringify([viewId, filters])}
        transactions={transactions}
        viewId={viewId}
        filters={filters}
        displayCurrency={displayCurrency}
        exchangeRatesMap={exchangeRatesMap}
        isExchangeRatesLoading={isExchangeRatesLoading}
      />
    </div>
  );
}

function ViewTransactionTableContent({
  transactions,
  viewId,
  filters,
  displayCurrency,
  exchangeRatesMap,
  isExchangeRatesLoading,
}: ViewTransactionTableContentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [pageIndex, setPageIndex] = useState(0);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkViewTransactionAction | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
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
      const returnTo = `${location.pathname}${location.search}`;
      const params = new URLSearchParams({
        returnTo,
        breadcrumbLabel: 'View',
      });
      navigate(`/transactions/${transaction.id}?${params.toString()}`);
    },
    [location.pathname, location.search, navigate],
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
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all rows on page"
          />
        ),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label={`Select transaction ${row.original.id}`}
            />
          </div>
        ),
        size: 50,
        minSize: 50,
        maxSize: 50,
      },
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
          return compareLocalDates(
            rowA.getValue('date') as string,
            rowB.getValue('date') as string,
          );
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
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(newSelection);
      if (selectAllMatching) {
        setSelectAllMatching(false);
      }
    },
    getRowId: (row) => row.id.toString(),
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

  const selectedTransactions = selectAllMatching
    ? transactions
    : table.getSelectedRowModel().rows.map((row) => row.original);
  const selectedIds = selectedTransactions.map((transaction) => transaction.id);
  const idsToUpdate = selectedIds;
  const idsToPin = selectedTransactions
    .filter((transaction) => transaction.membershipType !== 'PINNED')
    .map((transaction) => transaction.id);
  const modalSelectedIds = bulkAction === 'pin' ? idsToPin : idsToUpdate;

  const handleClearSelection = useCallback(() => {
    setRowSelection({});
    setSelectAllMatching(false);
  }, []);

  const handleSelectAllMatching = useCallback(() => {
    setSelectAllMatching(true);
  }, []);

  const handleBulkPin = useCallback(() => {
    if (idsToPin.length === 0) return;
    setBulkAction('pin');
    setBulkModalOpen(true);
  }, [idsToPin.length]);

  const handleBulkExclude = useCallback(() => {
    setBulkAction('exclude');
    setBulkModalOpen(true);
  }, []);

  const handleBulkModalOpenChange = useCallback((open: boolean) => {
    setBulkModalOpen(open);
    if (!open) {
      setBulkAction(null);
    }
  }, []);

  const handleBulkSuccess = useCallback(() => {
    setRowSelection({});
    setSelectAllMatching(false);
  }, []);

  const emptyMessage = hasActiveTransactionFilters(filters)
    ? 'No transactions match these filters.'
    : 'No transactions in this view.';

  return (
    <>
      {table.getIsAllPageRowsSelected() && transactions.length > pageSize && !selectAllMatching && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
          <span>
            All {Math.min(pageSize, transactions.length)} transactions on this page are selected.
          </span>
          <button
            type="button"
            onClick={handleSelectAllMatching}
            className="font-medium text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Select all {transactions.length} transactions in this view
          </button>
        </div>
      )}

      {selectAllMatching && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
          <span>All {idsToUpdate.length} transactions in this view are selected.</span>
          <button
            type="button"
            onClick={handleClearSelection}
            className="font-medium text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear selection
          </button>
        </div>
      )}

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
                    row.getIsSelected() && 'bg-muted',
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
                  {emptyMessage}
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

      <BulkViewTransactionBar
        selectedCount={idsToUpdate.length}
        isPinDisabled={idsToPin.length === 0}
        isVisible={idsToUpdate.length > 0}
        onClearSelection={handleClearSelection}
        onPin={handleBulkPin}
        onExclude={handleBulkExclude}
      />

      {bulkAction && (
        <BulkViewTransactionModal
          viewId={viewId}
          selectedIds={modalSelectedIds}
          action={bulkAction}
          isOpen={bulkModalOpen}
          onOpenChange={handleBulkModalOpenChange}
          onSuccess={handleBulkSuccess}
        />
      )}
    </>
  );
}
