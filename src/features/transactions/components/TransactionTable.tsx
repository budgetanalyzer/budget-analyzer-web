// src/features/transactions/components/TransactionTable.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  RowSelectionState,
} from '@tanstack/react-table';
import { Transaction, TransactionType } from '@/types/transaction';
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
import { Input } from '@/components/ui/Input';
import { DeleteTransactionModal } from '@/features/transactions/components/DeleteTransactionModal';
import { EditableTransactionRow } from '@/features/transactions/components/EditableTransactionRow';
import { BulkDeleteBar } from '@/features/transactions/components/BulkDeleteBar';
import { BulkDeleteModal } from '@/features/transactions/components/BulkDeleteModal';
import { SaveAsViewButton } from '@/components/SaveAsViewButton';
import { ViewCriteriaApi } from '@/types/view';
import { Checkbox } from '@/components/ui/Checkbox';
import { compareDates } from '@/utils/dates';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  setTransactionTableSorting,
  setTransactionTablePageIndex,
  setTransactionTableGlobalFilter,
  setTransactionTableDateFilter,
  setTransactionTableBankNameFilter,
  setTransactionTableAccountIdFilter,
  setTransactionTableTypeFilter,
  setTransactionTableAmountFilter,
} from '@/store/uiSlice';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { formatApiError } from '@/utils/errorMessages';
import { toast } from '@/hooks/useToast';
import { useDebounce } from '@/hooks/useDebounce';
import { columnWidthClass } from '@/utils/columnWidth';

interface TransactionTableProps {
  transactions: Transaction[];
  onDateFilterChange?: (from: string | null, to: string | null) => void;
  onSearchChange?: (query: string) => void;
  onBankNameFilterChange?: (bankName: string | null) => void;
  onAccountIdFilterChange?: (accountId: string | null) => void;
  onTypeFilterChange?: (type: TransactionType | null) => void;
  onAmountFilterChange?: (min: number | null, max: number | null) => void;
  onClearAllFilters?: () => void;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isExchangeRatesLoading: boolean;
  availableBankNames: string[];
  availableAccountIds: string[];
  viewCriteria?: ViewCriteriaApi;
}

