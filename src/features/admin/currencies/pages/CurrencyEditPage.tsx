import { useParams, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { MessageBanner } from '@/components/MessageBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { CurrencyForm } from '@/features/admin/currencies/components/CurrencyForm';
import { ConfirmDisableCurrencyDialog } from '@/features/admin/currencies/components/ConfirmDisableCurrencyDialog';
import { useCurrency, useUpdateCurrency } from '@/hooks/useCurrencies';
import { formatApiError } from '@/utils/errorMessages';

/**
 * Edit existing currency page
 */
export function CurrencyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currencyId = id ? parseInt(id, 10) : 0;

  const { data: currency, isLoading, error } = useCurrency(currencyId);
  const { mutate: updateCurrency, isPending } = useUpdateCurrency();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<{
    enabled: boolean;
  } | null>(null);

  const clearErrorMessage = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const submitUpdate = useCallback(
    (enabled: boolean) => {
      updateCurrency(
        {
          id: currencyId,
          data: { enabled },
        },
        {
          onSuccess: (updatedCurrency) => {
            navigate('/admin/currencies', {
              state: {
                message: {
                  type: 'success',
                  text: `Currency ${updatedCurrency.currencyCode} updated successfully`,
                },
              },
            });
          },
          onError: (error: Error) => {
            const message = formatApiError(error, 'Failed to update currency');
            setErrorMessage(message);
          },
        },
      );
    },
    [currencyId, updateCurrency, navigate],
  );

  const handleSubmit = useCallback(
    (data: { currencyCode: string; providerSeriesId: string; enabled: boolean }) => {
      // Intercept enabled→disabled transition
      if (currency?.enabled && !data.enabled) {
        setPendingSubmitData({ enabled: data.enabled });
        setShowConfirmDialog(true);
        return;
      }
      submitUpdate(data.enabled);
    },
    [currency?.enabled, submitUpdate],
  );

  const handleConfirmDisable = useCallback(() => {
    setShowConfirmDialog(false);
    if (pendingSubmitData) {
      submitUpdate(pendingSubmitData.enabled);
      setPendingSubmitData(null);
    }
  }, [pendingSubmitData, submitUpdate]);

  const handleCancelDisable = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingSubmitData(null);
  }, []);

  return (
    <div className="h-full bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-8 py-10">
        <Button
          variant="ghost"
          className="mb-8 gap-2"
          onClick={() => navigate('/admin/currencies')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Currencies
        </Button>

        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Edit3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Edit Currency</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {currency ? `Update ${currency.currencyCode}` : `Currency ID: ${id}`}
            </p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="max-w-2xl rounded-xl border border-destructive bg-destructive/10 p-6 shadow-sm">
            <p className="text-center text-sm font-medium text-destructive">
              Failed to load currency: {error.message}
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="max-w-2xl space-y-6 rounded-xl border bg-card p-8 shadow-sm">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        )}

        {/* Form */}
        {!isLoading && !error && currency && (
          <div className="max-w-2xl space-y-4">
            {/* Error Banner */}
            <AnimatePresence mode="wait">
              {errorMessage && (
                <MessageBanner type="error" message={errorMessage} onClose={clearErrorMessage} />
              )}
            </AnimatePresence>

            {/* Form */}
            <div className="rounded-xl border bg-card p-8 shadow-sm">
              <CurrencyForm
                initialData={currency}
                onSubmit={handleSubmit}
                isSubmitting={isPending}
                mode="edit"
              />
            </div>
          </div>
        )}
        {currency && (
          <ConfirmDisableCurrencyDialog
            currencyCode={currency.currencyCode}
            isOpen={showConfirmDialog}
            onConfirm={handleConfirmDisable}
            onCancel={handleCancelDisable}
            isSubmitting={isPending}
          />
        )}
      </div>
    </div>
  );
}
