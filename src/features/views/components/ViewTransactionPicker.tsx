import { useCallback, useMemo, useState } from 'react';
import {
  type Column,
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
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { TransactionAmountBadge } from '@/components/TransactionAmountBadge';
import { TransactionFilterBar } from '@/components/TransactionFilterBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DialogFooter } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction, TransactionType } from '@/types/transaction';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import { columnWidthClass } from '@/utils/columnWidth';
import { compareLocalDates, formatLocalDate } from '@/utils/dates';
import {
  filterTransactionsByDisplayAmount,
  hasActiveTransactionFilters,
} from '@/utils/transactionFilters';

const PAGE_SIZE = 10;
const MAX_ADDITIONS_PER_REQUEST = 10_000;

const EMPTY_PICKER_FILTERS: TransactionFilterValues = {
  globalFilter: '',
  dateFilter: { from: null, to: null },
  bankNameFilter: null,
  accountIdFilter: null,
  typeFilter: null,
  amountFilter: { min: null, max: null },
  amountCurrency: null,
};

function createEmptyPickerFilters(): TransactionFilterValues {
  return {
    ...EMPTY_PICKER_FILTERS,
    dateFilter: { ...EMPTY_PICKER_FILTERS.dateFilter },
    amountFilter: { ...EMPTY_PICKER_FILTERS.amountFilter },
  };
}

type PickerRow = Transaction & { displayAmount: DisplayAmount | undefined };

interface ViewTransactionPickerProps {
  allTransactions: Transaction[];
  memberTransactionIds: number[];
  viewName: string;
  displayCurrency: string;
  displayAmounts: ReadonlyMap<number, DisplayAmount>;
  isDisplayAmountLoading: boolean;
  isPending: boolean;
  errorMessage: string | null;
  submissionBlocked: boolean;
  onSelectionChange: () => void;
  onCancel: () => void;
  onSubmit: (transactionIds: number[]) => void;
}

export function ViewTransactionPicker({
  allTransactions,
  memberTransactionIds,
  viewName,
  displayCurrency,
  displayAmounts,
  isDisplayAmountLoading,
  isPending,
  errorMessage,
  submissionBlocked,
  onSelectionChange,
  onCancel,
  onSubmit,
}: ViewTransactionPickerProps) {
  const [filters, setFilters] = useState<TransactionFilterValues>(createEmptyPickerFilters);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectAllMatching, setSelectAllMatching] = useState(false);

  const memberIdSet = useMemo(() => new Set(memberTransactionIds), [memberTransactionIds]);
  const availableBankNames = useMemo(
    () => [...new Set(allTransactions.map((transaction) => transaction.bankName))].sort(),
    [allTransactions],
  );
  const availableAccountIds = useMemo(
    () =>
      [
        ...new Set(allTransactions.map((transaction) => transaction.accountId).filter(Boolean)),
      ].sort(),
    [allTransactions],
  );
  const hasAmountFilter = filters.amountFilter.min !== null || filters.amountFilter.max !== null;
  const isAmountFilterLoading = hasAmountFilter && isDisplayAmountLoading;
  const effectiveFilters = useMemo<TransactionFilterValues>(
    () =>
      isAmountFilterLoading ? { ...filters, amountFilter: { min: null, max: null } } : filters,
    [filters, isAmountFilterLoading],
  );
  const filterResult = useMemo(
    () => filterTransactionsByDisplayAmount(allTransactions, effectiveFilters, displayAmounts),
    [allTransactions, displayAmounts, effectiveFilters],
  );
  const filteredTransactions = filterResult.transactions;
  const eligibleFilteredIds = useMemo(
    () =>
      Array.from(
        new Set(
          filteredTransactions
            .map((transaction) => transaction.id)
            .filter(
              (transactionId) =>
                Number.isInteger(transactionId) &&
                transactionId > 0 &&
                !memberIdSet.has(transactionId),
            ),
        ),
      ),
    [filteredTransactions, memberIdSet],
  );
  const selectedRowIds = useMemo(
    () =>
      Array.from(
        new Set(
          allTransactions
            .map((transaction) => transaction.id)
            .filter(
              (transactionId) =>
                rowSelection[transactionId.toString()] &&
                Number.isInteger(transactionId) &&
                transactionId > 0 &&
                !memberIdSet.has(transactionId),
            ),
        ),
      ),
    [allTransactions, memberIdSet, rowSelection],
  );
  const selectedIds = selectAllMatching ? eligibleFilteredIds : selectedRowIds;
  const selectionExceedsLimit = selectedIds.length > MAX_ADDITIONS_PER_REQUEST;

  const handleSearchChange = useCallback((query: string) => {
    setFilters((current) => ({ ...current, globalFilter: query }));
  }, []);
  const handleDateFilterChange = useCallback((from: string | null, to: string | null) => {
    setFilters((current) => ({ ...current, dateFilter: { from, to } }));
  }, []);
  const handleBankNameFilterChange = useCallback((bankName: string | null) => {
    setFilters((current) => ({ ...current, bankNameFilter: bankName }));
  }, []);
  const handleAccountIdFilterChange = useCallback((accountId: string | null) => {
    setFilters((current) => ({ ...current, accountIdFilter: accountId }));
  }, []);
  const handleTypeFilterChange = useCallback((type: TransactionType | null) => {
    setFilters((current) => ({ ...current, typeFilter: type }));
  }, []);
  const handleAmountFilterChange = useCallback(
    (min: number | null, max: number | null) => {
      setFilters((current) => ({
        ...current,
        amountFilter: { min, max },
        amountCurrency: min === null && max === null ? null : displayCurrency,
      }));
    },
    [displayCurrency],
  );
  const handleClearAllFilters = useCallback(() => {
    setFilters(createEmptyPickerFilters());
  }, []);

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

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      setRowSelection((currentSelection) =>
        typeof updater === 'function' ? updater(currentSelection) : updater,
      );
      setSelectAllMatching(false);
      onSelectionChange();
    },
    [onSelectionChange],
  );
  const handleSelectAllMatching = useCallback(() => {
    setSelectAllMatching(true);
    onSelectionChange();
  }, [onSelectionChange]);
  const handleClearSelection = useCallback(() => {
    setRowSelection({});
    setSelectAllMatching(false);
    onSelectionChange();
  }, [onSelectionChange]);
  const handleSubmit = useCallback(() => {
    if (
      selectedIds.length === 0 ||
      selectionExceedsLimit ||
      isAmountFilterLoading ||
      isPending ||
      submissionBlocked
    ) {
      return;
    }

    onSubmit(selectedIds);
  }, [
    isAmountFilterLoading,
    isPending,
    onSubmit,
    selectedIds,
    selectionExceedsLimit,
    submissionBlocked,
  ]);

  const rows = useMemo<PickerRow[]>(
    () =>
      filteredTransactions.map((transaction) => ({
        ...transaction,
        displayAmount: displayAmounts.get(transaction.id),
      })),
    [displayAmounts, filteredTransactions],
  );

  const columns = useMemo<ColumnDef<PickerRow>[]>(
    () => [
      {
        id: 'amountAvailability',
        accessorFn: (row) => (row.displayAmount?.available ? 0 : 1),
        sortingFn: 'basic',
      },
      {
        id: 'select',
        header: ({ table }) => <SelectPageRowsCheckbox table={table} />,
        cell: ({ row }) => <PickerRowSelection row={row} viewName={viewName} />,
        size: 180,
        minSize: 180,
        maxSize: 180,
      },
      {
        accessorKey: 'date',
        header: ({ column }) => <SortableColumnHeader column={column} label="Date" />,
        cell: ({ row }) => formatLocalDate(row.original.date),
        sortingFn: (rowA, rowB) => {
          const dateComparison = compareLocalDates(rowA.original.date, rowB.original.date);
          return dateComparison !== 0 ? dateComparison : rowA.original.id - rowB.original.id;
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
        cell: ({ row }) => <div className="truncate">{row.original.accountId}</div>,
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
        accessorFn: (row) => (row.displayAmount?.available ? row.displayAmount.value : 0),
        header: ({ column }) => <SortableColumnHeader column={column} label="Amount" align="end" />,
        sortingFn: (rowA, rowB) => {
          const amountA = rowA.original.displayAmount;
          const amountB = rowB.original.displayAmount;
          if (amountA?.available && amountB?.available && amountA.value !== amountB.value) {
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
          ) : row.original.displayAmount ? (
            <TransactionAmountBadge
              displayAmount={row.original.displayAmount}
              isCredit={row.original.type === 'CREDIT'}
            />
          ) : (
            <span className="block text-right text-sm font-medium text-warning">
              Amount in {displayCurrency} unavailable
            </span>
          ),
        size: 150,
        minSize: 130,
        maxSize: 150,
      },
    ],
    [displayCurrency, isDisplayAmountLoading, viewName],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnVisibility: { amountAvailability: false },
    },
    enableRowSelection: (row) =>
      Number.isInteger(row.original.id) && row.original.id > 0 && !memberIdSet.has(row.original.id),
    onRowSelectionChange: handleRowSelectionChange,
    getRowId: (row) => row.id.toString(),
    onSortingChange: handleSortingChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const pageEligibleCount = table.getRowModel().rows.filter((row) => row.getCanSelect()).length;
  const emptyMessage = hasActiveTransactionFilters(filters)
    ? 'No transactions match these filters.'
    : 'No active transactions available.';

  return (
    <>
      <div className="-mx-6 flex-1 overflow-y-auto px-6 pt-4">
        <div className="space-y-4">
          <TransactionFilterBar
            filters={filters}
            availableBankNames={availableBankNames}
            availableAccountIds={availableAccountIds}
            onSearchChange={handleSearchChange}
            onDateFilterChange={handleDateFilterChange}
            onBankNameFilterChange={handleBankNameFilterChange}
            onAccountIdFilterChange={handleAccountIdFilterChange}
            onTypeFilterChange={handleTypeFilterChange}
            onAmountFilterChange={handleAmountFilterChange}
            onClearAllFilters={handleClearAllFilters}
          />

          {!isAmountFilterLoading && filterResult.unavailableAmountCount > 0 && (
            <div className="rounded-md bg-warning/15 px-4 py-3 text-sm text-warning" role="status">
              {filterResult.unavailableAmountCount}{' '}
              {filterResult.unavailableAmountCount === 1 ? 'transaction was' : 'transactions were'}{' '}
              excluded because conversion to {displayCurrency} is unavailable.
            </div>
          )}

          {table.getIsAllPageRowsSelected() &&
            eligibleFilteredIds.length > pageEligibleCount &&
            !selectAllMatching && (
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
                <span>
                  All {pageEligibleCount} eligible transactions on this page are selected.
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllMatching}
                  className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Select all {eligibleFilteredIds.length} eligible transactions matching these
                  filters
                </button>
              </div>
            )}

          {selectAllMatching && (
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
              <span>
                All {eligibleFilteredIds.length} eligible transactions matching these filters are
                selected.
              </span>
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
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={columnWidthClass(cell.column.getSize())}
                        >
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
            <PickerPagination table={table} totalCount={filteredTransactions.length} />
          )}
        </div>
      </div>

      {errorMessage && (
        <div
          className="mt-4 rounded-md bg-destructive/15 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {selectionExceedsLimit && (
        <div className="mt-4 rounded-md bg-warning/15 px-4 py-3 text-sm text-warning" role="status">
          Select no more than {MAX_ADDITIONS_PER_REQUEST.toLocaleString()} transactions per request.
        </div>
      )}

      <DialogFooter className="border-t pt-4">
        <span className="self-center text-sm font-medium sm:mr-auto">
          {selectedIds.length} eligible transaction{selectedIds.length === 1 ? '' : 's'} selected
        </span>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={
            selectedIds.length === 0 ||
            selectionExceedsLimit ||
            isAmountFilterLoading ||
            isPending ||
            submissionBlocked
          }
        >
          {isPending ? 'Adding...' : 'Add transactions'}
        </Button>
      </DialogFooter>
    </>
  );
}

