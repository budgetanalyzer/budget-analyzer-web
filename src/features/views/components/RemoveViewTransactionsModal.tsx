import { useCallback } from 'react';
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
import { toast } from '@/hooks/useToast';
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
  const request = createRemoveViewTransactionsRequest(transactionIds);
  const removeCount = request.removeTransactionIds.length;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!isPending) {
        onOpenChange(nextOpen);
      }
    },
    [isPending, onOpenChange],
  );

  const handleCancel = useCallback(() => {
    if (!isPending) {
      onOpenChange(false);
    }
  }, [isPending, onOpenChange]);

  const handleConfirm = useCallback(() => {
    if (removeCount === 0 || isPending) return;

    updateViewTransactions(
      { viewId, request },
      {
        onSuccess: () => {
          toast.success(
            `Removed ${removeCount} transaction${removeCount !== 1 ? 's' : ''} from this view`,
          );
          onOpenChange(false);
          onSuccess();
        },
        onError: (error) => {
          toast.error(formatApiError(error, REMOVE_FAILURE_MESSAGE));
        },
      },
    );
  }, [isPending, onOpenChange, onSuccess, removeCount, request, updateViewTransactions, viewId]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove from view</DialogTitle>
          <DialogDescription>
            Remove {removeCount} transaction{removeCount !== 1 ? 's' : ''} from this view? The
            transaction{removeCount !== 1 ? 's' : ''} will not be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending || removeCount === 0}
          >
            {isPending ? 'Removing...' : 'Remove from view'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
