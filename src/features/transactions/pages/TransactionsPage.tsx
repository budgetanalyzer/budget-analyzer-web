// src/features/transactions/pages/TransactionsPage.tsx
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { useTransactions } from '@/hooks/useTransactions';
import { useCurrencies, useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useMissingCurrencies } from '@/hooks/useMissingCurrencies';
import { useTransactionStats } from '@/features/transactions/hooks/useTransactionStats';
import { useTransactionFiltersSync } from '@/hooks/useTransactionFiltersSync';
import { useImportMessageHandler } from '@/features/transactions/hooks/useImportMessageHandler';
import { fadeInVariants, layoutTransition } from '@/lib/animations';
import { TransactionTable } from '@/features/transactions/components/TransactionTable';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TransactionStatsGrid } from '@/features/transactions/components/TransactionStatsGrid';
import { ImportButton } from '@/features/transactions/components/ImportButton';
import { MessageBanner } from '@/components/MessageBanner';
import { MissingExchangeRatesBanner } from '@/components/MissingExchangeRatesBanner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { useMemo, useCallback, useEffect } from 'react';
import {
  buildMainStatsConfig,
  buildMonthlyStatsConfig,
} from '@/features/transactions/components/statsConfig';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setDisplayCurrency } from '@/store/uiSlice';
import { filterTransactionsByDisplayAmount } from '@/utils/transactionFilters';
import { projectDisplayAmount } from '@/utils/displayAmount';
import { usePermission } from '@/features/auth/hooks/usePermission';

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const { data: enabledCurrencies, isLoading: isCurrenciesLoading } = useCurrencies(true);

  const canImportTransactions = usePermission('transactions:write');

  const {
    filters,
    handleDateFilterChange,
    handleSearchChange,
    handleBankNameFilterChange,
    handleAccountIdFilterChange,
    handleTypeFilterChange,
    handleAmountFilterChange,
    hasActiveFilters,
    clearAllFilters,
  } = useTransactionFiltersSync(displayCurrency);
  const { amountFilter, amountCurrency } = filters;

  // Fetch exchange rates and build map for currency conversion
  const {
    exchangeRatesMap,
    pendingCurrencies,
    isLoading: isExchangeRatesLoading,
  } = useExchangeRatesMap({
    displayCurrency,
  });

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
        (transactions ?? []).map((transaction) => [
          transaction.id,
          projectDisplayAmount(transaction, displayCurrency, exchangeRatesMap),
        ]),
      ),
    [displayCurrency, exchangeRatesMap, transactions],
  );

  const disabledCurrencies = useMissingCurrencies();

  const handleRefreshExchangeRates = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['exchangeRates'] });
    queryClient.invalidateQueries({ queryKey: ['currencies'] });
  }, [queryClient]);

  // Compute available filter options from all transactions
  const availableBankNames = useMemo(() => {
    if (!transactions) return [];
    return [...new Set(transactions.map((t) => t.bankName))].sort();
  }, [transactions]);

  const availableAccountIds = useMemo(() => {
    if (!transactions) return [];
    return [...new Set(transactions.map((t) => t.accountId).filter(Boolean) as string[])].sort();
  }, [transactions]);

  // Apply filters to transactions
  const filterResult = useMemo(() => {
    const effectiveFilters =
      isAmountCurrencyInvalid || isAmountFilterLoading
        ? { ...filters, amountFilter: { min: null, max: null } }
        : filters;

    return filterTransactionsByDisplayAmount(transactions ?? [], effectiveFilters, displayAmounts);
  }, [displayAmounts, filters, isAmountCurrencyInvalid, isAmountFilterLoading, transactions]);
  const filteredTransactions = filterResult.transactions;
  const visibleTransactionIds = useMemo(
    () => filteredTransactions.map((transaction) => transaction.id),
    [filteredTransactions],
  );

  // Handle import success/error messages with auto-dismiss
  const { importMessage, handleImportSuccess, handleImportError, clearImportMessage } =
    useImportMessageHandler({
      hasActiveFilters,
    });

  // Calculate stats from FILTERED transactions
  const { stats, monthlyAverages } = useTransactionStats({
    transactions: filteredTransactions,
    displayAmounts,
  });

  // Build stat card configurations using utility functions
  const mainStats = useMemo(
    () => buildMainStatsConfig(stats, displayCurrency),
    [stats, displayCurrency],
  );

  const monthlyStats = useMemo(
    () => buildMonthlyStatsConfig(monthlyAverages, displayCurrency),
    [monthlyAverages, displayCurrency],
  );

  const handleClearInvalidAmountFilter = useCallback(() => {
    handleAmountFilterChange(null, null);
  }, [handleAmountFilterChange]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" text="Loading transactions..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md">
          <ErrorBanner error={error} onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="View and manage transactions"
        action={
          canImportTransactions ? (
            <ImportButton onSuccess={handleImportSuccess} onError={handleImportError} />
          ) : undefined
        }
      />

      <LayoutGroup>
        <AnimatePresence>
          {(disabledCurrencies.length > 0 || pendingCurrencies.length > 0) && (
            <MissingExchangeRatesBanner
              disabledCurrencies={disabledCurrencies}
              pendingCurrencies={pendingCurrencies}
              onRefresh={handleRefreshExchangeRates}
              isRefreshing={isExchangeRatesLoading}
            />
          )}
          {importMessage && (
            <MessageBanner
              type={importMessage.type}
              message={importMessage.text}
              onClose={clearImportMessage}
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

        <motion.div layout transition={layoutTransition}>
          <TransactionStatsGrid stats={mainStats} isLoading={isDisplayAmountLoading} />
        </motion.div>

        <motion.div layout transition={layoutTransition}>
          <TransactionStatsGrid stats={monthlyStats} isLoading={isDisplayAmountLoading} />
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
              {transactions && (
                <TransactionTable
                  transactions={filteredTransactions}
                  filters={filters}
                  onDateFilterChange={handleDateFilterChange}
                  onSearchChange={handleSearchChange}
                  onBankNameFilterChange={handleBankNameFilterChange}
                  onAccountIdFilterChange={handleAccountIdFilterChange}
                  onTypeFilterChange={handleTypeFilterChange}
                  onAmountFilterChange={handleAmountFilterChange}
                  onClearAllFilters={clearAllFilters}
                  displayCurrency={displayCurrency}
                  displayAmounts={displayAmounts}
                  isDisplayAmountLoading={isDisplayAmountLoading}
                  isAmountFilterLoading={isAmountFilterLoading}
                  unavailableAmountFilterCount={
                    hasAmountFilter && !isAmountFilterLoading && !isAmountCurrencyInvalid
                      ? filterResult.unavailableAmountCount
                      : 0
                  }
                  availableBankNames={availableBankNames}
                  availableAccountIds={availableAccountIds}
                  viewTransactionIds={visibleTransactionIds}
                  isViewTransactionIdsReady={!isAmountFilterLoading}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </LayoutGroup>
    </div>
  );
}
