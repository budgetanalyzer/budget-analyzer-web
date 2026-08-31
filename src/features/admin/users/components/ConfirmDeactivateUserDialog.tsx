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

interface ConfirmDeactivateUserDialogProps {
  userLabel: string;
  isOpen: boolean;
  isSubmitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDeactivateUserDialog({
  userLabel,
  isOpen,
  isSubmitting,
  onConfirm,
  onCancel,
}: ConfirmDeactivateUserDialogProps) {
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onCancel();
    },
    [onCancel],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent dismissible={!isSubmitting}>
        <DialogHeader>
          <DialogTitle>Deactivate {userLabel}?</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              This will deactivate the account immediately and remove all assigned roles.
            </span>
            <span className="block">Any active sessions will also be revoked.</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Deactivating...' : 'Deactivate Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
