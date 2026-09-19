import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
import { MessageBanner } from '@/components/MessageBanner';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { useCreateTransaction } from '@/hooks/useTransactions';
import type { CreateTransactionRequest, Transaction, TransactionType } from '@/types/transaction';
import { getCurrentLocalDate } from '@/utils/dates';
import { formatApiError } from '@/utils/errorMessages';

interface CreateTransactionDialogProps {
  displayCurrency: string;
  onClose: () => void;
  onCreated: (transaction: Transaction) => void;
}

interface TransactionDraft {
  date: string;
  description: string;
  amount: string;
  currencyIsoCode: string;
  type: TransactionType;
  bankName: string;
  accountId: string;
}

interface ValidationErrors {
  date?: string;
  amount?: string;
  currencyIsoCode?: string;
  description?: string;
  bankName?: string;
  accountId?: string;
}

const CREATE_FAILURE_MESSAGE = 'Failed to create transaction';
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

function createInitialDraft(displayCurrency: string): TransactionDraft {
  return {
    date: getCurrentLocalDate(),
    description: '',
    amount: '',
    currencyIsoCode: displayCurrency.trim().toUpperCase(),
    type: 'DEBIT',
    bankName: '',
    accountId: '',
  };
}

function validateDraft(draft: TransactionDraft): ValidationErrors {
  const errors: ValidationErrors = {};
  const amount = Number(draft.amount);

  if (!draft.date) {
    errors.date = 'Enter a transaction date.';
  }
  if (!draft.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter a finite amount greater than zero.';
  }
  if (!CURRENCY_PATTERN.test(draft.currencyIsoCode.trim().toUpperCase())) {
    errors.currencyIsoCode = 'Enter a three-letter currency code.';
  }
  if (draft.description.length > 500) {
    errors.description = 'Description must be 500 characters or fewer.';
  }
  if (draft.bankName.length > 255) {
    errors.bankName = 'Bank name must be 255 characters or fewer.';
  }
  if (draft.accountId.length > 100) {
    errors.accountId = 'Account ID must be 100 characters or fewer.';
  }

  return errors;
}

function hasValidationErrors(errors: ValidationErrors): boolean {
  return Object.values(errors).some(Boolean);
}

function buildRequest(draft: TransactionDraft): CreateTransactionRequest {
  const bankName = draft.bankName.trim();
  const accountId = draft.accountId.trim();

  return {
    date: draft.date,
    description: draft.description.trim(),
    amount: Number(draft.amount),
    currencyIsoCode: draft.currencyIsoCode.trim().toUpperCase(),
    type: draft.type,
    ...(bankName ? { bankName } : {}),
    ...(accountId ? { accountId } : {}),
  };
}

