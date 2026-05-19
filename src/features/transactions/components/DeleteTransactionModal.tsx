// src/features/transactions/components/DeleteTransactionModal.tsx
import { useCallback } from 'react';
import { Transaction } from '@/types/transaction';
import { ExchangeRateResponse } from '@/types/currency';
import { convertCurrency, formatCurrency } from '@/utils/currency';
import { formatLocalDate } from '@/utils/dates';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useDeleteTransaction } from '@/hooks/useTransactions';
import { toast } from '@/hooks/useToast';

interface DeleteTransactionModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  onDeleted?: () => void;
}

export function DeleteTransactionModal({
  transaction,
  isOpen,
  onOpenChange,
  displayCurrency,
  exchangeRatesMap,
  onDeleted,
}: DeleteTransactionModalProps) {
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction();

  const convertedAmount = transaction
    ? convertCurrency(
        transaction.amount,
        transaction.date,
        transaction.currencyIsoCode,
        displayCurrency,
        exchangeRatesMap,
      )
    : null;
  const needsOriginalCurrency = transaction?.currencyIsoCode !== displayCurrency;

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleDelete = useCallback(() => {
    if (!transaction) return;

    deleteTransaction(transaction.id, {
      onSuccess: () => {
        toast.success('Transaction deleted successfully');
        onOpenChange(false);
        onDeleted?.();
      },
      onError: (error) => {
        const errorMessage = error.message || 'Failed to delete transaction';
        toast.error(errorMessage);
      },
    });
  }, [deleteTransaction, onDeleted, onOpenChange, transaction]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this transaction? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {transaction && (
          <div className="my-4 rounded-md bg-muted p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-medium">{formatLocalDate(transaction.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description:</span>
                <span className="font-medium">{transaction.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">
                  {formatCurrency(convertedAmount ?? transaction.amount, displayCurrency)}
                  {needsOriginalCurrency && (
                    <span className="text-muted-foreground">
                      {' '}
                      ({formatCurrency(transaction.amount, transaction.currencyIsoCode)})
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
