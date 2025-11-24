// src/features/transactions/components/BulkDeleteModal.tsx
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
import { toast } from 'sonner';

interface BulkDeleteModalProps {
  selectedIds: number[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkDeleteModal({
  selectedIds,
  isOpen,
  onOpenChange,
  onSuccess,
}: BulkDeleteModalProps) {
  const { mutate: bulkDelete, isPending: isDeleting } = useBulkDeleteTransactions();

  const handleDelete = () => {
    bulkDelete(selectedIds, {
      onSuccess: (result) => {
        const { deletedCount, notFoundIds } = result;
        const totalCount = selectedIds.length;

        if (notFoundIds.length === 0) {
          // All deleted successfully
          toast.success(
            `Successfully deleted ${deletedCount} transaction${deletedCount !== 1 ? 's' : ''}`,
          );
        } else if (deletedCount > 0) {
          // Partial success
          toast.warning(
            `Deleted ${deletedCount} of ${totalCount}. ${notFoundIds.length} not found or already deleted.`,
          );
        } else {
          // All failed
          toast.error('Failed to delete transactions');
        }

        onOpenChange(false);
        onSuccess();
      },
      onError: (error) => {
        const errorMessage = error.message || 'Failed to delete transactions';
        toast.error(errorMessage);
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isDeleting && onOpenChange(open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Transactions</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete {selectedIds.length} transaction
            {selectedIds.length !== 1 ? 's' : ''}? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
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