export function CreateTransactionDialog({
  displayCurrency,
  onClose,
  onCreated,
}: CreateTransactionDialogProps) {
  const [draft, setDraft] = useState<TransactionDraft>(() => createInitialDraft(displayCurrency));
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [mutationErrorMessage, setMutationErrorMessage] = useState<string | null>(null);
  const { mutate: createTransaction, isPending } = useCreateTransaction();

  const clearValidationError = useCallback((field: keyof ValidationErrors) => {
    setValidationErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
  }, []);

  const handleDateChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((currentDraft) => ({ ...currentDraft, date: event.target.value }));
      clearValidationError('date');
    },
    [clearValidationError],
  );

  const handleDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((currentDraft) => ({ ...currentDraft, description: event.target.value }));
      clearValidationError('description');
    },
    [clearValidationError],
  );

  const handleAmountChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((currentDraft) => ({ ...currentDraft, amount: event.target.value }));
      clearValidationError('amount');
    },
    [clearValidationError],
  );

  const handleCurrencyChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((currentDraft) => ({
        ...currentDraft,
        currencyIsoCode: event.target.value.toUpperCase(),
      }));
      clearValidationError('currencyIsoCode');
    },
    [clearValidationError],
  );

  const handleTypeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      type: event.target.value as TransactionType,
    }));
  }, []);

  const handleBankNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((currentDraft) => ({ ...currentDraft, bankName: event.target.value }));
      clearValidationError('bankName');
    },
    [clearValidationError],
  );

  const handleAccountIdChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setDraft((currentDraft) => ({ ...currentDraft, accountId: event.target.value }));
      clearValidationError('accountId');
    },
    [clearValidationError],
  );

  const handleDismissMutationError = useCallback(() => {
    setMutationErrorMessage(null);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isPending) onClose();
    },
    [isPending, onClose],
  );

  const handleCancel = useCallback(() => {
    if (!isPending) onClose();
  }, [isPending, onClose]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPending) return;

      const errors = validateDraft(draft);
      setValidationErrors(errors);
      if (hasValidationErrors(errors)) return;

      setMutationErrorMessage(null);
      createTransaction(buildRequest(draft), {
        onSuccess: (createdTransaction) => {
          onCreated(createdTransaction);
          onClose();
        },
        onError: (error) => {
          setMutationErrorMessage(formatApiError(error, CREATE_FAILURE_MESSAGE));
        },
      });
    },
    [createTransaction, draft, isPending, onClose, onCreated],
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" dismissible={!isPending}>
        <DialogHeader>
          <DialogTitle>Create transaction</DialogTitle>
          <DialogDescription>
            Enter a cash or other transaction that was not imported from a statement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate>
          <fieldset disabled={isPending} className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="create-transaction-date" className="text-sm font-medium">
                  Date
                </label>
                <Input
                  id="create-transaction-date"
                  type="date"
                  value={draft.date}
                  onChange={handleDateChange}
                  aria-invalid={Boolean(validationErrors.date) || undefined}
                  aria-describedby={
                    validationErrors.date ? 'create-transaction-date-error' : undefined
                  }
                  autoFocus
                />
                {validationErrors.date && (
                  <p id="create-transaction-date-error" className="text-sm text-destructive">
                    {validationErrors.date}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="create-transaction-type" className="text-sm font-medium">
                  Type
                </label>
                <select
                  id="create-transaction-type"
                  value={draft.type}
                  onChange={handleTypeChange}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="create-transaction-description" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="create-transaction-description"
                value={draft.description}
                onChange={handleDescriptionChange}
                maxLength={500}
                aria-invalid={Boolean(validationErrors.description) || undefined}
                aria-describedby={
                  validationErrors.description ? 'create-transaction-description-error' : undefined
                }
              />
              {validationErrors.description && (
                <p id="create-transaction-description-error" className="text-sm text-destructive">
                  {validationErrors.description}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="create-transaction-amount" className="text-sm font-medium">
                  Amount
                </label>
                <Input
                  id="create-transaction-amount"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={handleAmountChange}
                  aria-invalid={Boolean(validationErrors.amount) || undefined}
                  aria-describedby={
                    validationErrors.amount ? 'create-transaction-amount-error' : undefined
                  }
                />
                {validationErrors.amount && (
                  <p id="create-transaction-amount-error" className="text-sm text-destructive">
                    {validationErrors.amount}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="create-transaction-currency" className="text-sm font-medium">
                  Currency
                </label>
                <Input
                  id="create-transaction-currency"
                  value={draft.currencyIsoCode}
                  onChange={handleCurrencyChange}
                  maxLength={3}
                  autoCapitalize="characters"
                  aria-invalid={Boolean(validationErrors.currencyIsoCode) || undefined}
                  aria-describedby={
                    validationErrors.currencyIsoCode
                      ? 'create-transaction-currency-error'
                      : undefined
                  }
                />
                {validationErrors.currencyIsoCode && (
                  <p id="create-transaction-currency-error" className="text-sm text-destructive">
                    {validationErrors.currencyIsoCode}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="create-transaction-bank" className="text-sm font-medium">
                  Bank name (optional)
                </label>
                <Input
                  id="create-transaction-bank"
                  value={draft.bankName}
                  onChange={handleBankNameChange}
                  maxLength={255}
                  aria-invalid={Boolean(validationErrors.bankName) || undefined}
                  aria-describedby={
                    validationErrors.bankName ? 'create-transaction-bank-error' : undefined
                  }
                />
                {validationErrors.bankName && (
                  <p id="create-transaction-bank-error" className="text-sm text-destructive">
                    {validationErrors.bankName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="create-transaction-account" className="text-sm font-medium">
                  Account ID (optional)
                </label>
                <Input
                  id="create-transaction-account"
                  value={draft.accountId}
                  onChange={handleAccountIdChange}
                  maxLength={100}
                  aria-invalid={Boolean(validationErrors.accountId) || undefined}
                  aria-describedby={
                    validationErrors.accountId ? 'create-transaction-account-error' : undefined
                  }
                />
                {validationErrors.accountId && (
                  <p id="create-transaction-account-error" className="text-sm text-destructive">
                    {validationErrors.accountId}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

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
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
