// src/features/transactions/components/TransactionTable.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import { Transaction } from '@/types/transaction';
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
import { DateRangeFilter } from './DateRangeFilter';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  setTransactionTableSorting,
  setTransactionTablePageIndex,
  setTransactionTableGlobalFilter,
  setTransactionTableDateFilter,
} from '@/store/uiSlice';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { formatApiError } from '@/utils/errorMessages';
import { toast } from 'sonner';

interface TransactionTableProps {
  transactions: Transaction[];
  onDateFilterChange?: (from: string | null, to: string | null) => void;
  onSearchChange?: (query: string) => void;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isExchangeRatesLoading: boolean;
}

export function TransactionTable({
  transactions,
  onDateFilterChange,
  onSearchChange,
  displayCurrency,
  exchangeRatesMap,
  isExchangeRatesLoading,
}: TransactionTableProps) {
  const dispatch = useAppDispatch();
  const sorting = useAppSelector((state) => state.ui.transactionTable.sorting);
  const pageIndex = useAppSelector((state) => state.ui.transactionTable.pageIndex);
  const pageSize = useAppSelector((state) => state.ui.transactionTable.pageSize);
  const globalFilter = useAppSelector((state) => state.ui.transactionTable.globalFilter);
  const dateFilter = useAppSelector((state) => state.ui.transactionTable.dateFilter);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [localSearchValue, setLocalSearchValue] = useState(globalFilter ?? '');
  const navigate = useNavigate();
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();

  // Debounce search input: update Redux state 400ms after user stops typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch(setTransactionTableGlobalFilter(localSearchValue));
      // Update URL for bookmarkability (if callback provided)
      if (onSearchChange) {
        onSearchChange(localSearchValue);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [localSearchValue, dispatch, onSearchChange]);

  // Sync local state when Redux state changes externally (e.g., clear filters button)
  useEffect(() => {
    setLocalSearchValue(globalFilter ?? '');
  }, [globalFilter]);

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

  // Define columns for TanStack Table
  // Note: Cell rendering is handled by EditableTransactionRow, not by these column definitions
  // These columns are only used for: headers, sorting configuration, and column count
  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
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
      },
      {
        accessorKey: 'description',
        header: 'Description',
      },
      {
        accessorKey: 'bankName',
        header: 'Bank',
      },
      {
        accessorKey: 'accountId',
        header: 'Account',
      },
      {
        accessorKey: 'type',
        header: 'Type',
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => {
          return (
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              className="hover:bg-transparent"
            >
              Amount
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          );
        },
      },
      {
        id: 'actions',
        header: '',
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
    },
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
  }, [globalFilter, dateFilter, dispatch]);

  const hasActiveDateFilters = dateFilter?.from || dateFilter?.to;

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

  const handleClearDateFilters = () => {
    dispatch(setTransactionTableDateFilter({ from: null, to: null }));
    // Clear date filter URL params
    if (onDateFilterChange) {
      onDateFilterChange(null, null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={localSearchValue}
            onChange={(e) => setLocalSearchValue(e.target.value)}
            className="pl-9 pr-9"
          />
          {localSearchValue && (
            <button
              onClick={() => setLocalSearchValue('')}
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
        {hasActiveDateFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearDateFilters}
            className="h-9 px-3"
            title="Clear date filters"
          >
            <X className="mr-1.5 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
    </div>
  );
}
