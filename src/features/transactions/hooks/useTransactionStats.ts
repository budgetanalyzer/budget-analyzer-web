// src/features/transactions/hooks/useTransactionStats.ts
import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import type { DisplayAmount } from '@/types/displayAmount';
import { getDaysBetween, getDateRange } from '@/utils/dates';

export interface TransactionStats {
  totalTransactions: number;
  totalCredits: number | null;
  totalDebits: number | null;
  netBalance: number | null;
  availableAmountCount: number;
  unavailableAmountCount: number;
  availableCreditAmountCount: number;
  unavailableCreditAmountCount: number;
  availableDebitAmountCount: number;
  unavailableDebitAmountCount: number;
  isPartial: boolean;
  earliestDate: string | null;
  latestDate: string | null;
}

export interface MonthlyAverages {
  avgTransactionsPerMonth: number;
  avgCreditsPerMonth: number | null;
  avgDebitsPerMonth: number | null;
  avgNetBalancePerMonth: number | null;
  availableAmountCount: number;
  unavailableAmountCount: number;
  availableCreditAmountCount: number;
  unavailableCreditAmountCount: number;
  availableDebitAmountCount: number;
  unavailableDebitAmountCount: number;
  isPartial: boolean;
  dateRange: string;
}

interface UseTransactionStatsOptions {
  transactions: Transaction[];
  displayAmounts: ReadonlyMap<number, DisplayAmount>;
}

