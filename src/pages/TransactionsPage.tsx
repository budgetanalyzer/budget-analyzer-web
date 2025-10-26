// src/pages/TransactionsPage.tsx
import { motion } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { useExchangeRatesMap } from '@/hooks/useCurrencies';
import { TransactionTable } from '@/components/TransactionTable';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatCard } from '@/components/StatCard';
import { ImportButton } from '@/components/ImportButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Calendar, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Transaction } from '@/types/transaction';
import { differenceInDays, parseISO } from 'date-fns';
import { useAppSelector } from '@/store/hooks';
import { convertCurrency } from '@/lib/currency';

export function TransactionsPage() {
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const displayCurrency = useAppSelector((state) => state.ui.displayCurrency);

  // Fetch exchange rates and build map for currency conversion
  const { exchangeRatesMap } = useExchangeRatesMap();
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Calculate stats from FILTERED transactions (provided by the table)
  // Convert all amounts to display currency before calculating totals
  const stats = useMemo(() => {
    if (!filteredTransactions.length) return null;

    const totalCredits = filteredTransactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((sum, t) => {
        const convertedAmount = convertCurrency(
          t.amount,
          t.date,
          t.currencyIsoCode,
          displayCurrency,
          exchangeRatesMap,
        );
        return sum + convertedAmount;
      }, 0);

    const totalDebits = filteredTransactions
      .filter((t) => t.type === 'DEBIT')
      .reduce((sum, t) => {
        const convertedAmount = convertCurrency(
          Math.abs(t.amount),
          t.date,
          t.currencyIsoCode,
          displayCurrency,
          exchangeRatesMap,
        );
        return sum + convertedAmount;
      }, 0);

    const netBalance = totalCredits - totalDebits;

    return {
      totalTransactions: filteredTransactions.length,
      totalCredits,
      totalDebits,
      netBalance,
    };
  }, [filteredTransactions, displayCurrency, exchangeRatesMap]);

  // Calculate monthly averages based on date range of filtered transactions
  const monthlyAverages = useMemo(() => {
    if (!filteredTransactions.length || filteredTransactions.length < 2) return null;

    // Sort transactions by date to get first and last
    const sortedByDate = [...filteredTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    const firstDate = parseISO(sortedByDate[0].date);
    const lastDate = parseISO(sortedByDate[sortedByDate.length - 1].date);
    const totalDays = differenceInDays(lastDate, firstDate);

    // If all transactions are on the same day, return null
    if (totalDays === 0) return null;

    // Calculate months (assuming 30 days per month for average)
    const months = totalDays / 30;

    if (!stats) return null;

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">View and manage your financial transactions</p>
      </div>

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Transactions"
              value={stats.totalTransactions}
              description="All time"
              icon={Wallet}
              delay={0.1}
            />
            <StatCard
              title="Total Credits"
              value={formatCurrency(stats.totalCredits, displayCurrency)}
              description="Income received"
              icon={TrendingUp}
              iconClassName="text-green-600"
              valueClassName="text-green-600 dark:text-green-400"
              delay={0.2}
            />
            <StatCard
              title="Total Debits"
              value={formatCurrency(stats.totalDebits, displayCurrency)}
              description="Expenses paid"
              icon={TrendingDown}
              iconClassName="text-red-600"
              delay={0.3}
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
              delay={0.4}
            />
          </div>

          {monthlyAverages && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Avg Transactions/Month"
                value={monthlyAverages.avgTransactionsPerMonth.toFixed(1)}
                description={`Based on ${monthlyAverages.dateRange}`}
                icon={Calendar}
                delay={0.5}
              />
              <StatCard
                title="Avg Credits/Month"
                value={formatCurrency(monthlyAverages.avgCreditsPerMonth, displayCurrency)}
                description="Average monthly income"
                icon={TrendingUp}
                iconClassName="text-green-600"
                valueClassName="text-green-600 dark:text-green-400"
                delay={0.6}
              />
              <StatCard
                title="Avg Debits/Month"
                value={formatCurrency(monthlyAverages.avgDebitsPerMonth, displayCurrency)}
                description="Average monthly expenses"
                icon={TrendingDown}
                iconClassName="text-red-600"
                delay={0.7}
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
                delay={0.8}
              />
            </div>
          )}
        </>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>All Transactions</CardTitle>
                <CardDescription>
                  A complete list of all your financial transactions
                </CardDescription>
              </div>
              <ImportButton
                onSuccess={(count) => {
                  setImportMessage({
                    type: 'success',
                    text: `Successfully imported ${count} transaction(s)`,
                  });
                  setTimeout(() => setImportMessage(null), 5000);
                }}
                onError={(error) => {
                  setImportMessage({
                    type: 'error',
                    text: error.message || 'Failed to import transactions',
                  });
                }}
              />
            </div>
          </CardHeader>
          <CardContent>
            {importMessage && (
              <div
                className={`mb-4 rounded-md px-4 py-3 text-sm ${
                  importMessage.type === 'success'
                    ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                    : 'bg-destructive/15 text-destructive'
                }`}
              >
                {importMessage.text}
              </div>
            )}
            {transactions && (
              <TransactionTable
                transactions={transactions}
                onFilteredRowsChange={setFilteredTransactions}
                displayCurrency={displayCurrency}
                exchangeRatesMap={exchangeRatesMap}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
