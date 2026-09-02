import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ArrowLeft, BarChart3, Calendar, Hash, Plus } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { ErrorBanner } from '@/components/ErrorBanner';
import { CreateViewModal } from '@/components/CreateViewModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { MessageBanner } from '@/components/MessageBanner';
import { MissingExchangeRatesBanner } from '@/components/MissingExchangeRatesBanner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { buildAnalyticsReturnUrl } from '@/features/analytics/utils/urlState';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { TransactionStatsGrid } from '@/features/transactions/components/TransactionStatsGrid';
import type { StatCardConfig } from '@/features/transactions/components/TransactionStatsGrid';
import { useTransactionStats } from '@/features/transactions/hooks/useTransactionStats';
import { DeleteViewModal } from '@/features/views/components/DeleteViewModal';
import { EditViewModal } from '@/features/views/components/EditViewModal';
import { TransferRefundReviewDialog } from '@/features/views/components/TransferRefundReviewDialog';
import { ViewActionsMenu } from '@/features/views/components/ViewActionsMenu';
import { ViewTransactionTable } from '@/features/views/components/ViewTransactionTable';
import { findTransferRefundCandidates } from '@/features/views/utils/findTransferRefundCandidates';
import { useCurrencies, useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useMissingCurrencies } from '@/hooks/useMissingCurrencies';
import { useTransactionFiltersSync } from '@/hooks/useTransactionFiltersSync';
import { useView, useViewTransactions } from '@/hooks/useViews';
import { fadeInVariants, layoutTransition } from '@/lib/animations';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDisplayCurrency } from '@/store/uiSlice';
import { formatCurrency } from '@/utils/currency';
import { formatLocalDate, getDateRange } from '@/utils/dates';
import { projectDisplayAmount } from '@/utils/displayAmount';
import { filterTransactionsByDisplayAmount } from '@/utils/transactionFilters';
import { buildAddTransactionsModeUrl } from '@/utils/addTransactionsMode';

function describeViewAmountTotal(
  baseDescription: string,
  availableAmountCount: number,
  unavailableAmountCount: number,
): string {
  if (availableAmountCount === 0 && unavailableAmountCount > 0) {
    return `Conversion unavailable for all ${unavailableAmountCount} transactions`;
  }
  if (unavailableAmountCount > 0) {
    return `${baseDescription} · Partial; ${unavailableAmountCount} unavailable`;
  }
  return baseDescription;
}

export function ViewPage() {
  const { id } = useParams<{ id: string }>();
  return <ViewPageContent key={id} id={id!} />;
}

