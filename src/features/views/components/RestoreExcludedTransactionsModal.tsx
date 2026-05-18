import { useCallback, useMemo } from 'react';
import { Eye } from 'lucide-react';
import type { SavedView } from '@/types/view';
import type { Transaction } from '@/types/transaction';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useExcludedViewTransactions, useUnexcludeTransaction } from '@/hooks/useViews';
import { toast } from '@/hooks/useToast';
import { compareLocalDates, formatLocalDate } from '@/utils/dates';
import { formatCurrency } from '@/utils/currency';
import { formatApiError } from '@/utils/errorMessages';

interface RestoreExcludedTransactionsModalProps {
  open: boolean;
  onClose: () => void;
  view: SavedView;
}

export function RestoreExcludedTransactionsModal({
  open,
  onClose,
  view,
}: RestoreExcludedTransactionsModalProps) {
  const {
    data: excludedTransactions,
    isLoading,
    error,
    refetch,
  } = useExcludedViewTransactions(view.id);
  const { mutate: unexcludeTransaction, isPending: isRestoring } = useUnexcludeTransaction();

  const sortedTransactions = useMemo<Transaction[]>(() => {
    return [...(excludedTransactions ?? [])].sort((a, b) => compareLocalDates(b.date, a.date));
  }, [excludedTransactions]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !isRestoring) {
        onClose();
      }
    },
    [isRestoring, onClose],
  );

  const handleClose = useCallback(() => {
    if (!isRestoring) {
      onClose();
    }
  }, [isRestoring, onClose]);

  const handleRestore = useCallback(
    (txnId: number) => {
      unexcludeTransaction(
        { viewId: view.id, txnId },
        {
          onSuccess: () => {
            toast.success('Transaction restored to view');
          },
          onError: (restoreError) => {
            toast.error(formatApiError(restoreError, 'Failed to restore transaction'));
          },
        },
      );
    },
    [unexcludeTransaction, view.id],
  );

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Restore Excluded Transactions</DialogTitle>
          <DialogDescription>
            Restore transactions that were explicitly excluded from &ldquo;{view.name}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center">
            <LoadingSpinner text="Loading excluded transactions..." />
          </div>
        ) : error ? (
          <ErrorBanner error={error} onRetry={handleRetry} />
        ) : (
          <div className="-mx-6 flex-1 overflow-y-auto px-6 pt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[140px]">Bank</TableHead>
                    <TableHead className="w-[120px] text-right">Amount</TableHead>
                    <TableHead className="w-[120px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTransactions.length > 0 ? (
                    sortedTransactions.map((transaction) => (
                      <RestoreExcludedTransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        isRestoring={isRestoring}
                        onRestore={handleRestore}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No excluded transactions.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose} disabled={isRestoring}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RestoreExcludedTransactionRowProps {
  transaction: Transaction;
  isRestoring: boolean;
  onRestore: (txnId: number) => void;
}

function RestoreExcludedTransactionRow({
  transaction,
  isRestoring,
  onRestore,
}: RestoreExcludedTransactionRowProps) {
  const handleRestoreClick = useCallback(() => {
    onRestore(transaction.id);
  }, [onRestore, transaction.id]);

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{formatLocalDate(transaction.date)}</TableCell>
      <TableCell className="max-w-[320px] truncate">{transaction.description}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{transaction.bankName}</TableCell>
      <TableCell className="text-right font-mono text-sm">
        {formatCurrency(transaction.amount, transaction.currencyIsoCode)}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" onClick={handleRestoreClick} disabled={isRestoring}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Restore
        </Button>
      </TableCell>
    </TableRow>
  );
}
