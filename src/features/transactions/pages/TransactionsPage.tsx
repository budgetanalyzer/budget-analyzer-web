// src/features/transactions/pages/TransactionsPage.tsx
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useTransactionStats } from '@/features/transactions/hooks/useTransactionStats';
import { useTransactionFiltersSync } from '@/features/transactions/hooks/useTransactionFiltersSync';
import { useImportMessageHandler } from '@/features/transactions/hooks/useImportMessageHandler';
import { fadeInVariants, layoutTransition } from '@/lib/animations';
import { TransactionTable } from '@/features/transactions/components/TransactionTable';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TransactionStatsGrid } from '@/features/transactions/components/TransactionStatsGrid';
import { ImportButton } from '@/features/transactions/components/ImportButton';
import { MessageBanner } from '@/components/MessageBanner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { useMemo } from 'react';
import {
  buildMainStatsConfig,
  buildMonthlyStatsConfig,
} from '@/features/transactions/components/statsConfig';
import { useAppSelector } from '@/store/hooks';
import { isDateInRange } from '@/utils/dates';
import { parseSearchTerms } from '@/utils/parseSearchTerms';
import { ViewCriteriaApi } from '@/types/view';

export function TransactionsPage() {
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const globalFilter = useAppSelector((state) => state.ui.transactionTable.globalFilter);
  const dateFilter = useAppSelector((state) => state.ui.transactionTable.dateFilter);
  const bankNameFilter = useAppSelector((state) => state.ui.transactionTable.bankNameFilter);
  const accountIdFilter = useAppSelector((state) => state.ui.transactionTable.accountIdFilter);
  const typeFilter = useAppSelector((state) => state.ui.transactionTable.typeFilter);
  const amountFilter = useAppSelector((state) => state.ui.transactionTable.amountFilter);

  // Sync URL params with Redux state for transaction filters
  const {
    handleDateFilterChange,
    handleSearchChange,
    handleBankNameFilterChange,
    handleAccountIdFilterChange,
    handleTypeFilterChange,
    handleAmountFilterChange,
    hasActiveFilters,
    clearAllFilters,
  } = useTransactionFiltersSync();

  // Fetch exchange rates and build map for currency conversion
  const { exchangeRatesMap, isLoading: isExchangeRatesLoading } = useExchangeRatesMap({
    displayCurrency,
  });

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
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    let filtered = transactions;

    // Apply date filter
    if (dateFilter?.from && dateFilter?.to) {
      filtered = filtered.filter((transaction) =>
        isDateInRange(transaction.date, dateFilter.from!, dateFilter.to!),
      );
    }

    // Apply text search filter (supports quoted phrases and OR matching)
    if (globalFilter) {
      const searchTerms = parseSearchTerms(globalFilter);
      if (searchTerms.length > 0) {
        filtered = filtered.filter((transaction) => {
          const description = transaction.description.toLowerCase();
          const bankName = transaction.bankName.toLowerCase();
          // OR: match if ANY term matches
          return searchTerms.some((term) => description.includes(term) || bankName.includes(term));
        });
      }
    }

    // Apply bank name filter
    if (bankNameFilter) {
      filtered = filtered.filter((transaction) => transaction.bankName === bankNameFilter);
    }

    // Apply account ID filter
    if (accountIdFilter) {
      filtered = filtered.filter((transaction) => transaction.accountId === accountIdFilter);
    }

    // Apply type filter
    if (typeFilter) {
      filtered = filtered.filter((transaction) => transaction.type === typeFilter);
    }

    // Apply amount filter
    if (amountFilter.min !== null) {
      filtered = filtered.filter(
        (transaction) => Math.abs(transaction.amount) >= amountFilter.min!,
      );
    }
    if (amountFilter.max !== null) {
      filtered = filtered.filter(
        (transaction) => Math.abs(transaction.amount) <= amountFilter.max!,
      );
    }

    return filtered;
  }, [
    transactions,
    dateFilter,
    globalFilter,
    bankNameFilter,
    accountIdFilter,
    typeFilter,
    amountFilter,
  ]);

  // Handle import success/error messages with auto-dismiss
  const { importMessage, handleImportSuccess, handleImportError, clearImportMessage } =
    useImportMessageHandler({
      hasActiveFilters,
    });

  // Calculate stats from FILTERED transactions
  const { stats, monthlyAverages } = useTransactionStats({
    transactions: filteredTransactions,
    displayCurrency,
    exchangeRatesMap,
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

  // Build criteria from current filters for SaveAsViewButton
  const viewCriteria = useMemo((): ViewCriteriaApi => {
    const criteria: ViewCriteriaApi = {};
    if (dateFilter?.from) {
      criteria.startDate = dateFilter.from;
    }
    if (dateFilter?.to) {
      criteria.endDate = dateFilter.to;
    }
    if (globalFilter) {
      criteria.searchText = globalFilter;
    }
    if (bankNameFilter) {
      criteria.bankNames = [bankNameFilter];
    }
    if (accountIdFilter) {
      criteria.accountIds = [accountIdFilter];
    }
    if (amountFilter.min !== null) {
      criteria.minAmount = amountFilter.min;
    }
    if (amountFilter.max !== null) {
      criteria.maxAmount = amountFilter.max;
    }
    return criteria;
  }, [dateFilter, globalFilter, bankNameFilter, accountIdFilter, amountFilter]);

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
        action={<ImportButton onSuccess={handleImportSuccess} onError={handleImportError} />}
      />

      <LayoutGroup>
        <AnimatePresence>
          {importMessage && (
            <MessageBanner
              type={importMessage.type}
              message={importMessage.text}
              onClose={clearImportMessage}
            />
          )}
        </AnimatePresence>

        <motion.div layout transition={layoutTransition}>
          <TransactionStatsGrid stats={mainStats} isLoading={isExchangeRatesLoading} />
        </motion.div>

        <motion.div layout transition={layoutTransition}>
          <TransactionStatsGrid stats={monthlyStats} isLoading={isExchangeRatesLoading} />
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
                  onDateFilterChange={handleDateFilterChange}
                  onSearchChange={handleSearchChange}
                  onBankNameFilterChange={handleBankNameFilterChange}
                  onAccountIdFilterChange={handleAccountIdFilterChange}
                  onTypeFilterChange={handleTypeFilterChange}
                  onAmountFilterChange={handleAmountFilterChange}
                  onClearAllFilters={clearAllFilters}
                  displayCurrency={displayCurrency}
                  exchangeRatesMap={exchangeRatesMap}
                  isExchangeRatesLoading={isExchangeRatesLoading}
                  availableBankNames={availableBankNames}
                  availableAccountIds={availableAccountIds}
                  viewCriteria={viewCriteria}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </LayoutGroup>
    </div>
  );
}
