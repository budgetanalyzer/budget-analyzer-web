// src/pages/TransactionsPage.tsx
import { motion } from 'framer-motion';
import { useTransactions } from '@/hooks/useTransactions';
import { TransactionTable } from '@/components/TransactionTable';
import { ErrorBanner } from '@/components/ErrorBanner';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DollarSign, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Transaction } from '@/types/transaction';

export function TransactionsPage() {
  const { data: transactions, isLoading, error, refetch } = useTransactions();
  const [globalFilter, setGlobalFilter] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);

  // Calculate stats from FILTERED transactions (provided by the table)
  const stats = useMemo(() => {
    if (!filteredTransactions.length) return null;

    const totalCredits = filteredTransactions
      .filter((t) => t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebits = filteredTransactions
      .filter((t) => t.type === 'DEBIT')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const netBalance = totalCredits - totalDebits;

    return {
      totalTransactions: filteredTransactions.length,
      totalCredits,
      totalDebits,
      netBalance,
    };
  }, [filteredTransactions]);

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
            value={formatCurrency(stats.totalCredits)}
            description="Income received"
            icon={TrendingUp}
            iconClassName="text-green-600"
            valueClassName="text-green-600 dark:text-green-400"
            delay={0.2}
          />
          <StatCard
            title="Total Debits"
            value={formatCurrency(stats.totalDebits)}
            description="Expenses paid"
            icon={TrendingDown}
            iconClassName="text-red-600"
            delay={0.3}
          />
          <StatCard
            title="Net Balance"
            value={formatCurrency(stats.netBalance)}
            description="Current period"
            icon={DollarSign}
            valueClassName={
              stats.netBalance >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }
            delay={0.4}
          />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>A complete list of all your financial transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions && (
              <TransactionTable
                transactions={transactions}
                globalFilter={globalFilter}
                onGlobalFilterChange={setGlobalFilter}
                onFilteredRowsChange={setFilteredTransactions}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
