// src/hooks/useAnalyticsData.ts
import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import { format, parseISO } from 'date-fns';
import { convertCurrency } from '@/lib/currency';
import { ExchangeRateResponse } from '@/types/currency';

export interface MonthlySpending {
  year: number;
  month: number;
  monthLabel: string;
  totalSpending: number;
  transactionCount: number;
}

export interface AnalyticsData {
  monthlySpending: MonthlySpending[];
  currentYear: number;
}

/**
 * Hook that processes transaction data into analytics-ready formats
 * Uses memoization for expensive calculations
 */
export function useAnalyticsData(
  transactions: Transaction[] | undefined,
  displayCurrency: string,
  exchangeRatesMap: Map<string, ExchangeRateResponse>,
): AnalyticsData {
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Calculate monthly spending for the current year
  const monthlySpending = useMemo<MonthlySpending[]>(() => {
    if (!transactions || transactions.length === 0) {
      // Return 12 months of empty data for current year
      return Array.from({ length: 12 }, (_, i) => ({
        year: currentYear,
        month: i + 1,
        monthLabel: format(new Date(currentYear, i, 1), 'MMM yyyy'),
        totalSpending: 0,
        transactionCount: 0,
      }));
    }

    // Group transactions by month and calculate totals
    const monthlyData = new Map<string, { total: number; count: number }>();

    // Initialize all 12 months for current year
    for (let month = 0; month < 12; month++) {
      const key = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
      monthlyData.set(key, { total: 0, count: 0 });
    }

    // Process each transaction
    transactions.forEach((transaction) => {
      const transactionDate = parseISO(transaction.date);
      const transactionYear = transactionDate.getFullYear();

      // Only include transactions from current year
      if (transactionYear !== currentYear) {
        return;
      }

      // Only count debits (spending)
      if (transaction.type !== 'DEBIT') {
        return;
      }

      const monthKey = format(transactionDate, 'yyyy-MM');

      // Convert amount to display currency using the proper conversion utility
      const amountInDisplayCurrency = convertCurrency(
        Math.abs(transaction.amount),
        transaction.date,
        transaction.currencyIsoCode,
        displayCurrency,
        exchangeRatesMap,
      );

      const existing = monthlyData.get(monthKey) || { total: 0, count: 0 };
      monthlyData.set(monthKey, {
        total: existing.total + amountInDisplayCurrency,
        count: existing.count + 1,
      });
    });

    // Convert map to array and format
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthKey = `${currentYear}-${String(month).padStart(2, '0')}`;
      const data = monthlyData.get(monthKey) || { total: 0, count: 0 };

      return {
        year: currentYear,
        month,
        monthLabel: format(new Date(currentYear, i, 1), 'MMM yyyy'),
        totalSpending: data.total,
        transactionCount: data.count,
      };
    });
  }, [transactions, currentYear, displayCurrency, exchangeRatesMap]);

  return {
    monthlySpending,
    currentYear,
  };
}
