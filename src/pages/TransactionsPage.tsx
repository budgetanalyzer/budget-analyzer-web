// src/pages/TransactionsPage.tsx
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useTransactionStats } from '@/hooks/useTransactionStats';
import { fadeInVariants, layoutTransition } from '@/lib/animations';
import { TransactionTable } from '@/components/TransactionTable';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TransactionStatsGrid } from '@/components/TransactionStatsGrid';
import { ImportButton } from '@/components/ImportButton';
import { ImportMessageBanner } from '@/components/ImportMessageBanner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Calendar, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@/lib/currency';
import {
  buildImportSuccessMessage,
  buildExchangeRateAvailabilityText,
} from '@/lib/importMessageBuilder';
import { Transaction } from '@/types/transaction';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { useSearchParams } from 'react-router';
import { setTransactionTableDateFilter, setTransactionTableGlobalFilter } from '@/store/uiSlice';

export function TransactionsPage() {
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  // Sync URL params to Redux on mount and when URL changes
  // URL is the source of truth for filters (for bookmarkability)
  useEffect(() => {
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const searchQuery = searchParams.get('q');

    // Always sync URL to Redux, even if empty (to clear filters when URL is cleared)
    dispatch(setTransactionTableDateFilter({ from: dateFrom, to: dateTo }));
    dispatch(setTransactionTableGlobalFilter(searchQuery || ''));
  }, [searchParams, dispatch]);

  // Fetch exchange rates and build map for currency conversion
  const {
    exchangeRatesMap,
    earliestExchangeRateDate,
    isLoading: isExchangeRatesLoading,
  } = useExchangeRatesMap();
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>(
    transactions || [],
  );
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error' | 'warning';
    text: string;
  } | null>(null);

  // Update filteredTransactions when transactions change (on load or after import)
  useEffect(() => {
    if (transactions) {
      setFilteredTransactions(transactions);
    }
  }, [transactions]);

  // Memoized callback for updating URL params when date filter changes
  const handleDateFilterChange = useCallback(
    (from: string | null, to: string | null) => {
      const params = new URLSearchParams(searchParams);
      if (from) {
        params.set('dateFrom', from);
      } else {
        params.delete('dateFrom');
      }
      if (to) {
        params.set('dateTo', to);
      } else {
        params.delete('dateTo');
      }

      // If both filters are cleared, also remove breadcrumb-related params
      if (!from && !to) {
        params.delete('returnTo');
        params.delete('breadcrumbLabel');
      }

      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Memoized callback for updating URL params when search query changes
  const handleSearchChange = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams);
      if (query) {
        params.set('q', query);
      } else {
        params.delete('q');
      }
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Helper to check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return !!(searchParams.get('dateFrom') || searchParams.get('dateTo') || searchParams.get('q'));
  }, [searchParams]);

  // Memoize the earliest rate text since it only depends on memoized values
  const earliestRateText = useMemo(
    () => buildExchangeRateAvailabilityText(earliestExchangeRateDate, exchangeRatesMap),
    [earliestExchangeRateDate, exchangeRatesMap],
  );

  // Calculate stats from FILTERED transactions (provided by the table)
  const { stats, monthlyAverages } = useTransactionStats({
    transactions: filteredTransactions,
    displayCurrency,
    exchangeRatesMap,
  });

  // Memoize stat card configurations
  const mainStats = useMemo(
    () => [
      {
        title: 'Total Transactions',
        value: stats.totalTransactions,
        description: 'Filtered results',
        icon: Wallet,
      },
      {
        title: 'Total Credits',
        value: formatCurrency(stats.totalCredits, displayCurrency),
        description: 'Income received',
        icon: TrendingUp,
        iconClassName: 'text-green-600',
        valueClassName: 'text-green-600 dark:text-green-400',
      },
      {
        title: 'Total Debits',
        value: formatCurrency(stats.totalDebits, displayCurrency),
        description: 'Expenses paid',
        icon: TrendingDown,
        iconClassName: 'text-red-600',
      },
      {
        title: 'Net Balance',
        value: formatCurrency(stats.netBalance, displayCurrency),
        description: 'Current period',
        icon: Scale,
        valueClassName:
          stats.netBalance >= 0
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400',
      },
    ],
    [stats, displayCurrency],
  );

  const monthlyStats = useMemo(
    () => [
      {
        title: 'Avg Transactions/Month',
        value: monthlyAverages.avgTransactionsPerMonth.toFixed(1),
        description: `Based on ${monthlyAverages.dateRange}`,
        icon: Calendar,
      },
      {
        title: 'Avg Credits/Month',
        value: formatCurrency(monthlyAverages.avgCreditsPerMonth, displayCurrency),
        description: 'Average monthly income',
        icon: TrendingUp,
        iconClassName: 'text-green-600',
        valueClassName: 'text-green-600 dark:text-green-400',
      },
      {
        title: 'Avg Debits/Month',
        value: formatCurrency(monthlyAverages.avgDebitsPerMonth, displayCurrency),
        description: 'Average monthly expenses',
        icon: TrendingDown,
        iconClassName: 'text-red-600',
      },
      {
        title: 'Avg Net Balance/Month',
        value: formatCurrency(monthlyAverages.avgNetBalancePerMonth, displayCurrency),
        description: 'Average monthly balance',
        icon: Scale,
        valueClassName:
          monthlyAverages.avgNetBalancePerMonth >= 0
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400',
      },
    ],
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
        action={
          <ImportButton
            onSuccess={(count, importedTransactions) => {
              // Check if any transactions are older than our earliest exchange rate
              // Optimization: Find earliest transaction in O(n) instead of sorting O(n log n)
              let hasOldTransactions = false;

              if (earliestExchangeRateDate && importedTransactions.length > 0) {
                // Find the earliest transaction using reduce (O(n))
                const earliestTransaction = importedTransactions.reduce((earliest, current) =>
                  current.date < earliest.date ? current : earliest,
                );

                // Only need to check the earliest transaction
                hasOldTransactions = earliestTransaction.date < earliestExchangeRateDate;
              }

              // Build the success message based on conditions
              const message = buildImportSuccessMessage({
                count,
                hasOldTransactions,
                earliestRateText,
                filtersActive: hasActiveFilters(),
              });

              setImportMessage(message);

              // Auto-dismiss success messages (but not warnings)
              if (message.type === 'success') {
                setTimeout(() => setImportMessage(null), 5000);
              }
            }}
            onError={(error) => {
              setImportMessage({
                type: 'error',
                text: error.message || 'Failed to import transactions',
              });
            }}
          />
        }
      />

      <LayoutGroup>
        <AnimatePresence>
          {importMessage && (
            <ImportMessageBanner
              type={importMessage.type}
              message={importMessage.text}
              onClose={() => setImportMessage(null)}
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
                  transactions={transactions}
                  onFilteredRowsChange={setFilteredTransactions}
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