function ViewPageContent({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const canWrite = usePermission('views:write');
  const canDelete = usePermission('views:delete');
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isTransferRefundReviewOpen, setIsTransferRefundReviewOpen] = useState(false);

  const handleDuplicateClick = useCallback(() => setIsDuplicateModalOpen(true), []);
  const handleRenameClick = useCallback(() => setIsRenameModalOpen(true), []);
  const handleDeleteClick = useCallback(() => setIsDeleteModalOpen(true), []);
  const handleDuplicateClose = useCallback(() => setIsDuplicateModalOpen(false), []);
  const handleRenameClose = useCallback(() => setIsRenameModalOpen(false), []);
  const handleDeleteClose = useCallback(() => setIsDeleteModalOpen(false), []);
  const handleTransferRefundReviewOpen = useCallback(() => {
    setIsTransferRefundReviewOpen(true);
  }, []);
  const handleTransferRefundReviewClose = useCallback(() => {
    setIsTransferRefundReviewOpen(false);
  }, []);

  const {
    filters,
    handleDateFilterChange,
    handleSearchChange,
    handleBankNameFilterChange,
    handleAccountIdFilterChange,
    handleTypeFilterChange,
    handleAmountFilterChange,
    clearAllFilters,
  } = useTransactionFiltersSync(displayCurrency);
  const { amountFilter, amountCurrency } = filters;

  const {
    data: view,
    isLoading: isViewLoading,
    error: viewError,
    refetch: refetchView,
  } = useView(id);
  const {
    data: transactions,
    allTransactions,
    memberTransactionIds,
    missingTransactionIds,
    isLoading: isTransactionsLoading,
    error: transactionsError,
    refetch: refetchTransactions,
  } = useViewTransactions(id);
  const { data: enabledCurrencies, isLoading: isCurrenciesLoading } = useCurrencies(true);
  const {
    exchangeRatesMap,
    pendingCurrencies,
    isLoading: isExchangeRatesLoading,
    error: exchangeRatesError,
  } = useExchangeRatesMap({ displayCurrency });

  const transferRefundDiscoveryError = transactionsError || exchangeRatesError || null;
  const transferRefundCandidates = useMemo(() => {
    if (
      !isTransferRefundReviewOpen ||
      isTransactionsLoading ||
      isExchangeRatesLoading ||
      transferRefundDiscoveryError
    ) {
      return [];
    }

    return findTransferRefundCandidates(
      allTransactions ?? [],
      new Set(memberTransactionIds),
      exchangeRatesMap,
    );
  }, [
    allTransactions,
    exchangeRatesMap,
    isExchangeRatesLoading,
    isTransactionsLoading,
    isTransferRefundReviewOpen,
    memberTransactionIds,
    transferRefundDiscoveryError,
  ]);

  const hasAmountFilter = amountFilter.min !== null || amountFilter.max !== null;
  const enabledCurrencyCodes = useMemo(() => {
    const codes = new Set(['USD']);
    enabledCurrencies?.forEach((currency) => codes.add(currency.currencyCode));
    return codes;
  }, [enabledCurrencies]);
  const isAmountCurrencyValidationPending = hasAmountFilter && isCurrenciesLoading;
  const isAmountCurrencyInvalid =
    hasAmountFilter &&
    !isAmountCurrencyValidationPending &&
    (!amountCurrency ||
      !/^[A-Z]{3}$/.test(amountCurrency) ||
      !enabledCurrencyCodes.has(amountCurrency));
  const isAmountCurrencySyncing =
    hasAmountFilter &&
    !isAmountCurrencyValidationPending &&
    !isAmountCurrencyInvalid &&
    amountCurrency !== displayCurrency;

  useEffect(() => {
    if (isAmountCurrencySyncing && amountCurrency) {
      dispatch(setDisplayCurrency(amountCurrency));
    }
  }, [amountCurrency, dispatch, isAmountCurrencySyncing]);

  const isAmountFilterLoading =
    hasAmountFilter &&
    !isAmountCurrencyInvalid &&
    (isAmountCurrencyValidationPending || isAmountCurrencySyncing || isExchangeRatesLoading);
  const isDisplayAmountLoading =
    isExchangeRatesLoading || isAmountCurrencyValidationPending || isAmountCurrencySyncing;

  const displayAmounts = useMemo(
    () =>
      new Map(
        (allTransactions ?? transactions ?? []).map((transaction) => [
          transaction.id,
          projectDisplayAmount(transaction, displayCurrency, exchangeRatesMap),
        ]),
      ),
    [allTransactions, displayCurrency, exchangeRatesMap, transactions],
  );

  const filterResult = useMemo(() => {
    const effectiveFilters =
      isAmountCurrencyInvalid || isAmountFilterLoading
        ? { ...filters, amountFilter: { min: null, max: null } }
        : filters;

    return filterTransactionsByDisplayAmount(transactions ?? [], effectiveFilters, displayAmounts);
  }, [displayAmounts, filters, isAmountCurrencyInvalid, isAmountFilterLoading, transactions]);
  const filteredTransactions = filterResult.transactions;
  const availableBankNames = useMemo(
    () => [...new Set((transactions ?? []).map((transaction) => transaction.bankName))].sort(),
    [transactions],
  );
  const availableAccountIds = useMemo(
    () =>
      [
        ...new Set(
          (transactions ?? [])
            .map((transaction) => transaction.accountId)
            .filter(Boolean) as string[],
        ),
      ].sort(),
    [transactions],
  );

  const { stats: transactionStats } = useTransactionStats({
    transactions: filteredTransactions,
    displayAmounts,
  });
  const stats = useMemo<StatCardConfig[]>(() => {
    const dateRange = getDateRange(filteredTransactions.map((transaction) => transaction.date));
    const dateRangeDescription = dateRange
      ? dateRange.earliest === dateRange.latest
        ? formatLocalDate(dateRange.earliest)
        : `${formatLocalDate(dateRange.earliest)} - ${formatLocalDate(dateRange.latest)}`
      : 'No transactions';

    return [
      {
        title: 'Total Transactions',
        value: transactionStats.totalTransactions.toString(),
        description: dateRangeDescription,
        icon: Hash,
        iconClassName: 'text-blue-500',
      },
      {
        title: 'Total Spend',
        value:
          transactionStats.totalDebits === null
            ? 'Unavailable'
            : formatCurrency(transactionStats.totalDebits, displayCurrency),
        description: describeViewAmountTotal(
          'Sum of visible debits',
          transactionStats.availableDebitAmountCount,
          transactionStats.unavailableDebitAmountCount,
        ),
        icon: Calendar,
        iconClassName: 'text-red-500',
        valueClassName: 'text-red-600 dark:text-red-400',
      },
      {
        title: 'Total Income',
        value:
          transactionStats.totalCredits === null
            ? 'Unavailable'
            : formatCurrency(transactionStats.totalCredits, displayCurrency),
        description: describeViewAmountTotal(
          'Sum of visible credits',
          transactionStats.availableCreditAmountCount,
          transactionStats.unavailableCreditAmountCount,
        ),
        icon: Calendar,
        iconClassName: 'text-green-500',
        valueClassName: 'text-green-600 dark:text-green-400',
      },
    ];
  }, [displayCurrency, filteredTransactions, transactionStats]);

  const handleRetry = useCallback(() => {
    refetchView();
    refetchTransactions();
  }, [refetchTransactions, refetchView]);
  const handleRefreshExchangeRates = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['exchangeRates'] });
    queryClient.invalidateQueries({ queryKey: ['currencies'] });
  }, [queryClient]);
  const handleTransferRefundDiscoveryRetry = useCallback(() => {
    refetchTransactions();
    queryClient.invalidateQueries({ queryKey: ['exchangeRates'] });
  }, [queryClient, refetchTransactions]);
  const handleClearInvalidAmountFilter = useCallback(() => {
    handleAmountFilterChange(null, null);
  }, [handleAmountFilterChange]);

  const disabledCurrencies = useMissingCurrencies();
  const isLoading = isViewLoading || isTransactionsLoading;
  const error = viewError || transactionsError;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading view..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="w-full max-w-md">
          <ErrorBanner error={error} onRetry={handleRetry} />
        </div>
        {error.status === 404 && (
          <Link to="/">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Transactions
            </Button>
          </Link>
        )}
      </div>
    );
  }

  if (!view || !transactions) return null;

  const analyzeViewUrl = buildAnalyticsReturnUrl({
    scope: 'view',
    viewId: id,
    viewMode: 'monthly',
    transactionType: 'debit',
  });
  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const addTransactionsUrl = buildAddTransactionsModeUrl({
    viewId: view.id,
    returnTo,
    sourceSearchParams: new URLSearchParams(location.search),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={view.name}
        description={`${view.transactionCount} transactions`}
        descriptionAction={
          <Link
            to={analyzeViewUrl}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <BarChart3 className="h-4 w-4" />
            Open in Analytics
          </Link>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && addTransactionsUrl && (
              <Link
                to={addTransactionsUrl}
                className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add transactions
              </Link>
            )}
            <ViewActionsMenu
              onRenameClick={handleRenameClick}
              onDuplicateClick={handleDuplicateClick}
              onDeleteClick={handleDeleteClick}
            />
          </div>
        }
      />

      <AnimatePresence>
        {(disabledCurrencies.length > 0 || pendingCurrencies.length > 0) && (
          <MissingExchangeRatesBanner
            disabledCurrencies={disabledCurrencies}
            pendingCurrencies={pendingCurrencies}
            onRefresh={handleRefreshExchangeRates}
            isRefreshing={isExchangeRatesLoading}
          />
        )}
        {isAmountCurrencyInvalid && (
          <MessageBanner
            type="warning"
            message="Amount filter ignored because its currency is invalid or disabled. Clear it and enter a new range."
            onClose={handleClearInvalidAmountFilter}
          />
        )}
      </AnimatePresence>

      {missingTransactionIds.length > 0 && (
        <div className="rounded-md bg-warning/15 px-4 py-3 text-sm text-warning" role="status">
          {missingTransactionIds.length}{' '}
          {missingTransactionIds.length === 1 ? 'membership is' : 'memberships are'} not available
          in the current transaction snapshot.
        </div>
      )}

      <LayoutGroup>
        <motion.div layout transition={layoutTransition}>
          <TransactionStatsGrid stats={stats} isLoading={isDisplayAmountLoading} />
        </motion.div>

        <motion.div
          layout
          variants={fadeInVariants}
          initial="initial"
          animate="animate"
          transition={layoutTransition}
        >
          <Card>
            <CardContent className="pt-6">
              <ViewTransactionTable
                transactions={filteredTransactions}
                viewId={id}
                filters={filters}
                availableBankNames={availableBankNames}
                availableAccountIds={availableAccountIds}
                onSearchChange={handleSearchChange}
                onDateFilterChange={handleDateFilterChange}
                onBankNameFilterChange={handleBankNameFilterChange}
                onAccountIdFilterChange={handleAccountIdFilterChange}
                onTypeFilterChange={handleTypeFilterChange}
                onAmountFilterChange={handleAmountFilterChange}
                onClearAllFilters={clearAllFilters}
                displayCurrency={displayCurrency}
                displayAmounts={displayAmounts}
                isDisplayAmountLoading={isDisplayAmountLoading}
                isAmountFilterLoading={isAmountFilterLoading}
                onReviewPossibleTransfersAndRefunds={
                  canWrite ? handleTransferRefundReviewOpen : undefined
                }
                unavailableAmountFilterCount={
                  hasAmountFilter && !isAmountFilterLoading && !isAmountCurrencyInvalid
                    ? filterResult.unavailableAmountCount
                    : 0
                }
              />
            </CardContent>
          </Card>
        </motion.div>
      </LayoutGroup>

      {canWrite && isDuplicateModalOpen && (
        <CreateViewModal
          open
          onClose={handleDuplicateClose}
          sourceViewId={view.id}
          title="Duplicate view"
        />
      )}
      {canWrite && isRenameModalOpen && (
        <EditViewModal open onClose={handleRenameClose} view={view} />
      )}
      {canDelete && isDeleteModalOpen && (
        <DeleteViewModal open onClose={handleDeleteClose} view={view} />
      )}
      {canWrite && isTransferRefundReviewOpen && (
        <TransferRefundReviewDialog
          viewId={view.id}
          viewName={view.name}
          candidates={transferRefundCandidates}
          displayAmounts={displayAmounts}
          isLoading={isTransactionsLoading || isExchangeRatesLoading}
          error={transferRefundDiscoveryError}
          onRetry={handleTransferRefundDiscoveryRetry}
          onClose={handleTransferRefundReviewClose}
          onComplete={handleTransferRefundReviewClose}
        />
      )}
    </div>
  );
}
