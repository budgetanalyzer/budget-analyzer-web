// src/features/views/components/DeleteViewModal.tsx
import { useCallback } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useDeleteView } from '@/hooks/useViews';
import { SavedView } from '@/types/view';

interface DeleteViewModalProps {
  open: boolean;
  onClose: () => void;
  view: SavedView;
}

export function DeleteViewModal({ open, onClose, view }: DeleteViewModalProps) {
  const navigate = useNavigate();
  const { mutate: deleteView, isPending } = useDeleteView();

  const handleDelete = useCallback(() => {
    deleteView(view.id, {
      onSuccess: () => {
        onClose();
        navigate('/');
      },
    });
  }, [deleteView, view.id, onClose, navigate]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Delete View</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Are you sure you want to delete &ldquo;{view.name}&rdquo;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
            <p className="text-sm text-muted-foreground">
              This will permanently delete the view and all its settings, including:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>{view.pinnedCount} pinned transaction(s)</li>
              <li>{view.excludedCount} excluded transaction(s)</li>
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              Your transactions will not be affected.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
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
