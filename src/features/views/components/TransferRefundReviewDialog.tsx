import { useCallback, useMemo, useState } from 'react';
import type { CheckedState } from '@radix-ui/react-checkbox';
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
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import type { TransferRefundCandidate } from '@/features/views/types/transferRefundReview';
import { useBulkExcludeTransactions } from '@/hooks/useViews';
import { toast } from '@/hooks/useToast';
import type { Transaction } from '@/types/transaction';
import { formatCurrency } from '@/utils/currency';
import { formatLocalDate } from '@/utils/dates';
import { formatApiError } from '@/utils/errorMessages';

interface TransferRefundReviewDialogProps {
  viewId: string;
  viewName: string;
  candidates: TransferRefundCandidate[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onClose: () => void;
  onComplete: () => void;
}

type CandidateSide = 'debit' | 'credit';

const EXCLUSION_FAILURE_MESSAGE = 'Failed to exclude transactions';

export function TransferRefundReviewDialog({
  viewId,
  viewName,
  candidates,
  isLoading,
  error,
  onRetry,
  onClose,
  onComplete,
}: TransferRefundReviewDialogProps) {
  const { mutate: bulkExclude, isPending } = useBulkExcludeTransactions();
  const [deselectedIds, setDeselectedIds] = useState<Set<number>>(() => new Set());

  const completionCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.explicitlyExcludedTransactionIds.length > 0),
    [candidates],
  );
  const newCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.explicitlyExcludedTransactionIds.length === 0),
    [candidates],
  );

  const eligibleIds = useMemo(
    () =>
      Array.from(
        new Set(candidates.flatMap((candidate) => candidate.eligibleExclusionTransactionIds)),
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
      if (selected) {
        nextIds.delete(transactionId);
      } else {
        nextIds.add(transactionId);
      }
      return nextIds;
    });
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !isPending) {
        onClose();
      }
    },
    [isPending, onClose],
  );

  const handleCancel = useCallback(() => {
    if (!isPending) {
      onClose();
    }
  }, [isPending, onClose]);

  const handleRetry = useCallback(() => {
    onRetry();
  }, [onRetry]);

  const handleConfirm = useCallback(() => {
    if (selectedIds.length === 0 || isPending || isLoading || error) return;

    bulkExclude(
      { viewId, ids: selectedIds },
      {
        onSuccess: ({ updatedCount, notFoundIds }) => {
          const totalCount = selectedIds.length;

          if (updatedCount === 0) {
            toast.error(EXCLUSION_FAILURE_MESSAGE);
            return;
          }

          if (notFoundIds.length > 0) {
            toast.warning(
              `Excluded ${updatedCount} of ${totalCount}. ${notFoundIds.length} not found or unavailable.`,
            );
          } else {
            toast.success(`Excluded ${updatedCount} transaction${updatedCount !== 1 ? 's' : ''}`);
          }

          onClose();
          onComplete();
        },
        onError: (mutationError) => {
          toast.error(formatApiError(mutationError, EXCLUSION_FAILURE_MESSAGE));
        },
      },
    );
  }, [bulkExclude, error, isLoading, isPending, onClose, onComplete, selectedIds, viewId]);

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col" showClose={!isPending}>
        <DialogHeader>
          <DialogTitle>Review possible transfers and refunds</DialogTitle>
          <DialogDescription>
            Review related transactions for &ldquo;{viewName}&rdquo; and choose which ones to
            exclude from this view. Nothing is excluded until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 flex-1 overflow-y-auto px-6 py-4">
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
                You can still manually exclude transactions from this view in the transaction table.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {completionCandidates.length > 0 && (
                <CandidateGroup
                  title="Complete previous exclusions"
                  description="A possible related transaction remains in this view while another transaction is already excluded. Review whether to exclude the remaining transaction."
                  candidates={completionCandidates}
                  selectedIds={selectedIdSet}
                  isPending={isPending}
                  onSelectionChange={handleSelectionChange}
                />
              )}
              {newCandidates.length > 0 && (
                <CandidateGroup
                  title="New possible transfers and refunds"
                  candidates={newCandidates}
                  selectedIds={selectedIdSet}
                  isPending={isPending}
                  onSelectionChange={handleSelectionChange}
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            {isPending ? 'Excluding...' : `Exclude ${selectedIds.length} from this view`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CandidateGroupProps {
  title: string;
  description?: string;
  candidates: TransferRefundCandidate[];
  selectedIds: ReadonlySet<number>;
  isPending: boolean;
  onSelectionChange: (transactionId: number, selected: boolean) => void;
}

function CandidateGroup({
  title,
  description,
  candidates,
  selectedIds,
  isPending,
  onSelectionChange,
}: CandidateGroupProps) {
  const headingId = `candidate-group-${title.toLowerCase().replaceAll(' ', '-')}`;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-3 space-y-4">
        {candidates.map((candidate) => (
          <CandidateReview
            key={candidate.key}
            candidate={candidate}
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
  selectedIds: ReadonlySet<number>;
  isPending: boolean;
  onSelectionChange: (transactionId: number, selected: boolean) => void;
}

function CandidateReview({
  candidate,
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
          isEligible={candidate.eligibleExclusionTransactionIds.includes(candidate.debit.id)}
          isExplicitlyExcluded={candidate.explicitlyExcludedTransactionIds.includes(
            candidate.debit.id,
          )}
          isSelected={selectedIds.has(candidate.debit.id)}
          isPending={isPending}
          onSelectionChange={onSelectionChange}
        />
        <CandidateTransactionRow
          candidateKey={candidate.key}
          side="credit"
          transaction={candidate.credit}
          isEligible={candidate.eligibleExclusionTransactionIds.includes(candidate.credit.id)}
          isExplicitlyExcluded={candidate.explicitlyExcludedTransactionIds.includes(
            candidate.credit.id,
          )}
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
  transaction: Transaction;
  isEligible: boolean;
  isExplicitlyExcluded: boolean;
  isSelected: boolean;
  isPending: boolean;
  onSelectionChange: (transactionId: number, selected: boolean) => void;
}

function CandidateTransactionRow({
  candidateKey,
  side,
  transaction,
  isEligible,
  isExplicitlyExcluded,
  isSelected,
  isPending,
  onSelectionChange,
}: CandidateTransactionRowProps) {
  const checkboxId = `review-${candidateKey}-${side}-${transaction.id}`;
  const sideLabel = side === 'debit' ? 'Debit' : 'Credit';
  const checkboxLabel = `Exclude ${sideLabel.toLowerCase()} transaction ${transaction.id} from this view`;

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
        <p className="font-mono text-sm font-semibold">
          {formatCurrency(Math.abs(transaction.amount), transaction.currencyIsoCode)}
        </p>
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
            Exclude this {sideLabel.toLowerCase()} from the view
          </label>
        </div>
      ) : (
        <p className="border-t pt-3 text-sm font-medium text-muted-foreground">
          {isExplicitlyExcluded
            ? 'Previously excluded from this view'
            : 'Not currently in this view'}
        </p>
      )}
    </div>
  );
}
