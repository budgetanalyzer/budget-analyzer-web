import { useNavigate } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { MessageBanner } from '@/components/MessageBanner';
import { StatementFormatForm } from '@/features/admin/statement-formats/components/StatementFormatForm';
import { useCreateStatementFormat } from '@/hooks/useStatementFormats';
import { formatApiError } from '@/utils/errorMessages';
import type { CreateStatementFormatRequest } from '@/types/statementFormat';

/**
 * Create new statement format page
 */
export function StatementFormatCreatePage() {
  const navigate = useNavigate();
  const { mutate: createFormat, isPending } = useCreateStatementFormat();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearErrorMessage = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const handleSubmit = useCallback(
    (data: CreateStatementFormatRequest & { enabled: boolean }) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { enabled, ...createData } = data;
      createFormat(createData, {
        onSuccess: (newFormat) => {
          navigate('/admin/statement-formats', {
            state: {
              message: {
                type: 'success',
                text: `Format "${newFormat.bankName}" created successfully`,
              },
            },
          });
        },
        onError: (error: Error) => {
          const message = formatApiError(error, 'Failed to create statement format');
          setErrorMessage(message);
        },
      });
    },
    [createFormat, navigate],
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
            <PlusCircle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Add New Format</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a new bank statement format configuration
            </p>
          </div>
        </div>

        <div className="max-w-2xl space-y-4">
          {/* Error Banner */}
          <AnimatePresence mode="wait">
            {errorMessage && (
              <MessageBanner type="error" message={errorMessage} onClose={clearErrorMessage} />
            )}
          </AnimatePresence>

          {/* Form */}
          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <StatementFormatForm onSubmit={handleSubmit} isSubmitting={isPending} mode="create" />
          </div>
        </div>
      </div>
    </div>
  );
}
