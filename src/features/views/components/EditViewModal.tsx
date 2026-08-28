import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
import { MessageBanner } from '@/components/MessageBanner';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useUpdateView } from '@/hooks/useViews';
import type { SavedViewMetadata } from '@/types/view';
import { formatApiError } from '@/utils/errorMessages';

interface EditViewModalProps {
  open: boolean;
  onClose: () => void;
  view: SavedViewMetadata;
}

const RENAME_FAILURE_MESSAGE = 'Failed to rename this view';

export function EditViewModal({ open, onClose, view }: EditViewModalProps) {
  const [name, setName] = useState(view.name);
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);
  const { mutate: updateView, isPending } = useUpdateView();

  const handleDismissMutationError = useCallback(() => {
    setMutationErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    setMutationErrorMessage(null);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      const trimmedName = name.trim();
      if (!trimmedName || trimmedName === view.name) return;

      setMutationErrorMessage(null);
      updateView(
        { id: view.id, request: { name: trimmedName } },
        {
          onSuccess: handleClose,
          onError: (error) => {
            setMutationErrorMessage(formatApiError(error, RENAME_FAILURE_MESSAGE));
          },
        },
      );
    },
    [handleClose, name, updateView, view.id, view.name],
  );

  const handleNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) handleClose();
    },
    [handleClose],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename View</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 pt-4">
            <label htmlFor="view-name" className="text-sm font-medium">
              View Name
            </label>
            <Input
              id="view-name"
              value={name}
              onChange={handleNameChange}
              required
              maxLength={255}
              autoFocus
            />
          </div>

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
            <Button type="submit" disabled={isPending || !name.trim() || name.trim() === view.name}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
