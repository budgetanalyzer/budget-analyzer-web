import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { useTransactionCount } from '@/hooks/useTransactionCount';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ConfirmDisableCurrencyDialogProps {
  currencyCode: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ConfirmDisableCurrencyDialog({
  currencyCode,
  isOpen,
  onConfirm,
  onCancel,
  isSubmitting,
}: ConfirmDisableCurrencyDialogProps) {
  const { data: count, isLoading } = useTransactionCount({ currencyIsoCode: currencyCode }, isOpen);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable {currencyCode}?</DialogTitle>
          <DialogDescription>
            {isLoading ? (
              <LoadingSpinner size="sm" text="Checking transactions..." />
            ) : count != null && count > 0 ? (
              <>
                There {count === 1 ? 'is' : 'are'} {count} active transaction
                {count === 1 ? '' : 's'} using {currencyCode}. Disabling will prevent currency
                conversion for {count === 1 ? 'this transaction' : 'these transactions'}.
              </>
            ) : (
              <>No active transactions use {currencyCode}.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isSubmitting || isLoading}>
            {isSubmitting ? 'Disabling...' : 'Disable Anyway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