export function useTransactionStats(options: UseTransactionStatsOptions) {
  const { displayAmounts, transactions } = options;
  // Calculate stats from transactions
  // Convert all amounts to display currency before calculating totals
  // Optimization: Single-pass through transactions instead of 4 passes
  const stats = useMemo<TransactionStats>(() => {
    if (!transactions.length) {
      return {
        totalTransactions: 0,
        totalCredits: 0,
        totalDebits: 0,
        netBalance: 0,
        availableAmountCount: 0,
        unavailableAmountCount: 0,
        availableCreditAmountCount: 0,
        unavailableCreditAmountCount: 0,
        availableDebitAmountCount: 0,
        unavailableDebitAmountCount: 0,
        isPartial: false,
        earliestDate: null,
        latestDate: null,
      };
    }

    const totals = transactions.reduce(
      (acc, t) => {
        const displayAmount = displayAmounts.get(t.id);

        if (!displayAmount?.available) {
          acc.unavailableAmountCount += 1;
          if (t.type === 'CREDIT') {
            acc.creditCount += 1;
            acc.unavailableCreditAmountCount += 1;
          } else {
            acc.debitCount += 1;
            acc.unavailableDebitAmountCount += 1;
          }
          return acc;
        }

        acc.availableAmountCount += 1;

        if (t.type === 'CREDIT') {
          acc.creditCount += 1;
          acc.availableCreditCount += 1;
          acc.availableCreditAmountCount += 1;
          acc.totalCredits += displayAmount.value;
        } else {
          acc.debitCount += 1;
          acc.availableDebitCount += 1;
          acc.availableDebitAmountCount += 1;
          acc.totalDebits += displayAmount.value;
        }

        return acc;
      },
      {
        totalCredits: 0,
        totalDebits: 0,
        creditCount: 0,
        debitCount: 0,
        availableCreditCount: 0,
        availableDebitCount: 0,
        availableAmountCount: 0,
        unavailableAmountCount: 0,
        availableCreditAmountCount: 0,
        unavailableCreditAmountCount: 0,
        availableDebitAmountCount: 0,
        unavailableDebitAmountCount: 0,
      },
    );

    const totalCredits =
      totals.creditCount > 0 && totals.availableCreditCount === 0 ? null : totals.totalCredits;
    const totalDebits =
      totals.debitCount > 0 && totals.availableDebitCount === 0 ? null : totals.totalDebits;
    const netBalance =
      totals.availableAmountCount === 0 ? null : totals.totalCredits - totals.totalDebits;

    // Calculate date range
    const dateRange = getDateRange(transactions.map((t) => t.date));

    return {
      totalTransactions: transactions.length,
      totalCredits,
      totalDebits,
      netBalance,
      availableAmountCount: totals.availableAmountCount,
      unavailableAmountCount: totals.unavailableAmountCount,
      availableCreditAmountCount: totals.availableCreditAmountCount,
      unavailableCreditAmountCount: totals.unavailableCreditAmountCount,
      availableDebitAmountCount: totals.availableDebitAmountCount,
      unavailableDebitAmountCount: totals.unavailableDebitAmountCount,
      isPartial: totals.availableAmountCount > 0 && totals.unavailableAmountCount > 0,
      earliestDate: dateRange?.earliest ?? null,
      latestDate: dateRange?.latest ?? null,
    };
  }, [displayAmounts, transactions]);

  // Calculate monthly averages based on date range of transactions
  // Optimization: Find min/max dates in O(n) instead of sorting O(n log n)
  const monthlyAverages = useMemo<MonthlyAverages>(() => {
    const zeroAverage = (value: number | null) => (value === null ? null : 0);

    if (!transactions.length || transactions.length < 2) {
      return {
        avgTransactionsPerMonth: 0,
        avgCreditsPerMonth: zeroAverage(stats.totalCredits),
        avgDebitsPerMonth: zeroAverage(stats.totalDebits),
        avgNetBalancePerMonth: zeroAverage(stats.netBalance),
        availableAmountCount: stats.availableAmountCount,
        unavailableAmountCount: stats.unavailableAmountCount,
        availableCreditAmountCount: stats.availableCreditAmountCount,
        unavailableCreditAmountCount: stats.unavailableCreditAmountCount,
        availableDebitAmountCount: stats.availableDebitAmountCount,
        unavailableDebitAmountCount: stats.unavailableDebitAmountCount,
        isPartial: stats.isPartial,
        dateRange: '0 days',
      };
    }

    // Find earliest and latest dates using centralized utility
    const dateRange = getDateRange(transactions.map((t) => t.date));

    if (!dateRange) {
      return {
        avgTransactionsPerMonth: 0,
        avgCreditsPerMonth: zeroAverage(stats.totalCredits),
        avgDebitsPerMonth: zeroAverage(stats.totalDebits),
        avgNetBalancePerMonth: zeroAverage(stats.netBalance),
        availableAmountCount: stats.availableAmountCount,
        unavailableAmountCount: stats.unavailableAmountCount,
        availableCreditAmountCount: stats.availableCreditAmountCount,
        unavailableCreditAmountCount: stats.unavailableCreditAmountCount,
        availableDebitAmountCount: stats.availableDebitAmountCount,
        unavailableDebitAmountCount: stats.unavailableDebitAmountCount,
        isPartial: stats.isPartial,
        dateRange: '0 days',
      };
    }

    const totalDays = getDaysBetween(dateRange.earliest, dateRange.latest);

    // If all transactions are on the same day, return zeros
    if (totalDays === 0) {
      return {
        avgTransactionsPerMonth: 0,
        avgCreditsPerMonth: zeroAverage(stats.totalCredits),
        avgDebitsPerMonth: zeroAverage(stats.totalDebits),
        avgNetBalancePerMonth: zeroAverage(stats.netBalance),
        availableAmountCount: stats.availableAmountCount,
        unavailableAmountCount: stats.unavailableAmountCount,
        availableCreditAmountCount: stats.availableCreditAmountCount,
        unavailableCreditAmountCount: stats.unavailableCreditAmountCount,
        availableDebitAmountCount: stats.availableDebitAmountCount,
        unavailableDebitAmountCount: stats.unavailableDebitAmountCount,
        isPartial: stats.isPartial,
        dateRange: '0 days',
      };
    }

    // Calculate months (assuming 30 days per month for average)
    const months = totalDays / 30;

    const average = (value: number | null) => (value === null ? null : value / months);

    return {
      avgTransactionsPerMonth: stats.totalTransactions / months,
      avgCreditsPerMonth: average(stats.totalCredits),
      avgDebitsPerMonth: average(stats.totalDebits),
      avgNetBalancePerMonth: average(stats.netBalance),
      availableAmountCount: stats.availableAmountCount,
      unavailableAmountCount: stats.unavailableAmountCount,
      availableCreditAmountCount: stats.availableCreditAmountCount,
      unavailableCreditAmountCount: stats.unavailableCreditAmountCount,
      availableDebitAmountCount: stats.availableDebitAmountCount,
      unavailableDebitAmountCount: stats.unavailableDebitAmountCount,
      isPartial: stats.isPartial,
      dateRange: `${totalDays} days`,
    };
  }, [transactions, stats]);

  return { stats, monthlyAverages };
}
