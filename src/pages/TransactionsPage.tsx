// src/pages/TransactionsPage.tsx
import { motion, AnimatePresence } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { fadeInVariants, fadeVariants, fadeTransition } from '@/lib/animations';
import { TransactionTable } from '@/components/TransactionTable';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatCard } from '@/components/StatCard';
import { ImportButton } from '@/components/ImportButton';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Calendar,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Transaction } from '@/types/transaction';
import { differenceInDays, parseISO } from 'date-fns';
import { useAppSelector } from '@/store/hooks';
import { convertCurrency } from '@/lib/currency';

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
  // Convert all amounts to display currency before calculating totals
  // Optimization: Single-pass through transactions instead of 4 passes
  const stats = useMemo(() => {
    const startTime = performance.now();
    console.log('[Stats] Starting calculation for', filteredTransactions.length, 'transactions');

    if (!filteredTransactions.length) {
      return {
        totalTransactions: 0,
        totalCredits: 0,
        totalDebits: 0,
        netBalance: 0,
      };
    }

    const { totalCredits, totalDebits } = filteredTransactions.reduce(
      (acc, t) => {
        const convertedAmount = convertCurrency(
          Math.abs(t.amount),
          t.date,
          t.currencyIsoCode,
          displayCurrency,
          exchangeRatesMap,
        );

        if (t.type === 'CREDIT') {
          acc.totalCredits += convertedAmount;
        } else {
          acc.totalDebits += convertedAmount;
        }

        return acc;
      },
      { totalCredits: 0, totalDebits: 0 },
    );

    const netBalance = totalCredits - totalDebits;

    const endTime = performance.now();
    console.log('[Stats] Calculation took', (endTime - startTime).toFixed(2), 'ms');

    return {
      totalTransactions: filteredTransactions.length,
      totalCredits,
      totalDebits,
      netBalance,
    };
  }, [filteredTransactions, displayCurrency, exchangeRatesMap]);

  // Calculate monthly averages based on date range of filtered transactions
  // Optimization: Find min/max dates in O(n) instead of sorting O(n log n)
  const monthlyAverages = useMemo(() => {
    if (!filteredTransactions.length || filteredTransactions.length < 2) {
      return {
        avgTransactionsPerMonth: 0,
        avgCreditsPerMonth: 0,
        avgDebitsPerMonth: 0,
        avgNetBalancePerMonth: 0,
        dateRange: '0 days',
      };
    }

    // Find earliest and latest dates in a single pass O(n)
    let firstDate = parseISO(filteredTransactions[0].date);
    let lastDate = firstDate;

    for (let i = 1; i < filteredTransactions.length; i++) {
      const currentDate = parseISO(filteredTransactions[i].date);
      if (currentDate < firstDate) firstDate = currentDate;
      if (currentDate > lastDate) lastDate = currentDate;
    }

    const totalDays = differenceInDays(lastDate, firstDate);

    // If all transactions are on the same day, return zeros
    if (totalDays === 0) {
      return {
        avgTransactionsPerMonth: 0,
        avgCreditsPerMonth: 0,
        avgDebitsPerMonth: 0,
        avgNetBalancePerMonth: 0,
        dateRange: '0 days',
      };
    }

    // Calculate months (assuming 30 days per month for average)
    const months = totalDays / 30;

    return {
      avgTransactionsPerMonth: stats.totalTransactions / months,
      avgCreditsPerMonth: stats.totalCredits / months,
      avgDebitsPerMonth: stats.totalDebits / months,
      avgNetBalancePerMonth: stats.netBalance / months,
      dateRange: `${totalDays} days`,
    };
  }, [filteredTransactions, stats]);

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
      <motion.div
        variants={fadeInVariants}
        initial="initial"
        animate="animate"
        transition={fadeTransition}
        className="flex items-start justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">View and manage transactions</p>
        </div>
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
      </motion.div>

      <AnimatePresence>
        {importMessage && (
          <motion.div
            key="import-message"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={fadeTransition}
            className={`flex items-center justify-between rounded-lg px-4 py-3 ${
              importMessage.type === 'success'
                ? 'bg-success/15 text-success'
                : importMessage.type === 'warning'
                  ? 'bg-warning/15 text-warning'
                  : 'bg-destructive/15 text-destructive'
            }`}
          >
            <div className="flex items-center gap-2">
              {importMessage.type === 'success' ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <span className="font-medium">{importMessage.text}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setImportMessage(null)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Transactions"
            value={stats.totalTransactions}
            description="Filtered results"
            icon={Wallet}
            isLoading={isExchangeRatesLoading}
          />
          <StatCard
            title="Total Credits"
            value={formatCurrency(stats.totalCredits, displayCurrency)}
            description="Income received"
            icon={TrendingUp}
            iconClassName="text-green-600"
            valueClassName="text-green-600 dark:text-green-400"
            isLoading={isExchangeRatesLoading}
          />
          <StatCard
            title="Total Debits"
            value={formatCurrency(stats.totalDebits, displayCurrency)}
            description="Expenses paid"
            icon={TrendingDown}
            iconClassName="text-red-600"
            isLoading={isExchangeRatesLoading}
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(stats.netBalance, displayCurrency)}
            description="Current period"
            icon={Scale}
            valueClassName={
              stats.netBalance >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }
            isLoading={isExchangeRatesLoading}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Avg Transactions/Month"
            value={monthlyAverages.avgTransactionsPerMonth.toFixed(1)}
            description={`Based on ${monthlyAverages.dateRange}`}
            icon={Calendar}
            isLoading={isExchangeRatesLoading}
          />
          <StatCard
            title="Avg Credits/Month"
            value={formatCurrency(monthlyAverages.avgCreditsPerMonth, displayCurrency)}
            description="Average monthly income"
            icon={TrendingUp}
            iconClassName="text-green-600"
            valueClassName="text-green-600 dark:text-green-400"
            isLoading={isExchangeRatesLoading}
          />
          <StatCard
            title="Avg Debits/Month"
            value={formatCurrency(monthlyAverages.avgDebitsPerMonth, displayCurrency)}
            description="Average monthly expenses"
            icon={TrendingDown}
            iconClassName="text-red-600"
            isLoading={isExchangeRatesLoading}
          />
          <StatCard
            title="Avg Net Balance/Month"
            value={formatCurrency(monthlyAverages.avgNetBalancePerMonth, displayCurrency)}
            description="Average monthly balance"
            icon={Scale}
            valueClassName={
              monthlyAverages.avgNetBalancePerMonth >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }
            isLoading={isExchangeRatesLoading}
          />
        </div>
      </>

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
