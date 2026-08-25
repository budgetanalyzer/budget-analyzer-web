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
  type Updater,
} from '@tanstack/react-table';
import { Transaction, type TransactionType } from '@/types/transaction';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import type { DisplayAmount } from '@/types/displayAmount';
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
import { createAddViewTransactionsRequest, useUpdateViewTransactions } from '@/hooks/useViews';

export type TransactionSelectionPurpose =
  | { type: 'delete' }
  | {
      type: 'add-to-view';
      viewId: string;
      viewName: string;
      memberTransactionIds: number[];
      onCancel: () => void;
      onSuccess: () => void;
    };

type TransactionTableRow = Transaction & {
  displayAmount: DisplayAmount;
};

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
  displayAmounts: ReadonlyMap<number, DisplayAmount>;
  isDisplayAmountLoading: boolean;
  isAmountFilterLoading: boolean;
  unavailableAmountFilterCount: number;
  availableBankNames: string[];
  availableAccountIds: string[];
  viewTransactionIds?: number[];
  isViewTransactionIdsReady?: boolean;
  selectionPurpose: TransactionSelectionPurpose;
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
  displayAmounts,
  isDisplayAmountLoading,
  isAmountFilterLoading,
  unavailableAmountFilterCount,
  availableBankNames,
  availableAccountIds,
  viewTransactionIds,
  isViewTransactionIdsReady = true,
  selectionPurpose,
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
  const {
    mutate: addTransactionsToView,
    isPending: isAddingTransactions,
    error: addTransactionsError,
    reset: resetAddTransactions,
  } = useUpdateViewTransactions();
  const canBulkDelete = usePermission('transactions:delete');
  const canAddToView = usePermission('views:write');
  const canEditTransactions = usePermission('transactions:write');
  const canCreateViews = usePermission('views:write');
  const addSelectionPurpose = selectionPurpose.type === 'add-to-view' ? selectionPurpose : null;
  const isAddToViewPurpose = addSelectionPurpose !== null;
  const selectionEnabled = isAddToViewPurpose ? canAddToView : canBulkDelete;
  const existingMemberIds = useMemo(
    () => new Set(addSelectionPurpose?.memberTransactionIds ?? []),
    [addSelectionPurpose],
  );

  const tableRows = useMemo<TransactionTableRow[]>(
    () =>
      transactions.map((transaction) => ({
        ...transaction,
        displayAmount: displayAmounts.get(transaction.id)!,
      })),
    [displayAmounts, transactions],
  );

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
    return Array.from(
      new Set(
        Object.keys(rowSelection)
          .filter((key) => rowSelection[key])
          .map((key) => Number.parseInt(key, 10))
          .filter((id) => !existingMemberIds.has(id)),
      ),
    );
  }, [existingMemberIds, rowSelection]);

  // Get all filtered transaction IDs (for "select all matching" mode)
  const allFilteredIds = useMemo(() => {
    return Array.from(
      new Set(
        transactions
          .map((transaction) => transaction.id)
          .filter((id) => !existingMemberIds.has(id)),
      ),
    );
  }, [existingMemberIds, transactions]);

  const selectedPurposeIds = selectAllMatching ? allFilteredIds : selectedIds;

  // Handle bulk delete
  const handleBulkDelete = useCallback(() => {
    setBulkDeleteDialogOpen(true);
  }, []);

  const handleBulkDeleteSuccess = useCallback(() => {
    setRowSelection({});
    setSelectAllMatching(false);
  }, []);

  const resetAddTransactionsAfterSelectionChange = useCallback(() => {
    if (!isAddingTransactions) {
      resetAddTransactions();
    }
  }, [isAddingTransactions, resetAddTransactions]);

  const handleClearSelection = useCallback(() => {
    setRowSelection({});
    setSelectAllMatching(false);
    resetAddTransactionsAfterSelectionChange();
  }, [resetAddTransactionsAfterSelectionChange]);

  const handleSelectAllMatching = useCallback(() => {
    setSelectAllMatching(true);
    resetAddTransactionsAfterSelectionChange();
  }, [resetAddTransactionsAfterSelectionChange]);

  const handleAddTransactions = useCallback(() => {
    if (!addSelectionPurpose || selectedPurposeIds.length === 0) {
      return;
    }

    addTransactionsToView(
      {
        viewId: addSelectionPurpose.viewId,
        request: createAddViewTransactionsRequest(selectedPurposeIds),
      },
      {
        onSuccess: () => {
          setRowSelection({});
          setSelectAllMatching(false);
          addSelectionPurpose.onSuccess();
        },
      },
    );
  }, [addSelectionPurpose, addTransactionsToView, selectedPurposeIds]);

  // Define columns for TanStack Table
  // Note: Cell rendering is handled by EditableTransactionRow, not by these column definitions
  // These columns are only used for: headers, sorting configuration, and column widths
  const columns = useMemo<ColumnDef<TransactionTableRow>[]>(() => {
    const selectColumn: ColumnDef<TransactionTableRow> = {
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
          aria-label={
            isAddToViewPurpose
              ? 'Select eligible transactions on this page'
              : 'Select transactions on this page for deletion'
          }
        />
      ),
      size: 50,
      minSize: 50,
      maxSize: 50,
    };
    return [
      {
        id: 'amountAvailability',
        accessorFn: (row) => (row.displayAmount.available ? 0 : 1),
        sortingFn: 'basic',
      },
      ...(selectionEnabled ? [selectColumn] : []),
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
        id: 'amount',
        accessorFn: (row) => (row.displayAmount.available ? row.displayAmount.value : 0),
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
        sortingFn: (rowA, rowB) => {
          const amountA = rowA.original.displayAmount;
          const amountB = rowB.original.displayAmount;
          if (amountA.available && amountB.available && amountA.value !== amountB.value) {
            return amountA.value - amountB.value;
          }

          const dateComparison = compareLocalDates(rowA.original.date, rowB.original.date);
          return dateComparison !== 0 ? dateComparison : rowA.original.id - rowB.original.id;
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
  }, [isAddToViewPurpose, selectionEnabled]);

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
    setPagination((currentPagination) => ({ ...currentPagination, pageIndex: 0 }));
  }, []);

  const table = useReactTable({
    data: tableRows,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnVisibility: { amountAvailability: false },
    },
    enableRowSelection: (row) => selectionEnabled && !existingMemberIds.has(row.original.id),
    onRowSelectionChange: (updater) => {
      const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(newSelection);
      resetAddTransactionsAfterSelectionChange();
      // Reset "select all matching" when selection changes manually
      if (selectAllMatching) {
        setSelectAllMatching(false);
      }
    },
    getRowId: (row) => row.id.toString(),
    onSortingChange: handleSortingChange,
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
        contextualAction={
          !isAddToViewPurpose && canCreateViews && viewTransactionIds !== undefined ? (
            <SaveAsViewButton
              transactionIds={viewTransactionIds}
              isTransactionIdsReady={isViewTransactionIdsReady}
            />
          ) : undefined
        }
      />

      {unavailableAmountFilterCount > 0 && (
        <div className="rounded-md bg-warning/15 px-4 py-3 text-sm text-warning" role="status">
          {unavailableAmountFilterCount}{' '}
          {unavailableAmountFilterCount === 1 ? 'transaction was' : 'transactions were'} excluded
          because conversion to {displayCurrency} is unavailable.
        </div>
      )}

      {/* Select all matching banner */}
      {selectionEnabled &&
        table.getIsAllPageRowsSelected() &&
        allFilteredIds.length >
          table.getRowModel().rows.filter((row) => row.getCanSelect()).length &&
        !selectAllMatching && (
          <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
            <span>
              All {table.getRowModel().rows.filter((row) => row.getCanSelect()).length}{' '}
              {isAddToViewPurpose ? 'eligible ' : ''}transactions on this page are selected.
            </span>
            <button
              onClick={handleSelectAllMatching}
              className="font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Select all {allFilteredIds.length} {isAddToViewPurpose ? 'eligible ' : ''}
              transactions matching this filter
            </button>
          </div>
        )}

      {/* Confirmation banner when all matching are selected */}
      {selectionEnabled && selectAllMatching && (
        <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-800 dark:bg-blue-950">
          <span>
            All {allFilteredIds.length} {isAddToViewPurpose ? 'eligible ' : ''}transactions matching
            this filter are selected.
          </span>
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
            {isAmountFilterLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading filtered amounts...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table
                .getRowModel()
                .rows.map((row) => (
                  <EditableTransactionRow
                    key={row.id}
                    transaction={row.original}
                    displayAmount={row.original.displayAmount}
                    isAmountLoading={isDisplayAmountLoading}
                    onSave={handleSaveTransaction}
                    onDelete={handleDeleteTransaction}
                    onRowClick={handleRowClick}
                    isUpdating={isUpdating}
                    columnWidths={Object.fromEntries(
                      table.getAllColumns().map((col) => [col.id, columnWidthClass(col.getSize())]),
                    )}
                    canSelect={selectionEnabled}
                    canEdit={canEditTransactions}
                    canDelete={canBulkDelete}
                    isSelected={row.getCanSelect() && row.getIsSelected()}
                    selectionDisabled={!row.getCanSelect()}
                    selectionLabel={
                      isAddToViewPurpose
                        ? row.getCanSelect()
                          ? `Select transaction ${row.original.id} to add to ${addSelectionPurpose?.viewName}`
                          : `Transaction ${row.original.id} is already in ${addSelectionPurpose?.viewName}`
                        : `Select transaction ${row.original.id} for deletion`
                    }
                    selectionStatus={
                      isAddToViewPurpose && !row.getCanSelect() ? 'Already in view' : undefined
                    }
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

      {!isAmountFilterLoading && table.getRowModel().rows.length > 0 && (
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
        displayAmount={
          transactionToDelete ? (displayAmounts.get(transactionToDelete.id) ?? null) : null
        }
        isOpen={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />

      {/* Bulk Delete Bar */}
      <BulkDeleteBar
        selectedCount={selectedPurposeIds.length}
        onDelete={handleBulkDelete}
        onClearSelection={handleClearSelection}
        isVisible={
          !isAddToViewPurpose && canBulkDelete && (selectedIds.length > 0 || selectAllMatching)
        }
      />

      {isAddToViewPurpose && addTransactionsError && (
        <div
          className="rounded-md bg-destructive/15 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {addTransactionsError.response.code === 'SAVED_VIEW_MEMBERSHIP_STALE'
            ? 'The transaction snapshot changed. Membership and transactions were refreshed; review your selection before submitting again.'
            : formatApiError(addTransactionsError, 'Failed to add transactions to this view')}
        </div>
      )}

      {addSelectionPurpose && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background px-4 py-3">
          <span className="text-sm font-medium">
            {selectedPurposeIds.length} transaction
            {selectedPurposeIds.length === 1 ? '' : 's'} selected to add
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={addSelectionPurpose.onCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleAddTransactions}
              disabled={
                selectedPurposeIds.length === 0 ||
                isAmountFilterLoading ||
                isAddingTransactions ||
                addTransactionsError?.response.code === 'SAVED_VIEW_MEMBERSHIP_STALE'
              }
            >
              {isAddingTransactions ? 'Adding...' : 'Add transactions'}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {!isAddToViewPurpose && canBulkDelete && (
        <BulkDeleteModal
          selectedIds={selectedPurposeIds}
          isOpen={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          onSuccess={handleBulkDeleteSuccess}
        />
      )}
    </div>
  );
}
