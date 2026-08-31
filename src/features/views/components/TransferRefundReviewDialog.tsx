import { useCallback, useMemo, useState } from 'react';
import type { CheckedState } from '@radix-ui/react-checkbox';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MessageBanner } from '@/components/MessageBanner';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import type { TransferRefundCandidate } from '@/features/views/types/transferRefundReview';
import { createRemoveViewTransactionsRequest, useUpdateViewTransactions } from '@/hooks/useViews';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';
import { formatCurrency } from '@/utils/currency';
import { formatLocalDate } from '@/utils/dates';
import { formatApiError } from '@/utils/errorMessages';

interface TransferRefundReviewDialogProps {
  viewId: string;
  viewName: string;
  candidates: TransferRefundCandidate[];
  displayAmounts: ReadonlyMap<number, DisplayAmount>;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onClose: () => void;
  onComplete: () => void;
}

type CandidateSide = 'debit' | 'credit';

const REMOVE_FAILURE_MESSAGE = 'Failed to remove transactions from this view';

export function TransferRefundReviewDialog({
  viewId,
  viewName,
  candidates,
  displayAmounts,
  isLoading,
  error,
  onRetry,
  onClose,
  onComplete,
}: TransferRefundReviewDialogProps) {
  const { mutate: updateViewTransactions, isPending } = useUpdateViewTransactions();
  const [deselectedIds, setDeselectedIds] = useState<Set<number>>(() => new Set());
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);

  const eligibleIds = useMemo(
    () =>
      Array.from(
        new Set(candidates.flatMap((candidate) => candidate.eligibleRemovalTransactionIds)),
      ),
    [candidates],
  );
  const selectedIds = useMemo(
    () => eligibleIds.filter((transactionId) => !deselectedIds.has(transactionId)),
    [deselectedIds, eligibleIds],
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canConfirm = selectedIds.length > 0 && !isPending && !isLoading && !error;

  const handleSelectionChange = useCallback((transactionId: number, selected: boolean) => {
    setDeselectedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (selected) nextIds.delete(transactionId);
      else nextIds.add(transactionId);
      return nextIds;
    });
  }, []);

  const handleDismissMutationError = useCallback(() => {
    setMutationErrorMessage(null);
  }, []);

  const handleClose = useCallback(() => {
    setMutationErrorMessage(null);
    onClose();
  }, [onClose]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) handleClose();
    },
    [handleClose],
  );

  const handleCancel = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleRetry = useCallback(() => {
    onRetry();
  }, [onRetry]);

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return;

    setMutationErrorMessage(null);
    updateViewTransactions(
      {
        viewId,
        request: createRemoveViewTransactionsRequest(selectedIds),
      },
      {
        onSuccess: () => {
          handleClose();
          onComplete();
        },
        onError: (mutationError) => {
          setMutationErrorMessage(formatApiError(mutationError, REMOVE_FAILURE_MESSAGE));
        },
      },
    );
  }, [canConfirm, handleClose, onComplete, selectedIds, updateViewTransactions, viewId]);

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col" dismissible={!isPending}>
        <DialogHeader>
          <DialogTitle>Review possible transfers and refunds</DialogTitle>
          <DialogDescription>
            Review related transactions for &ldquo;{viewName}&rdquo; and choose which current
            members to remove from this view. Nothing is removed until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 overflow-y-auto px-6 pt-4">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <LoadingSpinner text="Finding possible transfers and refunds..." />
            </div>
          ) : error ? (
            <ErrorBanner error={error} onRetry={handleRetry} />
          ) : candidates.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="font-medium">No possible transfers or refunds were found.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                You can still manually remove transactions from this view in the transaction table.
              </p>
            </div>
          ) : (
            <CandidateGroup
              candidates={candidates}
              displayAmounts={displayAmounts}
              selectedIds={selectedIdSet}
              isPending={isPending}
              onSelectionChange={handleSelectionChange}
            />
          )}
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

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            {isPending ? 'Removing...' : `Remove ${selectedIds.length} from this view`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CandidateGroupProps {
  candidates: TransferRefundCandidate[];
  displayAmounts: ReadonlyMap<number, DisplayAmount>;
  selectedIds: ReadonlySet<number>;
  isPending: boolean;
  onSelectionChange: (transactionId: number, selected: boolean) => void;
}

function CandidateGroup({
  candidates,
  displayAmounts,
  selectedIds,
  isPending,
  onSelectionChange,
}: CandidateGroupProps) {
  return (
    <section aria-labelledby="possible-transfer-refund-candidates">
      <h2 id="possible-transfer-refund-candidates" className="text-base font-semibold">
        Possible transfers and refunds
      </h2>
      <div className="mt-3 space-y-4">
        {candidates.map((candidate) => (
          <CandidateReview
            key={candidate.key}
            candidate={candidate}
            displayAmounts={displayAmounts}
            selectedIds={selectedIds}
            isPending={isPending}
            onSelectionChange={onSelectionChange}
          />
        ))}
      </div>
    </section>
  );
}

interface CandidateReviewProps {
  candidate: TransferRefundCandidate;
  displayAmounts: ReadonlyMap<number, DisplayAmount>;
  selectedIds: ReadonlySet<number>;
  isPending: boolean;
  onSelectionChange: (transactionId: number, selected: boolean) => void;
}

function CandidateReview({
  candidate,
  displayAmounts,
  selectedIds,
  isPending,
  onSelectionChange,
}: CandidateReviewProps) {
  const title = candidate.kind === 'REFUND' ? 'Possible refund' : 'Possible transfer';
  const formattedDifference = (candidate.amountDifferenceBasisPoints / 100).toFixed(2);

  return (
    <section className="rounded-lg border p-4" aria-label={title}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {candidate.absoluteDayDistance} day{candidate.absoluteDayDistance !== 1 ? 's' : ''} apart
          {' · '}Approximately {formattedDifference}% amount difference
        </p>
      </div>
      {candidate.sharedDescriptionTokens.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Related description evidence: {candidate.sharedDescriptionTokens.join(', ')}
        </p>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <CandidateTransactionRow
          candidateKey={candidate.key}
          side="debit"
          transaction={candidate.debit}
          displayAmount={displayAmounts.get(candidate.debit.id)}
          isEligible={candidate.eligibleRemovalTransactionIds.includes(candidate.debit.id)}
          isSelected={selectedIds.has(candidate.debit.id)}
          isPending={isPending}
          onSelectionChange={onSelectionChange}
        />
        <CandidateTransactionRow
          candidateKey={candidate.key}
          side="credit"
          transaction={candidate.credit}
          displayAmount={displayAmounts.get(candidate.credit.id)}
          isEligible={candidate.eligibleRemovalTransactionIds.includes(candidate.credit.id)}
          isSelected={selectedIds.has(candidate.credit.id)}
          isPending={isPending}
          onSelectionChange={onSelectionChange}
        />
      </div>
    </section>
  );
}

interface CandidateTransactionRowProps {
  candidateKey: string;
  side: CandidateSide;
  transaction: Pick<Transaction, 'id' | 'date' | 'description' | 'bankName' | 'accountId'>;
  displayAmount: DisplayAmount | undefined;
  isEligible: boolean;
  isSelected: boolean;
  isPending: boolean;
  onSelectionChange: (transactionId: number, selected: boolean) => void;
}

function CandidateTransactionRow({
  candidateKey,
  side,
  transaction,
  displayAmount,
  isEligible,
  isSelected,
  isPending,
  onSelectionChange,
}: CandidateTransactionRowProps) {
  const checkboxId = `review-${candidateKey}-${side}-${transaction.id}`;
  const sideLabel = side === 'debit' ? 'Debit' : 'Credit';
  const checkboxLabel = `Remove ${sideLabel.toLowerCase()} transaction ${transaction.id} from this view`;

  const handleCheckedChange = useCallback(
    (checked: CheckedState) => {
      onSelectionChange(transaction.id, checked === true);
    },
    [onSelectionChange, transaction.id],
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-md bg-muted/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{sideLabel}</p>
        {displayAmount && (
          <p className="font-mono text-sm font-semibold">
            {displayAmount.available ? (
              formatCurrency(displayAmount.value, displayAmount.targetCurrency)
            ) : (
              <span className="font-sans text-sm font-medium text-warning">
                Amount in {displayAmount.targetCurrency} unavailable
              </span>
            )}
          </p>
        )}
      </div>
      <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Date</dt>
        <dd>{formatLocalDate(transaction.date)}</dd>
        <dt className="text-muted-foreground">Description</dt>
        <dd className="min-w-0 break-words">{transaction.description}</dd>
        <dt className="text-muted-foreground">Bank</dt>
        <dd className="min-w-0 break-words">{transaction.bankName}</dd>
        {transaction.accountId && (
          <>
            <dt className="text-muted-foreground">Account</dt>
            <dd className="min-w-0 break-words">{transaction.accountId}</dd>
          </>
        )}
      </dl>
      {isEligible ? (
        <div className="flex items-start gap-2 border-t pt-3">
          <Checkbox
            id={checkboxId}
            checked={isSelected}
            onCheckedChange={handleCheckedChange}
            disabled={isPending}
            aria-label={checkboxLabel}
          />
          <label htmlFor={checkboxId} className="text-sm leading-none">
            Remove this {sideLabel.toLowerCase()} from this view
          </label>
        </div>
      ) : (
        <p className="border-t pt-3 text-sm font-medium text-muted-foreground">
          Not currently in this view; shown as supporting evidence
        </p>
      )}
    </div>
  );
}