export function TransactionTable({
  transactions,
  onDateFilterChange,
  onSearchChange,
  onBankNameFilterChange,
  onAccountIdFilterChange,
  onTypeFilterChange,
  onAmountFilterChange,
  onClearAllFilters,
  displayCurrency,
  exchangeRatesMap,
  isExchangeRatesLoading,
  availableBankNames,
  availableAccountIds,
  viewCriteria,
}: TransactionTableProps) {
  const dispatch = useAppDispatch();
  const sorting = useAppSelector((state) => state.ui.transactionTable.sorting);
  const pageIndex = useAppSelector((state) => state.ui.transactionTable.pageIndex);
  const pageSize = useAppSelector((state) => state.ui.transactionTable.pageSize);
  const globalFilter = useAppSelector((state) => state.ui.transactionTable.globalFilter);
  const dateFilter = useAppSelector((state) => state.ui.transactionTable.dateFilter);
  const bankNameFilter = useAppSelector((state) => state.ui.transactionTable.bankNameFilter);
  const accountIdFilter = useAppSelector((state) => state.ui.transactionTable.accountIdFilter);
  const typeFilter = useAppSelector((state) => state.ui.transactionTable.typeFilter);
  const amountFilter = useAppSelector((state) => state.ui.transactionTable.amountFilter);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [localSearchValue, setLocalSearchValue] = useState(globalFilter ?? '');
  const [localMinAmount, setLocalMinAmount] = useState(amountFilter.min?.toString() ?? '');
  const [localMaxAmount, setLocalMaxAmount] = useState(amountFilter.max?.toString() ?? '');
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const navigate = useNavigate();
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();

  // Debounce amount filters only (search uses explicit submit)
  const debouncedMinAmount = useDebounce(localMinAmount, 400);
  const debouncedMaxAmount = useDebounce(localMaxAmount, 400);

  // Submit search on Enter key press
  const handleSearchSubmit = useCallback(() => {
    dispatch(setTransactionTableGlobalFilter(localSearchValue));
    onSearchChange?.(localSearchValue);
  }, [localSearchValue, dispatch, onSearchChange]);

  // Handle search input keydown - submit on Enter
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearchSubmit();
      }
    },
    [handleSearchSubmit],
  );

  // Handle clearing search - submit immediately
  const handleClearSearch = useCallback(() => {
    setLocalSearchValue('');
    dispatch(setTransactionTableGlobalFilter(''));
    onSearchChange?.('');
  }, [dispatch, onSearchChange]);

  // Update Redux and URL when debounced amount values change
  useEffect(() => {
    const min = debouncedMinAmount ? parseFloat(debouncedMinAmount) : null;
    const max = debouncedMaxAmount ? parseFloat(debouncedMaxAmount) : null;
    dispatch(setTransactionTableAmountFilter({ min, max }));
    onAmountFilterChange?.(min, max);
  }, [debouncedMinAmount, debouncedMaxAmount, dispatch, onAmountFilterChange]);

  // Handle save from row component
  const handleSaveTransaction = useCallback(
    (id: number, data: { description?: string; accountId?: string }) => {
      updateTransaction(
        { id, data },
        {
          onSuccess: () => {
            toast.success('Transaction updated');
          },
          onError: (error) => {
            toast.error(formatApiError(error, 'Failed to update transaction'));
          },
        },
      );
    },
    [updateTransaction],
  );

  // Handle delete from row component
  const handleDeleteTransaction = useCallback((transaction: Transaction) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  }, []);

  // Handle row click to navigate to detail page
  const handleRowClick = useCallback(
    (transaction: Transaction) => {
      navigate(`/transactions/${transaction.id}`);
    },
    [navigate],
  );

  // Get selected transaction IDs (from row selection)
  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .filter((key) => rowSelection[key])
      .map((key) => parseInt(key, 10));
  }, [rowSelection]);

  // Get all filtered transaction IDs (for "select all matching" mode)
  const allFilteredIds = useMemo(() => {
    return transactions.map((t) => t.id);
  }, [transactions]);

  // Determine which IDs to use for deletion
  const idsToDelete = selectAllMatching ? allFilteredIds : selectedIds;

  // Handle bulk delete
  const handleBulkDelete = useCallback(() => {
    setBulkDeleteDialogOpen(true);
  }, []);

  const handleBulkDeleteSuccess = useCallback(() => {
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

  // Define columns for TanStack Table
  // Note: Cell rendering is handled by EditableTransactionRow, not by these column definitions
  // These columns are only used for: headers, sorting configuration, and column widths
  const columns = useMemo<ColumnDef<Transaction>[]>(
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
          />
        ),
        size: 50,
        minSize: 50,
        maxSize: 50,
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
        size: 400,
        minSize: 200,
      },
      {
        accessorKey: 'bankName',
        header: 'Bank',
        size: 150,
        minSize: 120,
        maxSize: 150,
      },
      {
        accessorKey: 'accountId',
        header: 'Account',
        size: 180,
        minSize: 150,
        maxSize: 200,
      },
      {
        accessorKey: 'type',
        header: 'Type',
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
        size: 150,
        minSize: 130,
        maxSize: 150,
      },
      {
        id: 'actions',
        header: '',
        size: 60,
        minSize: 60,
        maxSize: 60,
      },
    ],
    [],
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
      // Reset "select all matching" when selection changes manually
      if (selectAllMatching) {
        setSelectAllMatching(false);
      }
    },
    getRowId: (row) => row.id.toString(),
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      dispatch(setTransactionTableSorting(newSorting));
    },
    onPaginationChange: (updater) => {
      const currentPagination = { pageIndex, pageSize };
      const newPagination = typeof updater === 'function' ? updater(currentPagination) : updater;
      dispatch(setTransactionTablePageIndex(newPagination.pageIndex));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
    autoResetPageIndex: false,
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    dispatch(setTransactionTablePageIndex(0));
  }, [
    globalFilter,
    dateFilter,
    bankNameFilter,
    accountIdFilter,
    typeFilter,
    amountFilter,
    dispatch,
  ]);

  const hasActiveFilters =
    dateFilter?.from ||
    dateFilter?.to ||
    globalFilter ||
    bankNameFilter ||
    accountIdFilter ||
    typeFilter ||
    amountFilter.min !== null ||
    amountFilter.max !== null;

  const handleDateChange = useCallback(
    (from: string | null, to: string | null) => {
      // Update Redux for internal state
      dispatch(setTransactionTableDateFilter({ from, to }));
      // Update URL for bookmarkability (if callback provided)
      if (onDateFilterChange) {
        onDateFilterChange(from, to);
      }
    },
    [dispatch, onDateFilterChange],
  );

  const handleBankNameChange = useCallback(
    (bankName: string) => {
      const value = bankName === 'all' ? null : bankName;
      dispatch(setTransactionTableBankNameFilter(value));
      onBankNameFilterChange?.(value);
    },
    [dispatch, onBankNameFilterChange],
  );

  const handleAccountIdChange = useCallback(
    (accountId: string) => {
      const value = accountId === 'all' ? null : accountId;
      dispatch(setTransactionTableAccountIdFilter(value));
      onAccountIdFilterChange?.(value);
    },
    [dispatch, onAccountIdFilterChange],
  );

  const handleTypeChange = useCallback(
    (type: string) => {
      const value = type === 'all' ? null : (type as TransactionType);
      dispatch(setTransactionTableTypeFilter(value));
      onTypeFilterChange?.(value);
    },
    [dispatch, onTypeFilterChange],
  );

  const handleClearFilters = useCallback(() => {
    // Clear local state
    setLocalSearchValue('');
    setLocalMinAmount('');
    setLocalMaxAmount('');

    // Clear Redux state
    dispatch(setTransactionTableGlobalFilter(''));
    dispatch(setTransactionTableDateFilter({ from: null, to: null }));
    dispatch(setTransactionTableBankNameFilter(null));
    dispatch(setTransactionTableAccountIdFilter(null));
    dispatch(setTransactionTableTypeFilter(null));
    dispatch(setTransactionTableAmountFilter({ min: null, max: null }));

    // Clear all URL params at once (avoids race conditions)
    onClearAllFilters?.();
  }, [dispatch, onClearAllFilters]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`"exact phrase" term1 term2 ↵`}
            value={localSearchValue}
            onChange={(e) => setLocalSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 pr-9"
          />
          {localSearchValue && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <DateRangeFilter
          from={dateFilter?.from || null}
          to={dateFilter?.to || null}
          onChange={handleDateChange}
        />
        {availableBankNames.length > 1 && (
          <Select value={bankNameFilter ?? 'all'} onValueChange={handleBankNameChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Banks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Banks</SelectItem>
              {availableBankNames.map((bank) => (
                <SelectItem key={bank} value={bank}>
                  {bank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {availableAccountIds.length > 1 && (
          <Select value={accountIdFilter ?? 'all'} onValueChange={handleAccountIdChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {availableAccountIds.map((account) => (
                <SelectItem key={account} value={account}>
                  {account}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={typeFilter ?? 'all'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[100px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="DEBIT">Debit</SelectItem>
            <SelectItem value="CREDIT">Credit</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="Min"
            value={localMinAmount}
            onChange={(e) => setLocalMinAmount(e.target.value)}
            className="w-[80px]"
            min="0"
            step="0.01"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max"
            value={localMaxAmount}
            onChange={(e) => setLocalMaxAmount(e.target.value)}
            className="w-[80px]"
            min="0"
            step="0.01"
          />
        </div>
        {/* Filter Actions - visual separator and action buttons */}
        {hasActiveFilters && (
          <>
            <div className="mx-1 h-6 w-px bg-border" />
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-9 px-3">
              <X className="mr-1.5 h-4 w-4" />
              Clear
            </Button>
            {viewCriteria && <SaveAsViewButton criteria={viewCriteria} />}
          </>
        )}
      </div>

      {/* Select all matching banner */}
      {table.getIsAllPageRowsSelected() && transactions.length > pageSize && !selectAllMatching && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
          <span>
            All {Math.min(pageSize, transactions.length)} transactions on this page are selected.
          </span>
          <button
            onClick={handleSelectAllMatching}
            className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Select all {transactions.length} transactions matching this filter
          </button>
        </div>
      )}

      {/* Confirmation banner when all matching are selected */}
      {selectAllMatching && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
          <span>All {transactions.length} transactions matching this filter are selected.</span>
          <button
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
            {table.getRowModel().rows?.length ? (
              table
                .getRowModel()
                .rows.map((row) => (
                  <EditableTransactionRow
                    key={row.id}
                    transaction={row.original}
                    displayCurrency={displayCurrency}
                    exchangeRatesMap={exchangeRatesMap}
                    isExchangeRatesLoading={isExchangeRatesLoading}
                    onSave={handleSaveTransaction}
                    onDelete={handleDeleteTransaction}
                    onRowClick={handleRowClick}
                    isUpdating={isUpdating}
                    columnWidthClasses={table
                      .getAllColumns()
                      .map((col) => columnWidthClass(col.getSize()))}
                    isSelected={row.getIsSelected()}
                    onSelectionChange={(checked) => row.toggleSelected(checked)}
                  />
                ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No transactions found.
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

      {/* Delete Confirmation Dialog */}
      <DeleteTransactionModal
        transaction={transactionToDelete}
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        displayCurrency={displayCurrency}
        exchangeRatesMap={exchangeRatesMap}
      />

      {/* Bulk Delete Bar */}
      <BulkDeleteBar
        selectedCount={idsToDelete.length}
        onDelete={handleBulkDelete}
        onClearSelection={handleClearSelection}
        isVisible={selectedIds.length > 0 || selectAllMatching}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteModal
        selectedIds={idsToDelete}
        isOpen={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        onSuccess={handleBulkDeleteSuccess}
      />
    </div>
  );
}
