import { useCallback, useMemo, useState } from 'react';
import {
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type Table as ReactTable,
  type Updater,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { TransactionFilterBar } from '@/components/TransactionFilterBar';
import { TransactionAmountBadge } from '@/components/TransactionAmountBadge';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { RemoveViewTransactionsBar } from '@/features/views/components/RemoveViewTransactionsBar';
import { RemoveViewTransactionsModal } from '@/features/views/components/RemoveViewTransactionsModal';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction, TransactionType } from '@/types/transaction';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import { columnWidthClass } from '@/utils/columnWidth';
import { compareLocalDates, formatLocalDate } from '@/utils/dates';
import { hasActiveTransactionFilters } from '@/utils/transactionFilters';

type ViewTransactionTableRow = Transaction & { displayAmount: DisplayAmount };

interface ViewTransactionTableProps {
  transactions: Transaction[];
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
  displayAmounts: ReadonlyMap<number, DisplayAmount>;
  isDisplayAmountLoading: boolean;
  isAmountFilterLoading: boolean;
  onReviewPossibleTransfersAndRefunds?: () => void;
  unavailableAmountFilterCount: number;
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
  displayAmounts,
  isDisplayAmountLoading,
  isAmountFilterLoading,
  onReviewPossibleTransfersAndRefunds,
  unavailableAmountFilterCount,
}: ViewTransactionTableProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [rowRemovalId, setRowRemovalId] = useState<number | null>(null);
  const canRemoveFromView = usePermission('views:write');

  const rows = useMemo<ViewTransactionTableRow[]>(
    () =>
      transactions.map((transaction) => ({
        ...transaction,
        displayAmount: displayAmounts.get(transaction.id)!,
      })),
    [displayAmounts, transactions],
  );

  const handleRowClick = useCallback(
    (transaction: Transaction) => {
      const returnTo = `${location.pathname}${location.search}`;
      const params = new URLSearchParams({ returnTo, breadcrumbLabel: 'View' });
      navigate(`/transactions/${transaction.id}?${params.toString()}`);
    },
    [location.pathname, location.search, navigate],
  );

  const selectedIds = useMemo(
    () =>
      Object.keys(rowSelection)
        .filter((key) => rowSelection[key])
        .map((key) => Number.parseInt(key, 10)),
    [rowSelection],
  );
  const allFilteredIds = useMemo(
    () => transactions.map((transaction) => transaction.id),
    [transactions],
  );
  const bulkRemovalIds = selectAllMatching ? allFilteredIds : selectedIds;
  const idsToRemove = rowRemovalId === null ? bulkRemovalIds : [rowRemovalId];
  const singleRemovalRow =
    idsToRemove.length === 1 ? (rows.find((row) => row.id === idsToRemove[0]) ?? null) : null;

  const handleRowRemove = useCallback((transactionId: number) => {
    setRowRemovalId(transactionId);
    setRemoveDialogOpen(true);
  }, []);
  const handleBulkRemove = useCallback(() => {
    setRowRemovalId(null);
    setRemoveDialogOpen(true);
  }, []);
  const handleRemoveDialogOpenChange = useCallback((open: boolean) => {
    setRemoveDialogOpen(open);
    if (!open) setRowRemovalId(null);
  }, []);
  const handleRemoveSuccess = useCallback(() => {
    setRowSelection({});
    setSelectAllMatching(false);
  }, []);
  const handleClearSelection = useCallback(() => {
    setRowSelection({});
    setSelectAllMatching(false);
  }, []);
  const handleSelectAllMatching = useCallback(() => {
    setSelectAllMatching(true);
  }, []);

  const columns = useMemo<ColumnDef<ViewTransactionTableRow>[]>(
    () => [
      {
        id: 'amountAvailability',
        accessorFn: (row) => (row.displayAmount.available ? 0 : 1),
        sortingFn: 'basic',
      },
      ...(canRemoveFromView
        ? [
            {
              id: 'select',
              header: ({ table }) => <SelectPageRowsCheckbox table={table} />,
              cell: ({ row }) => <ViewRowSelectionCheckbox row={row} />,
              size: 50,
              minSize: 50,
              maxSize: 50,
            } satisfies ColumnDef<ViewTransactionTableRow>,
          ]
        : []),
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="hover:bg-transparent"
          >
            Date
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => formatLocalDate(row.original.date),
        sortingFn: (rowA, rowB) => compareLocalDates(rowA.original.date, rowB.original.date),
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
        id: 'amount',
        accessorFn: (row) => (row.displayAmount.available ? row.displayAmount.value : 0),
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="w-full justify-end hover:bg-transparent"
          >
            Amount
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        sortingFn: (rowA, rowB) => {
          const amountA = rowA.original.displayAmount;
          const amountB = rowB.original.displayAmount;
          if (amountA.available && amountB.available && amountA.value !== amountB.value) {
            return amountA.value - amountB.value;
          }

          const dateComparison = compareLocalDates(rowA.original.date, rowB.original.date);
          return dateComparison !== 0 ? dateComparison : rowA.original.id - rowB.original.id;
        },
        cell: ({ row }) =>
          isDisplayAmountLoading ? (
            <div className="flex items-center justify-end gap-2">
              <Skeleton className="h-5 w-24" />
            </div>
          ) : (
            <TransactionAmountBadge
              displayAmount={row.original.displayAmount}
              isCredit={row.original.type === 'CREDIT'}
            />
          ),
        size: 150,
        minSize: 130,
        maxSize: 150,
      },
      ...(canRemoveFromView
        ? [
            {
              id: 'actions',
              header: 'Actions',
              cell: ({ row }) => (
                <RemoveViewTransactionButton
                  transactionId={row.original.id}
                  onRemove={handleRowRemove}
                />
              ),
              size: 170,
              minSize: 170,
              maxSize: 170,
            } satisfies ColumnDef<ViewTransactionTableRow>,
          ]
        : []),
    ],
    [canRemoveFromView, handleRowRemove, isDisplayAmountLoading],
  );

  const handleSortingChange = useCallback((updater: Updater<SortingState>) => {
    setSorting((currentSorting) => {
      const requestedSorting = typeof updater === 'function' ? updater(currentSorting) : updater;
      const amountSorting = requestedSorting.find((sort) => sort.id === 'amount');
      const visibleSorting = requestedSorting.filter(
        (sort) => sort.id !== 'amount' && sort.id !== 'amountAvailability',
      );

      return amountSorting
        ? [{ id: 'amountAvailability', desc: false }, amountSorting, ...visibleSorting]
        : visibleSorting;
    });
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, []);

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnVisibility: { amountAvailability: false },
    },
    enableRowSelection: canRemoveFromView,
    onRowSelectionChange: (updater) => {
      const nextSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(nextSelection);
      if (selectAllMatching) setSelectAllMatching(false);
    },
    getRowId: (row) => row.id.toString(),
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const emptyMessage = hasActiveTransactionFilters(filters)
    ? 'No transactions match these filters.'
    : 'No transactions in this view.';

  return (
    <section aria-labelledby="view-transactions-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="view-transactions-heading" className="text-xl font-semibold">
          Transactions
        </h2>
        {onReviewPossibleTransfersAndRefunds && (
          <Button variant="secondary" onClick={onReviewPossibleTransfersAndRefunds}>
            <Search className="mr-2 h-4 w-4" />
            Review possible transfers and refunds
          </Button>
        )}
      </div>

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

      {unavailableAmountFilterCount > 0 && (
        <div className="rounded-md bg-warning/15 px-4 py-3 text-sm text-warning" role="status">
          {unavailableAmountFilterCount}{' '}
          {unavailableAmountFilterCount === 1 ? 'transaction was' : 'transactions were'} excluded
          because conversion to {displayCurrency} is unavailable.
        </div>
      )}

      {canRemoveFromView &&
        table.getIsAllPageRowsSelected() &&
        transactions.length > pagination.pageSize &&
        !selectAllMatching && (
          <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
            <span>
              All {Math.min(pagination.pageSize, transactions.length)} transactions on this page are
              selected.
            </span>
            <button
              type="button"
              onClick={handleSelectAllMatching}
              className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Select all {transactions.length} transactions matching this filter
            </button>
          </div>
        )}

      {canRemoveFromView && selectAllMatching && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
          <span>All {transactions.length} transactions matching this filter are selected.</span>
          <button
            type="button"
            onClick={handleClearSelection}
            className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
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
            {isAmountFilterLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading filtered amounts...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => handleRowClick(row.original)}
                  className="cursor-pointer border-b transition-colors hover:bg-muted/50"
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

      {!isAmountFilterLoading && table.getRowModel().rows.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {pagination.pageIndex * pagination.pageSize + 1} to{' '}
            {Math.min((pagination.pageIndex + 1) * pagination.pageSize, transactions.length)} of{' '}
            {transactions.length} transactions
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

      <RemoveViewTransactionsBar
        selectedCount={bulkRemovalIds.length}
        onRemove={handleBulkRemove}
        onClearSelection={handleClearSelection}
        isVisible={
          canRemoveFromView &&
          rowRemovalId === null &&
          (selectedIds.length > 0 || selectAllMatching)
        }
      />

      {canRemoveFromView && (
        <RemoveViewTransactionsModal
          viewId={viewId}
          transactionIds={idsToRemove}
          transaction={singleRemovalRow}
          displayAmount={singleRemovalRow?.displayAmount ?? null}
          open={removeDialogOpen}
          onOpenChange={handleRemoveDialogOpenChange}
          onSuccess={handleRemoveSuccess}
        />
      )}
    </section>
  );
}

function SelectPageRowsCheckbox({ table }: { table: ReactTable<ViewTransactionTableRow> }) {
  const handleCheckedChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      table.toggleAllPageRowsSelected(checked === true);
    },
    [table],
  );
  const checked = table.getIsAllPageRowsSelected()
    ? true
    : table.getIsSomePageRowsSelected()
      ? 'indeterminate'
      : false;

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={handleCheckedChange}
      aria-label="Select all transactions on this page"
    />
  );
}

function ViewRowSelectionCheckbox({ row }: { row: Row<ViewTransactionTableRow> }) {
  const handleCheckedChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      row.toggleSelected(checked === true);
    },
    [row],
  );
  const handleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={handleCheckedChange}
      onClick={handleClick}
      aria-label={`Select transaction ${row.original.id}`}
    />
  );
}

function RemoveViewTransactionButton({
  transactionId,
  onRemove,
}: {
  transactionId: number;
  onRemove: (transactionId: number) => void;
}) {
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onRemove(transactionId);
    },
    [onRemove, transactionId],
  );

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <X className="mr-2 h-4 w-4" />
      Remove from view
    </Button>
  );
}
