// src/pages/TransactionsPage.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useTransactionStats } from '@/hooks/useTransactionStats';
import { fadeInVariants, fadeTransition } from '@/lib/animations';
import { TransactionTable } from '@/components/TransactionTable';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { TransactionStatsGrid } from '@/components/TransactionStatsGrid';
import { ImportButton } from '@/components/ImportButton';
import { ImportMessageBanner } from '@/components/ImportMessageBanner';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Calendar, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Transaction } from '@/types/transaction';
import { useAppSelector } from '@/store/hooks';

export function TransactionsPage() {
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);

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

  // Memoize the earliest rate text since it only depends on memoized values
  const earliestRateText = useMemo(() => {
    if (!earliestExchangeRateDate) return null;
    const earliestRate = exchangeRatesMap.get(earliestExchangeRateDate);
    const formattedDate = formatDate(earliestExchangeRateDate);
    return earliestRate
      ? `the rate of ${earliestRate.rate.toFixed(4)} THB/USD from ${formattedDate}`
      : `the earliest available rate from ${formattedDate}`;
  }, [earliestExchangeRateDate, exchangeRatesMap]);

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

              if (hasOldTransactions && earliestRateText) {
                // Show persistent warning for old transactions (no auto-dismiss)
                // Use pre-computed memoized rate text
                setImportMessage({
                  type: 'warning',
                  text: `Successfully imported ${count} transaction(s). Some transactions are older than our earliest exchange rate. Currency conversions will use ${earliestRateText}.`,
                });
              } else {
                // Normal success message with auto-dismiss
                setImportMessage({
                  type: 'success',
                  text: `Successfully imported ${count} transaction(s)`,
                });
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

      <AnimatePresence>
        {importMessage && (
          <ImportMessageBanner
            type={importMessage.type}
            message={importMessage.text}
            onClose={() => setImportMessage(null)}
          />
        )}
      </AnimatePresence>

      <TransactionStatsGrid stats={mainStats} isLoading={isExchangeRatesLoading} />

      <TransactionStatsGrid stats={monthlyStats} isLoading={isExchangeRatesLoading} />

      <motion.div
        variants={fadeInVariants}
        initial="initial"
        animate="animate"
        transition={fadeTransition}
      >
        <Card>
          <CardContent className="pt-6">
            {transactions && (
              <TransactionTable
                transactions={transactions}
                onFilteredRowsChange={setFilteredTransactions}
                displayCurrency={displayCurrency}
                exchangeRatesMap={exchangeRatesMap}
                isExchangeRatesLoading={isExchangeRatesLoading}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
