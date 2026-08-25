import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
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

interface EditViewModalProps {
  open: boolean;
  onClose: () => void;
  view: SavedViewMetadata;
}

export function EditViewModal({ open, onClose, view }: EditViewModalProps) {
  const [name, setName] = useState(view.name);
  const { mutate: updateView, isPending } = useUpdateView();

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      const trimmedName = name.trim();
      if (!trimmedName || trimmedName === view.name) return;

      updateView({ id: view.id, request: { name: trimmedName } }, { onSuccess: onClose });
    },
    [name, onClose, updateView, view.id, view.name],
  );

  const handleNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) onClose();
    },
    [onClose],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename View</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-4">
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
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
