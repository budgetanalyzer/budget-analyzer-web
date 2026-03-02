import { useParams, useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { MessageBanner } from '@/components/MessageBanner';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatementFormatForm } from '@/features/admin/statement-formats/components/StatementFormatForm';
import { useStatementFormat, useUpdateStatementFormat } from '@/hooks/useStatementFormats';
import { formatApiError } from '@/utils/errorMessages';
import type { UpdateStatementFormatRequest, FormatType } from '@/types/statementFormat';

interface FormData {
  formatKey: string;
  formatType: FormatType;
  bankName: string;
  defaultCurrencyIsoCode: string;
  dateHeader?: string;
  dateFormat?: string;
  descriptionHeader?: string;
  creditHeader?: string;
  debitHeader?: string;
  typeHeader?: string;
  categoryHeader?: string;
  enabled: boolean;
}

/**
 * Edit existing statement format page
 */
export function StatementFormatEditPage() {
  const { formatKey } = useParams<{ formatKey: string }>();
  const navigate = useNavigate();

  const { data: format, isLoading, error } = useStatementFormat(formatKey || '');
  const { mutate: updateFormat, isPending } = useUpdateStatementFormat();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearErrorMessage = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(
    (data: FormData) => {
      if (!formatKey) return;

      const updateData: UpdateStatementFormatRequest = {
        bankName: data.bankName,
        defaultCurrencyIsoCode: data.defaultCurrencyIsoCode,
        dateHeader: data.dateHeader,
        dateFormat: data.dateFormat,
        descriptionHeader: data.descriptionHeader,
        creditHeader: data.creditHeader,
        debitHeader: data.debitHeader,
        typeHeader: data.typeHeader,
        categoryHeader: data.categoryHeader,
        enabled: data.enabled,
      };

      updateFormat(
        { formatKey, data: updateData },
        {
          onSuccess: (updatedFormat) => {
            navigate('/admin/statement-formats', {
              state: {
                message: {
                  type: 'success',
                  text: `Format "${updatedFormat.bankName}" updated successfully`,
                },
              },
            });
          },
          onError: (error: Error) => {
            const message = formatApiError(error, 'Failed to update statement format');
            setErrorMessage(message);
          },
        },
      );
    },
    [formatKey, updateFormat, navigate],
  );

  return (
    <div className="h-full bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-8 py-10">
        <Button
          variant="ghost"
          className="mb-8 gap-2"
          onClick={() => navigate('/admin/statement-formats')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Statement Formats
        </Button>

        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Edit3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Edit Format</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {format ? `Update ${format.bankName} (${format.formatKey})` : `Format: ${formatKey}`}
            </p>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="max-w-2xl rounded-xl border border-destructive bg-destructive/10 p-6 shadow-sm">
            <p className="text-center text-sm font-medium text-destructive">
              Failed to load statement format: {error.message}
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
        {!isLoading && !error && format && (
          <div className="max-w-2xl space-y-4">
            {/* Error Banner */}
            <AnimatePresence mode="wait">
              {errorMessage && (
                <MessageBanner type="error" message={errorMessage} onClose={clearErrorMessage} />
              )}
            </AnimatePresence>

            {/* Form */}
            <div className="rounded-xl border bg-card p-8 shadow-sm">
              <StatementFormatForm
                initialData={format}
                onSubmit={handleSubmit}
                isSubmitting={isPending}
                mode="edit"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
