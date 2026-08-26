// src/features/transactions/components/DeleteTransactionModal.tsx
import { useCallback } from 'react';
import { Transaction } from '@/types/transaction';
import type { DisplayAmount } from '@/types/displayAmount';
import { formatCurrency } from '@/utils/currency';
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
  displayAmount: DisplayAmount | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteTransactionModal({
  transaction,
  displayAmount,
  isOpen,
  onOpenChange,
  onDeleted,
}: DeleteTransactionModalProps) {
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction();

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleDelete = useCallback(() => {
    if (!transaction) return;

    deleteTransaction(transaction.id, {
      onSuccess: () => {
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
          <div className="mt-4 rounded-md bg-muted p-4">
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
                <span className="text-muted-foreground">Native amount:</span>
                <span className="font-medium">
                  {formatCurrency(
                    displayAmount?.sourceMagnitude ?? Math.abs(transaction.amount),
                    transaction.currencyIsoCode,
                  )}{' '}
                  {transaction.currencyIsoCode}
                </span>
              </div>
              {displayAmount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Selected amount:</span>
                  {displayAmount.available ? (
                    <span className="font-medium">
                      {formatCurrency(displayAmount.value, displayAmount.targetCurrency)}{' '}
                      {displayAmount.targetCurrency}
                    </span>
                  ) : (
                    <span className="font-medium text-warning">
                      Conversion to {displayAmount.targetCurrency} unavailable
                    </span>
                  )}
                </div>
              )}
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
