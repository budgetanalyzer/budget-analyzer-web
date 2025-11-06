// src/features/transactions/components/statsConfig.ts
import { Calendar, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/features/transactions/utils/currency';
import type {
  TransactionStats,
  MonthlyAverages,
} from '@/features/transactions/hooks/useTransactionStats';

/**
 * Configuration for a single stat card
 */
export interface StatCardConfig {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  iconClassName?: string;
  valueClassName?: string;
}

/**
 * Build main transaction statistics card configurations
 *
 * @param stats Transaction statistics (totals for credits, debits, net balance)
 * @param displayCurrency Currency code for formatting amounts
 * @returns Array of stat card configurations
 */
export function buildMainStatsConfig(
  stats: TransactionStats,
  displayCurrency: string,
): StatCardConfig[] {
  return [
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
  ];
}

/**
 * Build monthly average statistics card configurations
 *
 * @param monthlyAverages Monthly averages (transactions, credits, debits, net balance per month)
 * @param displayCurrency Currency code for formatting amounts
 * @returns Array of stat card configurations
 */
export function buildMonthlyStatsConfig(
  monthlyAverages: MonthlyAverages,
  displayCurrency: string,
): StatCardConfig[] {
  return [
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
  ];
}
