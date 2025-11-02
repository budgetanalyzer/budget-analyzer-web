// src/components/TransactionTable.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
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
import { Badge } from '@/components/ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { convertCurrency } from '@/lib/currency';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { toast } from 'sonner';
import { DateRangeFilter } from './DateRangeFilter';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import {
  setTransactionTableSorting,
  setTransactionTablePageIndex,
  setTransactionTableGlobalFilter,
  setTransactionTableDateFilter,
} from '@/store/uiSlice';

interface TransactionTableProps {
  transactions: Transaction[];
  onFilteredRowsChange?: (filteredTransactions: Transaction[]) => void;
  displayCurrency: string;
  exchangeRatesMap: Map<string, ExchangeRateResponse>;
}

export function TransactionTable({
  transactions,
  onFilteredRowsChange,
  displayCurrency,
  exchangeRatesMap,
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
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction();

  // Debounce search input: update Redux state 400ms after user stops typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch(setTransactionTableGlobalFilter(localSearchValue));
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [localSearchValue, dispatch]);

  // Sync local state when Redux state changes externally (e.g., clear filters button)
  useEffect(() => {
    setLocalSearchValue(globalFilter ?? '');
  }, [globalFilter]);

  // Apply date filtering to transactions
  const filteredByDate = useMemo(() => {
    if (!dateFilter?.from && !dateFilter?.to) {
      return transactions;
    }

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      const fromDate = dateFilter.from ? new Date(dateFilter.from) : null;
      const toDate = dateFilter.to ? new Date(dateFilter.to) : null;

      if (fromDate && transactionDate < fromDate) {
        return false;
      }
      if (toDate && transactionDate > toDate) {
        return false;
      }
      return true;
    });
  }, [transactions, dateFilter]);

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
        cell: ({ row }) => formatDate(row.getValue('date')),
        sortingFn: (rowA, rowB) => {
          const dateA = new Date(rowA.getValue('date') as string);
          const dateB = new Date(rowB.getValue('date') as string);
          return dateA.getTime() - dateB.getTime();
        },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => <div className="max-w-md truncate">{row.getValue('description')}</div>,
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
        cell: ({ row }) => (
          <Badge variant={row.getValue('type') === 'CREDIT' ? 'success' : 'secondary'}>
            {row.getValue('type')}
          </Badge>
        ),
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
        cell: ({ row }) => {
          const amount = row.getValue('amount') as number;
          const sourceCurrency = row.original.currencyIsoCode;
          const transactionDate = row.original.date;
          const isCredit = row.original.type === 'CREDIT';

          // Convert amount to display currency
          const convertedAmount = convertCurrency(
            amount,
            transactionDate,
            sourceCurrency,
            displayCurrency,
            exchangeRatesMap,
          );

          // Show badge if currency was converted
          const needsConversion = sourceCurrency !== displayCurrency;

          return (
            <div className="flex items-center justify-end gap-2">
              <div
                className={`text-right font-semibold ${
                  isCredit ? 'text-green-600 dark:text-green-400' : 'text-foreground'
                }`}
              >
                {formatCurrency(convertedAmount, displayCurrency)}
              </div>
              {needsConversion && (
                <Badge variant="outline" className="text-xs">
                  {sourceCurrency}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const transaction = row.original;

          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-transparent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Edit transaction:', transaction.id);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    destructive
                    onClick={(e) => {
                      e.stopPropagation();
                      setTransactionToDelete(transaction);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [displayCurrency, exchangeRatesMap],
  );

  const table = useReactTable({
    data: filteredByDate,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onSortingChange: (updater) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      dispatch(setTransactionTableSorting(newSorting));
    },
    onGlobalFilterChange: (updater) => {
      const newFilter = typeof updater === 'function' ? updater(globalFilter) : updater;
      dispatch(setTransactionTableGlobalFilter(newFilter));
    },
    onPaginationChange: (updater) => {
      const currentPagination = { pageIndex, pageSize };
      const newPagination = typeof updater === 'function' ? updater(currentPagination) : updater;
      dispatch(setTransactionTablePageIndex(newPagination.pageIndex));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
    autoResetPageIndex: false,
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    dispatch(setTransactionTablePageIndex(0));
  }, [globalFilter, dateFilter, dispatch]);

  // Notify parent of filtered rows whenever they change
  useEffect(() => {
    if (onFilteredRowsChange) {
      const filteredRows = table.getFilteredRowModel().rows.map((row) => row.original);
      onFilteredRowsChange(filteredRows);
    }
  }, [table, onFilteredRowsChange, globalFilter, filteredByDate]);

  const handleDelete = () => {
    if (!transactionToDelete) return;

    deleteTransaction(transactionToDelete.id, {
      onSuccess: () => {
        toast.success('Transaction deleted successfully');
        setDeleteDialogOpen(false);
        setTransactionToDelete(null);
      },
      onError: (error) => {
        const errorMessage = error.message || 'Failed to delete transaction';
        toast.error(errorMessage);
      },
    });
  };

  const hasActiveDateFilters = dateFilter?.from || dateFilter?.to;

  const handleClearAllFilters = () => {
    dispatch(setTransactionTableGlobalFilter(''));
    dispatch(setTransactionTableDateFilter({ from: null, to: null }));
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
          onChange={(from, to) => dispatch(setTransactionTableDateFilter({ from, to }))}
        />
        {hasActiveDateFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAllFilters}
            className="h-9 px-3"
            title="Clear all filters"
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
              table.getRowModel().rows.map((row) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  onClick={() => navigate(`/transactions/${row.original.id}`)}
                  className="cursor-pointer border-b transition-colors data-[state=selected]:bg-muted"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </motion.tr>
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

      {table.getFilteredRowModel().rows.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing{' '}
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length,
            )}{' '}
            of {table.getFilteredRowModel().rows.length} transactions
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
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {transactionToDelete && (
            <div className="my-4 rounded-md bg-muted p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{formatDate(transactionToDelete.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description:</span>
                  <span className="font-medium">{transactionToDelete.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {formatCurrency(
                      transactionToDelete.amount,
                      transactionToDelete.currencyIsoCode,
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
