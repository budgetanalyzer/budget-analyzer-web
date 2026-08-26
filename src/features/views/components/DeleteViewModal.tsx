import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle } from 'lucide-react';
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
import { useDeleteView } from '@/hooks/useViews';
import type { SavedViewMetadata } from '@/types/view';
import { formatApiError } from '@/utils/errorMessages';

interface DeleteViewModalProps {
  open: boolean;
  onClose: () => void;
  view: SavedViewMetadata;
}

const DELETE_FAILURE_MESSAGE = 'Failed to delete this view';

export function DeleteViewModal({ open, onClose, view }: DeleteViewModalProps) {
  const navigate = useNavigate();
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);
  const { mutate: deleteView, isPending } = useDeleteView();

  const handleDismissMutationError = useCallback(() => {
    setMutationErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    setMutationErrorMessage(null);
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    setMutationErrorMessage(null);
    deleteView(view.id, {
      onSuccess: () => {
        handleClose();
        navigate('/');
      },
      onError: (error) => {
        setMutationErrorMessage(formatApiError(error, DELETE_FAILURE_MESSAGE));
      },
    });
  }, [deleteView, handleClose, navigate, view.id]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) handleClose();
    },
    [handleClose],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Delete View</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Are you sure you want to delete &ldquo;{view.name}&rdquo; and its{' '}
            {view.transactionCount} transaction memberships? Your transactions will not be deleted.
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
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? 'Deleting...' : 'Delete View'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