function SelectPageRowsCheckbox({ table }: { table: ReactTable<PickerRow> }) {
  const handleCheckedChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      table.toggleAllPageRowsSelected(checked === true);
    },
    [table],
  );
  const pageEligibleCount = table.getRowModel().rows.filter((row) => row.getCanSelect()).length;
  const checked = table.getIsAllPageRowsSelected()
    ? true
    : table.getIsSomePageRowsSelected()
      ? 'indeterminate'
      : false;

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={handleCheckedChange}
      disabled={pageEligibleCount === 0}
      aria-label="Select eligible transactions on this page"
    />
  );
}

function PickerRowSelection({ row, viewName }: { row: Row<PickerRow>; viewName: string }) {
  const handleCheckedChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      row.toggleSelected(checked === true);
    },
    [row],
  );
  const canSelect = row.getCanSelect();

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={canSelect && row.getIsSelected()}
        onCheckedChange={handleCheckedChange}
        disabled={!canSelect}
        aria-label={
          canSelect
            ? `Select transaction ${row.original.id} to add to ${viewName}`
            : `Transaction ${row.original.id} is already in ${viewName}`
        }
      />
      {!canSelect && <Badge variant="outline">Already in view</Badge>}
    </div>
  );
}

function SortableColumnHeader({
  column,
  label,
  align = 'start',
}: {
  column: Column<PickerRow>;
  label: string;
  align?: 'start' | 'end';
}) {
  const handleClick = useCallback(() => {
    column.toggleSorting(column.getIsSorted() === 'asc');
  }, [column]);

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className={
        align === 'end' ? 'w-full justify-end hover:bg-transparent' : 'hover:bg-transparent'
      }
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}

function PickerPagination({
  table,
  totalCount,
}: {
  table: ReactTable<PickerRow>;
  totalCount: number;
}) {
  const handleFirstPage = useCallback(() => table.setPageIndex(0), [table]);
  const handlePreviousPage = useCallback(() => table.previousPage(), [table]);
  const handleNextPage = useCallback(() => table.nextPage(), [table]);
  const handleLastPage = useCallback(() => table.setPageIndex(table.getPageCount() - 1), [table]);
  const { pageIndex, pageSize } = table.getState().pagination;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm text-muted-foreground">
        Showing {pageIndex * pageSize + 1} to {Math.min((pageIndex + 1) * pageSize, totalCount)} of{' '}
        {totalCount} transactions
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleFirstPage}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronsLeft className="h-4 w-4" />
          First
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePreviousPage}
          disabled={!table.getCanPreviousPage()}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextPage}
          disabled={!table.getCanNextPage()}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLastPage}
          disabled={!table.getCanNextPage()}
        >
          Last
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
