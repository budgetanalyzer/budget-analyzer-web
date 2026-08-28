// src/features/transactions/components/BulkDeleteModal.tsx
import { useCallback, useState } from 'react';
import { MessageBanner } from '@/components/MessageBanner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useBulkDeleteTransactions } from '@/hooks/useBulkDeleteTransactions';
import { formatApiError } from '@/utils/errorMessages';

interface BulkDeleteModalProps {
  selectedIds: number[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const BULK_DELETE_FAILURE_MESSAGE = 'Failed to delete transactions';

export function BulkDeleteModal({
  selectedIds,
  isOpen,
  onOpenChange,
  onSuccess,
}: BulkDeleteModalProps) {
  const { mutate: bulkDelete, isPending: isDeleting } = useBulkDeleteTransactions();
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);

  const handleDismissMutationError = useCallback(() => {
    setMutationErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    setMutationErrorMessage(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) onOpenChange(true);
      else handleClose();
    },
    [handleClose, onOpenChange],
  );

  const handleCancel = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleDelete = useCallback(() => {
    if (isDeleting || selectedIds.length === 0) return;

    setMutationErrorMessage(null);
    bulkDelete(selectedIds, {
      onSuccess: () => {
        handleClose();
        onSuccess();
      },
      onError: (error) => {
        setMutationErrorMessage(formatApiError(error, BULK_DELETE_FAILURE_MESSAGE));
      },
    });
  }, [bulkDelete, handleClose, isDeleting, onSuccess, selectedIds]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent dismissible={!isDeleting}>
        <DialogHeader>
          <DialogTitle>Delete Transactions</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {selectedIds.length} transaction
            {selectedIds.length !== 1 ? 's' : ''}? This action cannot be undone.
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
