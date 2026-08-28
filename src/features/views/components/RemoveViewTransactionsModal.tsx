import { useCallback, useState } from 'react';
import { MessageBanner } from '@/components/MessageBanner';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { createRemoveViewTransactionsRequest, useUpdateViewTransactions } from '@/hooks/useViews';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';
import { formatCurrency } from '@/utils/currency';
import { formatLocalDate } from '@/utils/dates';
import { formatApiError } from '@/utils/errorMessages';

interface RemoveViewTransactionsModalProps {
  viewId: string;
  transactionIds: number[];
  transaction: Transaction | null;
  displayAmount: DisplayAmount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const REMOVE_FAILURE_MESSAGE = 'Failed to remove transactions from this view';

export function RemoveViewTransactionsModal({
  viewId,
  transactionIds,
  transaction,
  displayAmount,
  open,
  onOpenChange,
  onSuccess,
}: RemoveViewTransactionsModalProps) {
  const { mutate: updateViewTransactions, isPending } = useUpdateViewTransactions();
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);
  const request = createRemoveViewTransactionsRequest(transactionIds);
  const removeCount = request.removeTransactionIds.length;
  const singleTransaction =
    removeCount === 1 && transaction?.id === request.removeTransactionIds[0] ? transaction : null;

  const handleDismissMutationError = useCallback(() => {
    setMutationErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    setMutationErrorMessage(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) onOpenChange(true);
      else handleClose();
    },
    [handleClose, onOpenChange],
  );

  const handleCancel = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleConfirm = useCallback(() => {
    if (removeCount === 0 || isPending) return;

    setMutationErrorMessage(null);
    updateViewTransactions(
      { viewId, request },
      {
        onSuccess: () => {
          handleClose();
          onSuccess();
        },
        onError: (error) => {
          setMutationErrorMessage(formatApiError(error, REMOVE_FAILURE_MESSAGE));
        },
      },
    );
  }, [handleClose, isPending, onSuccess, removeCount, request, updateViewTransactions, viewId]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent dismissible={!isPending}>
        <DialogHeader>
          <DialogTitle>Remove from view</DialogTitle>
          <DialogDescription>
            Remove {removeCount} transaction{removeCount !== 1 ? 's' : ''} from this view? The
            transaction{removeCount !== 1 ? 's' : ''} will not be deleted.
          </DialogDescription>
        </DialogHeader>
        {singleTransaction && (
          <div className="mt-4 rounded-md bg-muted p-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Date:</dt>
              <dd className="text-right font-medium">{formatLocalDate(singleTransaction.date)}</dd>
              <dt className="text-muted-foreground">Description:</dt>
              <dd className="min-w-0 break-words text-right font-medium">
                {singleTransaction.description}
              </dd>
              <dt className="text-muted-foreground">Native amount:</dt>
              <dd className="text-right font-medium">
                {formatCurrency(
                  displayAmount?.sourceMagnitude ?? Math.abs(singleTransaction.amount),
                  singleTransaction.currencyIsoCode,
                )}{' '}
                {singleTransaction.currencyIsoCode}
              </dd>
              {displayAmount && (
                <>
                  <dt className="text-muted-foreground">Selected amount:</dt>
                  {displayAmount.available ? (
                    <dd className="text-right font-medium">
                      {formatCurrency(displayAmount.value, displayAmount.targetCurrency)}{' '}
                      {displayAmount.targetCurrency}
                    </dd>
                  ) : (
                    <dd className="text-right font-medium text-warning">
                      Conversion to {displayAmount.targetCurrency} unavailable
                    </dd>
                  )}
                </>
              )}
            </dl>
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
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || removeCount === 0}>
            {isPending ? 'Removing...' : 'Remove from view'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
