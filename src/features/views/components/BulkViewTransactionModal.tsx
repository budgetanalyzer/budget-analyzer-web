import { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useBulkExcludeTransactions, useBulkPinTransactions } from '@/hooks/useViews';
import { toast } from '@/hooks/useToast';
import { formatApiError } from '@/utils/errorMessages';

export type BulkViewTransactionAction = 'pin' | 'exclude';

interface BulkViewTransactionModalProps {
  viewId: string;
  selectedIds: number[];
  action: BulkViewTransactionAction;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const actionCopy = {
  pin: {
    title: 'Pin Transactions',
    verb: 'pin',
    preposition: 'to',
    progressive: 'Pinning',
    confirmation: 'Pin',
    success: 'Pinned',
    failure: 'Failed to pin transactions',
    description: 'Pinned transactions stay in the view regardless of filters.',
  },
  exclude: {
    title: 'Exclude Transactions',
    verb: 'exclude',
    preposition: 'from',
    progressive: 'Excluding',
    confirmation: 'Exclude',
    success: 'Excluded',
    failure: 'Failed to exclude transactions',
    description: 'Excluded transactions can be restored from Manage Transactions.',
  },
} satisfies Record<
  BulkViewTransactionAction,
  {
    title: string;
    verb: string;
    preposition: string;
    progressive: string;
    confirmation: string;
    success: string;
    failure: string;
    description: string;
  }
>;

export function BulkViewTransactionModal({
  viewId,
  selectedIds,
  action,
  isOpen,
  onOpenChange,
  onSuccess,
}: BulkViewTransactionModalProps) {
  const { mutate: bulkPin, isPending: isPinning } = useBulkPinTransactions();
  const { mutate: bulkExclude, isPending: isExcluding } = useBulkExcludeTransactions();
  const isPending = isPinning || isExcluding;
  const copy = actionCopy[action];

  const handleConfirm = useCallback(() => {
    if (selectedIds.length === 0) return;

    const mutate = action === 'pin' ? bulkPin : bulkExclude;

    mutate(
      { viewId, ids: selectedIds },
      {
        onSuccess: ({ updatedCount, notFoundIds }) => {
          const totalCount = selectedIds.length;

          if (updatedCount === 0) {
            toast.error(copy.failure);
          } else if (notFoundIds.length > 0) {
            toast.warning(
              `${copy.success} ${updatedCount} of ${totalCount}. ${notFoundIds.length} not found or unavailable.`,
            );
          } else {
            toast.success(
              `${copy.success} ${updatedCount} transaction${updatedCount !== 1 ? 's' : ''}`,
            );
          }

          onOpenChange(false);
          onSuccess();
        },
        onError: (error) => {
          toast.error(formatApiError(error, copy.failure));
        },
      },
    );
  }, [action, bulkExclude, bulkPin, copy, onOpenChange, onSuccess, selectedIds, viewId]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isPending && onOpenChange(open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {copy.confirmation} {selectedIds.length} transaction
            {selectedIds.length !== 1 ? 's' : ''} {copy.preposition} this view? {copy.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={action === 'exclude' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isPending || selectedIds.length === 0}
          >
            {isPending ? `${copy.progressive}...` : copy.confirmation}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
