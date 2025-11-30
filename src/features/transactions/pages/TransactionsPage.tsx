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

export function TransactionsPage() {
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const globalFilter = useAppSelector((state) => state.ui.transactionTable.globalFilter);
  const dateFilter = useAppSelector((state) => state.ui.transactionTable.dateFilter);

  // Sync URL params with Redux state for transaction filters
  const { handleDateFilterChange, handleSearchChange, hasActiveFilters } =
    useTransactionFiltersSync();

  // Fetch exchange rates and build map for currency conversion
  const { exchangeRatesMap, isLoading: isExchangeRatesLoading } = useExchangeRatesMap({
    displayCurrency,
  });

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

    // Apply text search filter
    if (globalFilter) {
      const searchLower = globalFilter.toLowerCase();
      filtered = filtered.filter((transaction) => {
        return (
          transaction.description.toLowerCase().includes(searchLower) ||
          transaction.bankName.toLowerCase().includes(searchLower) ||
          (transaction.accountId && transaction.accountId.toLowerCase().includes(searchLower))
        );
      });
    }

    return filtered;
  }, [transactions, dateFilter, globalFilter]);

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
                  displayCurrency={displayCurrency}
                  exchangeRatesMap={exchangeRatesMap}
                  isExchangeRatesLoading={isExchangeRatesLoading}
                />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </LayoutGroup>
    </div>
  );
}
