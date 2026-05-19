// src/features/transactions/pages/TransactionDetailPage.tsx
import { useCallback, useMemo, useState, type ChangeEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { motion, LayoutGroup } from 'framer-motion';
import { useTransaction, useUpdateTransaction } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { fadeInVariants, fadeTransition, layoutTransition } from '@/lib/animations';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { BackButton } from '@/components/BackButton';
import { IconLabel } from '@/components/IconLabel';
import { CurrencyConversionCard } from '@/features/transactions/components/CurrencyConversionCard';
import { DeleteTransactionModal } from '@/features/transactions/components/DeleteTransactionModal';
import { TransactionMetadataCard } from '@/features/transactions/components/TransactionMetadataCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/utils/currency';
import { formatLocalDate } from '@/utils/dates';
import {
  Calendar,
  Banknote,
  Building2,
  CreditCard,
  FileText,
  Currency,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { useAppSelector } from '@/store/hooks';
import { convertCurrency, findNearestExchangeRate } from '@/utils/currency';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { toast } from '@/hooks/useToast';
import { formatApiError } from '@/utils/errorMessages';

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const transactionId = Number(id);
  const navigate = useNavigate();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const canEditTransaction = usePermission('transactions:write');
  const canDeleteTransaction = usePermission('transactions:delete');

  const { data: transaction, isLoading, error, refetch } = useTransaction(transactionId);
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();
  const [isEditing, setIsEditing] = useState(false);
  const [editingDescription, setEditingDescription] = useState('');
  const [editingAccountId, setEditingAccountId] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Fetch exchange rates and build map for currency conversion
  const { exchangeRatesMap } = useExchangeRatesMap({
    displayCurrency,
  });

  // Calculate conversion info
  const conversionInfo = useMemo(() => {
    if (!transaction) return null;

    const sourceCurrency = transaction.currencyIsoCode;
    const needsConversion = sourceCurrency !== displayCurrency;

    if (!needsConversion) {
      return { needsConversion: false as const };
    }

    const convertedAmount = convertCurrency(
      transaction.amount,
      transaction.date,
      sourceCurrency,
      displayCurrency,
      exchangeRatesMap,
    );

    // Determine which currency rate to display to the user
    // For X->USD conversions, show the source currency rate
    // For all other conversions (USD->X or X->Y), show the target currency rate
    const currencyToLookup = displayCurrency === 'USD' ? sourceCurrency : displayCurrency;

    // Get the full exchange rate response from the map (or nearest available)
    const exchangeRateResponse = findNearestExchangeRate(
      transaction.date,
      currencyToLookup,
      exchangeRatesMap,
    );

    // State 3: Missing rate - we had to use a rate from a completely different date
    const usedFallbackRate = exchangeRateResponse?.date !== transaction.date;

    return {
      needsConversion: true as const,
      convertedAmount,
      rate: exchangeRateResponse?.rate,
      rateDate: exchangeRateResponse?.date,
      usedFallbackRate,
      sourceCurrency,
      targetCurrency: displayCurrency,
    };
  }, [transaction, displayCurrency, exchangeRatesMap]);

  const handleStartEdit = useCallback(() => {
    if (!transaction) return;

    setEditingDescription(transaction.description);
    setEditingAccountId(transaction.accountId || '');
    setIsEditing(true);
  }, [transaction]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingDescription('');
    setEditingAccountId('');
  }, []);

  const handleDescriptionChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEditingDescription(event.target.value);
  }, []);

  const handleAccountIdChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setEditingAccountId(event.target.value);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!transaction) return;

    const descriptionChanged = editingDescription !== transaction.description;
    const accountIdChanged = editingAccountId !== (transaction.accountId || '');

    if (!descriptionChanged && !accountIdChanged) {
      handleCancelEdit();
      return;
    }

    updateTransaction(
      {
        id: transaction.id,
        data: {
          ...(descriptionChanged ? { description: editingDescription } : {}),
          ...(accountIdChanged ? { accountId: editingAccountId } : {}),
        },
      },
      {
        onSuccess: () => {
          toast.success('Transaction updated');
          handleCancelEdit();
        },
        onError: (updateError) => {
          toast.error(formatApiError(updateError, 'Failed to update transaction'));
        },
      },
    );
  }, [editingAccountId, editingDescription, handleCancelEdit, transaction, updateTransaction]);

  const handleOpenDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
  }, []);

  const handleDeleted = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading transaction details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <BackButton />
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="w-full max-w-md">
            <ErrorBanner error={error} onRetry={handleRetry} />
          </div>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return null;
  }

  return (
    <motion.div
      variants={fadeInVariants}
      initial="initial"
      animate="animate"
      transition={fadeTransition}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <BackButton />
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={isUpdating}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isUpdating}>
                <Check className="mr-2 h-4 w-4" />
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <>
              {canEditTransaction && (
                <Button variant="outline" onClick={handleStartEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Details
                </Button>
              )}
              {canDeleteTransaction && (
                <Button variant="destructive" onClick={handleOpenDeleteDialog}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Link to="/">
                <Button variant="outline">View All</Button>
              </Link>
            </>
          )}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transaction Details</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={fadeTransition}
        >
          <Card>
            <CardHeader>
              <CardTitle>Transaction Information</CardTitle>
              <CardDescription>Core transaction details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Banknote className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p
                    className={`text-2xl font-bold ${
                      transaction.type === 'CREDIT'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-foreground'
                    }`}
                  >
                    {formatCurrency(transaction.amount, transaction.currencyIsoCode)}
                  </p>
                </div>
                <Badge variant={transaction.type === 'CREDIT' ? 'success' : 'secondary'}>
                  {transaction.type}
                </Badge>
              </div>

              {isEditing ? (
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor="transaction-description"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Description
                    </label>
                    <Input
                      id="transaction-description"
                      value={editingDescription}
                      onChange={handleDescriptionChange}
                      disabled={isUpdating}
                      maxLength={500}
                    />
                  </div>
                </div>
              ) : (
                <IconLabel icon={FileText} label="Description" value={transaction.description} />
              )}

              <IconLabel
                icon={Calendar}
                label="Transaction Date"
                value={formatLocalDate(transaction.date)}
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={fadeTransition}
        >
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Bank and account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IconLabel icon={Building2} label="Bank Name" value={transaction.bankName} />

              {isEditing ? (
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <label
                      htmlFor="transaction-account-id"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      Account ID
                    </label>
                    <Input
                      id="transaction-account-id"
                      value={editingAccountId}
                      onChange={handleAccountIdChange}
                      disabled={isUpdating}
                      maxLength={100}
                    />
                  </div>
                </div>
              ) : (
                <IconLabel
                  icon={CreditCard}
                  label="Account ID"
                  value={transaction.accountId}
                  valueClassName="text-base font-mono"
                />
              )}

              <IconLabel icon={Currency} label="Currency" value={transaction.currencyIsoCode} />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Currency Conversion Card - Only show if conversion is needed */}
      <LayoutGroup>
        <CurrencyConversionCard
          conversionInfo={conversionInfo}
          originalAmount={transaction.amount}
          transactionType={transaction.type}
        />

        <motion.div
          layout
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={{ ...fadeTransition, layout: layoutTransition }}
        >
          <TransactionMetadataCard
            createdAt={transaction.createdAt}
            updatedAt={transaction.updatedAt}
          />
        </motion.div>
      </LayoutGroup>

      <DeleteTransactionModal
        transaction={transaction}
        isOpen={deleteDialogOpen}
        onOpenChange={handleDeleteDialogOpenChange}
        displayCurrency={displayCurrency}
        exchangeRatesMap={exchangeRatesMap}
        onDeleted={handleDeleted}
      />
    </motion.div>
  );
}
