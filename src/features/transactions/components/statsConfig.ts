// src/features/transactions/components/statsConfig.ts
import { Calendar, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/utils/currency';
import { formatLocalDate } from '@/utils/dates';
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
function formatDateRange(earliest: string | null, latest: string | null): string {
  if (!earliest || !latest) return 'No transactions';
  if (earliest === latest) return formatLocalDate(earliest);
  return `${formatLocalDate(earliest)} - ${formatLocalDate(latest)}`;
}

function formatMonetaryValue(value: number | null, displayCurrency: string): string {
  return value === null ? 'Unavailable' : formatCurrency(value, displayCurrency);
}

function monetaryDescription(
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

export function buildMainStatsConfig(
  stats: TransactionStats,
  displayCurrency: string,
): StatCardConfig[] {
  return [
    {
      title: 'Total Transactions',
      value: stats.totalTransactions,
      description: formatDateRange(stats.earliestDate, stats.latestDate),
      icon: Wallet,
    },
    {
      title: 'Total Credits',
      value: formatMonetaryValue(stats.totalCredits, displayCurrency),
      description: monetaryDescription(
        'Income received',
        stats.availableCreditAmountCount,
        stats.unavailableCreditAmountCount,
      ),
      icon: TrendingUp,
      iconClassName: 'text-green-600',
      valueClassName: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Total Debits',
      value: formatMonetaryValue(stats.totalDebits, displayCurrency),
      description: monetaryDescription(
        'Expenses paid',
        stats.availableDebitAmountCount,
        stats.unavailableDebitAmountCount,
      ),
      icon: TrendingDown,
      iconClassName: 'text-red-600',
    },
    {
      title: 'Net Balance',
      value: formatMonetaryValue(stats.netBalance, displayCurrency),
      description: monetaryDescription(
        'Current period',
        stats.availableAmountCount,
        stats.unavailableAmountCount,
      ),
      icon: Scale,
      valueClassName:
        stats.netBalance !== null && stats.netBalance >= 0
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
      value: formatMonetaryValue(monthlyAverages.avgCreditsPerMonth, displayCurrency),
      description: monetaryDescription(
        'Average monthly income',
        monthlyAverages.availableCreditAmountCount,
        monthlyAverages.unavailableCreditAmountCount,
      ),
      icon: TrendingUp,
      iconClassName: 'text-green-600',
      valueClassName: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Avg Debits/Month',
      value: formatMonetaryValue(monthlyAverages.avgDebitsPerMonth, displayCurrency),
      description: monetaryDescription(
        'Average monthly expenses',
        monthlyAverages.availableDebitAmountCount,
        monthlyAverages.unavailableDebitAmountCount,
      ),
      icon: TrendingDown,
      iconClassName: 'text-red-600',
    },
    {
      title: 'Avg Net Balance/Month',
      value: formatMonetaryValue(monthlyAverages.avgNetBalancePerMonth, displayCurrency),
      description: monetaryDescription(
        'Average monthly balance',
        monthlyAverages.availableAmountCount,
        monthlyAverages.unavailableAmountCount,
      ),
      icon: Scale,
      valueClassName:
        monthlyAverages.avgNetBalancePerMonth !== null && monthlyAverages.avgNetBalancePerMonth >= 0
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-600 dark:text-red-400',
    },
  ];
}
