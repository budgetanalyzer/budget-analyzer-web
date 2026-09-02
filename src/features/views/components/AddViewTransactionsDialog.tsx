import { useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { ViewTransactionPicker } from '@/features/views/components/ViewTransactionPicker';
import { createAddViewTransactionsRequest, useUpdateViewTransactions } from '@/hooks/useViews';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';
import { formatApiError } from '@/utils/errorMessages';

const ADD_FAILURE_MESSAGE = 'Failed to add transactions to this view';
const STALE_SELECTION_MESSAGE =
  'The transaction snapshot changed. Membership and transactions were refreshed; review your selection before submitting again.';

interface AddViewTransactionsDialogProps {
  viewId: string;
  viewName: string;
  allTransactions: Transaction[];
  memberTransactionIds: number[];
  displayCurrency: string;
  displayAmounts: ReadonlyMap<number, DisplayAmount>;
  isDisplayAmountLoading: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddViewTransactionsDialog({
  viewId,
  viewName,
  allTransactions,
  memberTransactionIds,
  displayCurrency,
  displayAmounts,
  isDisplayAmountLoading,
  onClose,
  onSuccess = onClose,
}: AddViewTransactionsDialogProps) {
  const {
    mutate: updateViewTransactions,
    isPending,
    error,
    reset: resetUpdateViewTransactions,
  } = useUpdateViewTransactions();
  const isStaleSelection = error?.response.code === 'SAVED_VIEW_MEMBERSHIP_STALE';
  const errorMessage = error
    ? isStaleSelection
      ? STALE_SELECTION_MESSAGE
      : formatApiError(error, ADD_FAILURE_MESSAGE)
    : null;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isPending) onClose();
    },
    [isPending, onClose],
  );
  const handleCancel = useCallback(() => {
    if (!isPending) onClose();
  }, [isPending, onClose]);
  const handleSelectionChange = useCallback(() => {
    if (!isPending) resetUpdateViewTransactions();
  }, [isPending, resetUpdateViewTransactions]);
  const handleSubmit = useCallback(
    (transactionIds: number[]) => {
      updateViewTransactions(
        {
          viewId,
          request: createAddViewTransactionsRequest(transactionIds),
        },
        { onSuccess },
      );
    },
    [onSuccess, updateViewTransactions, viewId],
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col" dismissible={!isPending}>
        <DialogHeader>
          <DialogTitle>Add transactions to {viewName}</DialogTitle>
          <DialogDescription>
            Select active transactions to add. Transactions already in this view cannot be selected.
          </DialogDescription>
        </DialogHeader>

        <ViewTransactionPicker
          allTransactions={allTransactions}
          memberTransactionIds={memberTransactionIds}
          viewName={viewName}
          displayCurrency={displayCurrency}
          displayAmounts={displayAmounts}
          isDisplayAmountLoading={isDisplayAmountLoading}
          isPending={isPending}
          errorMessage={errorMessage}
          submissionBlocked={isStaleSelection}
          onSelectionChange={handleSelectionChange}
          onCancel={handleCancel}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
