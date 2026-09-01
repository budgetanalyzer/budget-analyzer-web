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
import { useCloneView, useCreateView } from '@/hooks/useViews';
import type { ApiError } from '@/types/apiError';
import { formatApiError } from '@/utils/errorMessages';

interface CreateViewModalCommonProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

interface CreateViewModeProps {
  transactionIds: number[];
  isTransactionIdsReady: boolean;
  sourceViewId?: never;
}

interface CloneViewModeProps {
  sourceViewId: string;
  transactionIds?: never;
  isTransactionIdsReady?: never;
}

type CreateViewModalProps = CreateViewModalCommonProps & (CreateViewModeProps | CloneViewModeProps);

const CREATE_FAILURE_MESSAGE = 'Failed to save view';
const CLONE_FAILURE_MESSAGE = 'Failed to clone view';
const STALE_MEMBERSHIP_MESSAGE =
  'The visible transaction set changed. The transaction snapshot was refreshed; review the current set and save again.';
const STALE_CLONE_MEMBERSHIP_MESSAGE =
  'The source view membership changed. Refresh the source view and try cloning again.';

function isCloneMode(
  props: CreateViewModalProps,
): props is CreateViewModalCommonProps & CloneViewModeProps {
  return props.sourceViewId !== undefined;
}

export function CreateViewModal(props: CreateViewModalProps) {
  const { open, onClose, title = 'Save as view' } = props;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);
  const { mutate: createView, isPending: isCreatePending } = useCreateView();
  const { mutate: cloneView, isPending: isClonePending } = useCloneView();
  const cloneMode = isCloneMode(props);
  const isPending = cloneMode ? isClonePending : isCreatePending;
  const isSubmissionReady = cloneMode || props.isTransactionIdsReady;

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
      if (!trimmedName) return;
      if (!isCloneMode(props) && !props.isTransactionIdsReady) return;

      setMutationErrorMessage(null);

      if (isCloneMode(props)) {
        cloneView(
          { sourceViewId: props.sourceViewId, request: { name: trimmedName } },
          {
            onSuccess: (clonedView) => {
              handleClose();
              navigate(`/views/${clonedView.id}`);
            },
            onError: (error: ApiError) => {
              if (error.response.code === 'SAVED_VIEW_MEMBERSHIP_STALE') {
                setMutationErrorMessage(STALE_CLONE_MEMBERSHIP_MESSAGE);
                return;
              }

              setMutationErrorMessage(formatApiError(error, CLONE_FAILURE_MESSAGE));
            },
          },
        );
        return;
      }

      createView(
        { name: trimmedName, transactionIds: props.transactionIds },
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
    [clearTransactionFilterParams, cloneView, createView, handleClose, name, navigate, props],
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
              {cloneMode
                ? 'The complete saved view will be copied, regardless of active filters.'
                : props.transactionIds.length === 1
                  ? '1 currently visible transaction will be saved.'
                  : `${props.transactionIds.length} currently visible transactions will be saved.`}
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
            <Button type="submit" disabled={isPending || !name.trim() || !isSubmissionReady}>
              {isPending ? 'Saving...' : 'Save View'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
