import { useCallback, useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useHideStatementFormat,
  useStatementFormats,
  useUnhideStatementFormat,
} from '@/hooks/useStatementFormats';
import { toast } from '@/hooks/useToast';
import { formatApiError } from '@/utils/errorMessages';
import type { StatementFormat } from '@/types/statementFormat';
import { StatementFormatVisibilityTable } from '@/features/statement-formats/components/StatementFormatVisibilityTable';

function compareBooleanPriority(first: boolean, second: boolean) {
  if (first === second) return 0;
  return first ? -1 : 1;
}

function sortStatementFormats(formats: StatementFormat[]) {
  return [...formats].sort((a, b) => {
    const hiddenOrder = compareBooleanPriority(!a.hidden, !b.hidden);
    if (hiddenOrder !== 0) return hiddenOrder;

    const enabledOrder = compareBooleanPriority(a.enabled, b.enabled);
    if (enabledOrder !== 0) return enabledOrder;

    const displayNameOrder = a.displayName.localeCompare(b.displayName);
    if (displayNameOrder !== 0) return displayNameOrder;

    return a.bankName.localeCompare(b.bankName);
  });
}

export function StatementFormatManagementPage() {
  const { data: formats, isLoading, error, refetch } = useStatementFormats({ includeHidden: true });
  const { mutate: hideFormat } = useHideStatementFormat();
  const { mutate: unhideFormat } = useUnhideStatementFormat();
  const [pendingFormatId, setPendingFormatId] = useState<number | null>(null);

  const sortedFormats = useMemo(() => sortStatementFormats(formats ?? []), [formats]);

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const handleHide = useCallback(
    (format: StatementFormat) => {
      setPendingFormatId(format.id);
      hideFormat(format.id, {
        onSuccess: () => {
          toast.success(`${format.displayName} is hidden from import lists.`);
        },
        onError: (hideError) => {
          toast.error(formatApiError(hideError, 'Failed to hide statement format'));
        },
        onSettled: () => {
          setPendingFormatId(null);
        },
      });
    },
    [hideFormat],
  );

  const handleUnhide = useCallback(
    (format: StatementFormat) => {
      setPendingFormatId(format.id);
      unhideFormat(format.id, {
        onSuccess: () => {
          toast.success(`${format.displayName} is available for imports again.`);
        },
        onError: (unhideError) => {
          toast.error(formatApiError(unhideError, 'Failed to restore statement format'));
        },
        onSettled: () => {
          setPendingFormatId(null);
        },
      });
    },
    [unhideFormat],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-3">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Statement Formats</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Control which statement formats appear in your import list.
            </p>
          </div>
        </div>
      </div>

      {error && <ErrorBanner error={error} onRetry={handleRetry} />}

      {isLoading && (
        <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      )}

      {!isLoading && !error && formats && (
        <StatementFormatVisibilityTable
          formats={sortedFormats}
          pendingFormatId={pendingFormatId}
          onHide={handleHide}
          onUnhide={handleUnhide}
        />
      )}
    </div>
  );
}
