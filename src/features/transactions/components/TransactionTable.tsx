// src/features/transactions/components/TransactionTable.tsx
import { useCallback, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  ColumnDef,
  flexRender,
  RowSelectionState,
  SortingState,
} from '@tanstack/react-table';
import { Transaction, type TransactionType } from '@/types/transaction';
import type { TransactionFilterValues } from '@/types/transactionFilters';
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
import { DeleteTransactionModal } from '@/features/transactions/components/DeleteTransactionModal';
import { EditableTransactionRow } from '@/features/transactions/components/EditableTransactionRow';
import { BulkDeleteBar } from '@/features/transactions/components/BulkDeleteBar';
import { BulkDeleteModal } from '@/features/transactions/components/BulkDeleteModal';
import { SaveAsViewButton } from '@/components/SaveAsViewButton';
import { ViewCriteriaApi } from '@/types/view';
import { Checkbox } from '@/components/ui/Checkbox';
import { compareLocalDates } from '@/utils/dates';
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { formatApiError } from '@/utils/errorMessages';
import { toast } from '@/hooks/useToast';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { columnWidthClass } from '@/utils/columnWidth';
import { TransactionFilterBar } from '@/components/TransactionFilterBar';

interface TransactionTableProps {
  transactions: Transaction[];
  filters: TransactionFilterValues;
  onDateFilterChange: (from: string | null, to: string | null) => void;
  onSearchChange: (query: string) => void;
  onBankNameFilterChange: (bankName: string | null) => void;
  onAccountIdFilterChange: (accountId: string | null) => void;
  onTypeFilterChange: (type: TransactionType | null) => void;
  onAmountFilterChange: (min: number | null, max: number | null) => void;
  onClearAllFilters: () => void;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isExchangeRatesLoading: boolean;
  availableBankNames: string[];
  availableAccountIds: string[];
  viewCriteria?: ViewCriteriaApi;
}

export function TransactionTable({
  transactions,
  filters,
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
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const navigate = useNavigate();
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();
  const canBulkDelete = usePermission('transactions:delete');
  const canEditTransactions = usePermission('transactions:write');

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
  const columns = useMemo<ColumnDef<Transaction>[]>(() => {
    const selectColumn: ColumnDef<Transaction> = {
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
    };
    return [
      ...(canBulkDelete ? [selectColumn] : []),
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
    ];
  }, [canBulkDelete]);

  const table = useReactTable({
    data: transactions,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
    },
    enableRowSelection: canBulkDelete,
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
      setSorting(newSorting);
    },
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
      setPagination(newPagination);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
    autoResetPageIndex: true,
  });

  return (
    <div className="space-y-4">
      <TransactionFilterBar
        filters={filters}
        availableBankNames={availableBankNames}
        availableAccountIds={availableAccountIds}
        onDateFilterChange={onDateFilterChange}
        onSearchChange={onSearchChange}
        onBankNameFilterChange={onBankNameFilterChange}
        onAccountIdFilterChange={onAccountIdFilterChange}
        onTypeFilterChange={onTypeFilterChange}
        onAmountFilterChange={onAmountFilterChange}
        onClearAllFilters={onClearAllFilters}
        contextualAction={viewCriteria ? <SaveAsViewButton criteria={viewCriteria} /> : undefined}
      />

      {/* Select all matching banner */}
      {canBulkDelete &&
        table.getIsAllPageRowsSelected() &&
        transactions.length > pagination.pageSize &&
        !selectAllMatching && (
          <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
            <span>
              All {Math.min(pagination.pageSize, transactions.length)} transactions on this page are
              selected.
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
      {canBulkDelete && selectAllMatching && (
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
                    columnWidths={Object.fromEntries(
                      table.getAllColumns().map((col) => [col.id, columnWidthClass(col.getSize())]),
                    )}
                    canSelect={canBulkDelete}
                    canEdit={canEditTransactions}
                    canDelete={canBulkDelete}
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
        isVisible={canBulkDelete && (selectedIds.length > 0 || selectAllMatching)}
      />

      {/* Bulk Delete Confirmation Dialog */}
      {canBulkDelete && (
        <BulkDeleteModal
          selectedIds={idsToDelete}
          isOpen={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          onSuccess={handleBulkDeleteSuccess}
        />
      )}
    </div>
  );
}
