// src/hooks/useTransactionStats.ts
import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import { convertCurrency } from '@/lib/currency';
import { differenceInDays, parseISO } from 'date-fns';

export interface TransactionStats {
  totalTransactions: number;
  totalCredits: number;
  totalDebits: number;
  netBalance: number;
}

export interface MonthlyAverages {
  avgTransactionsPerMonth: number;
  avgCreditsPerMonth: number;
  avgDebitsPerMonth: number;
  avgNetBalancePerMonth: number;
  dateRange: string;
}

export interface UseTransactionStatsOptions {
  transactions: Transaction[];
  displayCurrency: string;
  exchangeRatesMap: Map<string, { rate: number }>;
}

export function useTransactionStats({
  transactions,
  displayCurrency,
  exchangeRatesMap,
}: UseTransactionStatsOptions) {
  // Calculate stats from transactions
  // Convert all amounts to display currency before calculating totals
  // Optimization: Single-pass through transactions instead of 4 passes
  const stats = useMemo<TransactionStats>(() => {
    const startTime = performance.now();
    console.log('[Stats] Starting calculation for', transactions.length, 'transactions');

    if (!transactions.length) {
      return {
        totalTransactions: 0,
        totalCredits: 0,
        totalDebits: 0,
        netBalance: 0,
      };
    }

    const { totalCredits, totalDebits } = transactions.reduce(
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
      totalTransactions: transactions.length,
      totalCredits,
      totalDebits,
      netBalance,
    };
  }, [transactions, displayCurrency, exchangeRatesMap]);

  // Calculate monthly averages based on date range of transactions
  // Optimization: Find min/max dates in O(n) instead of sorting O(n log n)
  const monthlyAverages = useMemo<MonthlyAverages>(() => {
    if (!transactions.length || transactions.length < 2) {
      return {
        avgTransactionsPerMonth: 0,
        avgCreditsPerMonth: 0,
        avgDebitsPerMonth: 0,
        avgNetBalancePerMonth: 0,
        dateRange: '0 days',
      };
    }

    // Find earliest and latest dates in a single pass O(n)
    let firstDate = parseISO(transactions[0].date);
    let lastDate = firstDate;

    for (let i = 1; i < transactions.length; i++) {
      const currentDate = parseISO(transactions[i].date);
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
  }, [transactions, stats]);

  return { stats, monthlyAverages };
}
