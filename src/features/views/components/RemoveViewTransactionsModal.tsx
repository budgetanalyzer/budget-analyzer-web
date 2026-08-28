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
import { formatApiError } from '@/utils/errorMessages';

interface RemoveViewTransactionsModalProps {
  viewId: string;
  transactionIds: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const REMOVE_FAILURE_MESSAGE = 'Failed to remove transactions from this view';

export function RemoveViewTransactionsModal({
  viewId,
  transactionIds,
  open,
  onOpenChange,
  onSuccess,
}: RemoveViewTransactionsModalProps) {
  const { mutate: updateViewTransactions, isPending } = useUpdateViewTransactions();
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);
  const request = createRemoveViewTransactionsRequest(transactionIds);
  const removeCount = request.removeTransactionIds.length;

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
