// src/features/transactions/components/DeleteTransactionModal.tsx
import { useCallback, useState } from 'react';
import { MessageBanner } from '@/components/MessageBanner';
import { Transaction } from '@/types/transaction';
import type { DisplayAmount } from '@/types/displayAmount';
import { formatCurrency } from '@/utils/currency';
import { formatLocalDate } from '@/utils/dates';
import { formatApiError } from '@/utils/errorMessages';
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

interface DeleteTransactionModalProps {
  transaction: Transaction | null;
  displayAmount: DisplayAmount | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

const DELETE_FAILURE_MESSAGE = 'Failed to delete transaction';

export function DeleteTransactionModal({
  transaction,
  displayAmount,
  isOpen,
  onOpenChange,
  onDeleted,
}: DeleteTransactionModalProps) {
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction();
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);

  const handleDismissMutationError = useCallback(() => {
    setMutationErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    setMutationErrorMessage(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleCancel = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleDelete = useCallback(() => {
    if (!transaction) return;

    setMutationErrorMessage(null);
    deleteTransaction(transaction.id, {
      onSuccess: () => {
        handleClose();
        onDeleted?.();
      },
      onError: (error) => {
        setMutationErrorMessage(formatApiError(error, DELETE_FAILURE_MESSAGE));
      },
    });
  }, [deleteTransaction, handleClose, onDeleted, transaction]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) onOpenChange(true);
      else handleClose();
    },
    [handleClose, onOpenChange],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
        {mutationErrorMessage && (
          <div className="mt-4">
            <MessageBanner
              type="error"
              message={mutationErrorMessage}
              onClose={handleDismissMutationError}
            />
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
