import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageBanner } from '@/components/MessageBanner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateView } from '@/hooks/useViews';
import { formatApiError } from '@/utils/errorMessages';

interface CreateViewModalProps {
  open: boolean;
  onClose: () => void;
  transactionIds: number[];
  isTransactionIdsReady: boolean;
  title?: string;
}

const CREATE_FAILURE_MESSAGE = 'Failed to save view';
const STALE_MEMBERSHIP_MESSAGE =
  'The visible transaction set changed. The transaction snapshot was refreshed; review the current set and save again.';

export function CreateViewModal({
  open,
  onClose,
  transactionIds,
  isTransactionIdsReady,
  title = 'Save as View',
}: CreateViewModalProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);
  const { mutate: createView, isPending } = useCreateView();

  const handleDismissMutationError = useCallback(() => {
    setMutationErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    setMutationErrorMessage(null);
    setName('');
    onClose();
  }, [onClose]);

  const clearTransactionFilterParams = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('dateFrom');
    params.delete('dateTo');
    params.delete('q');
    params.delete('bankName');
    params.delete('bank');
    params.delete('accountId');
    params.delete('account');
    params.delete('type');
    params.delete('minAmount');
    params.delete('maxAmount');
    params.delete('amountCurrency');
    params.delete('returnTo');
    params.delete('breadcrumbLabel');
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();

      const trimmedName = name.trim();
      if (!trimmedName || !isTransactionIdsReady) return;

      setMutationErrorMessage(null);
      createView(
        { name: trimmedName, transactionIds },
        {
          onSuccess: (newView) => {
            clearTransactionFilterParams();
            handleClose();
            navigate(`/views/${newView.id}`);
          },
          onError: (error) => {
            if (error.response.code === 'SAVED_VIEW_MEMBERSHIP_STALE') {
              setMutationErrorMessage(STALE_MEMBERSHIP_MESSAGE);
              return;
            }

            setMutationErrorMessage(formatApiError(error, CREATE_FAILURE_MESSAGE));
          },
        },
      );
    },
    [
      clearTransactionFilterParams,
      createView,
      handleClose,
      isTransactionIdsReady,
      name,
      navigate,
      transactionIds,
    ],
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) handleClose();
    },
    [handleClose],
  );

  const handleNameChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dismissible={!isPending}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label htmlFor="view-name" className="text-sm font-medium">
                View Name
              </label>
              <Input
                id="view-name"
                value={name}
                onChange={handleNameChange}
                placeholder="e.g., SF Trip December 2024"
                required
                maxLength={255}
                autoFocus
              />
            </div>

            <p className="text-sm text-muted-foreground">
              {transactionIds.length === 1
                ? '1 currently visible transaction will be saved.'
                : `${transactionIds.length} currently visible transactions will be saved.`}
            </p>
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
            <Button type="submit" disabled={isPending || !name.trim() || !isTransactionIdsReady}>
              {isPending ? 'Saving...' : 'Save View'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
