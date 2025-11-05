// src/hooks/useAnalyticsData.ts
import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import { convertCurrency } from '@/lib/currency';
import { ExchangeRateResponse } from '@/types/currency';
import {
  getCurrentYear,
  createMonthDate,
  formatMonthYear,
  parseLocalDate,
  getMonthKey,
} from '@/lib/dateUtils';

export interface MonthlySpending {
  year: number;
  month: number;
  monthLabel: string;
  totalSpending: number;
  transactionCount: number;
}

export interface AnalyticsData {
  monthlySpending: MonthlySpending[];
  earliestYear: number;
  latestYear: number;
}

/**
 * Hook that processes transaction data into analytics-ready formats
 * Uses memoization for expensive calculations
 */
export function useAnalyticsData(
  transactions: Transaction[] | undefined,
  displayCurrency: string,
  exchangeRatesMap: Map<string, ExchangeRateResponse>,
  selectedYear: number,
  transactionType: 'debit' | 'credit' = 'debit',
): AnalyticsData {
  // Calculate earliest and latest years from transactions
  const { earliestYear, latestYear } = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      const current = getCurrentYear();
      return { earliestYear: current, latestYear: current };
    }

    let earliest = Infinity;
    let latest = -Infinity;

    transactions.forEach((transaction) => {
      const year = parseLocalDate(transaction.date).getFullYear();
      if (year < earliest) earliest = year;
      if (year > latest) latest = year;
    });

    return {
      earliestYear: earliest === Infinity ? getCurrentYear() : earliest,
      latestYear: latest === -Infinity ? getCurrentYear() : latest,
    };
  }, [transactions]);

  // Calculate monthly spending for the selected year
  const monthlySpending = useMemo<MonthlySpending[]>(() => {
    if (!transactions || transactions.length === 0) {
      // Return 12 months of empty data for selected year
      return Array.from({ length: 12 }, (_, i) => ({
        year: selectedYear,
        month: i + 1,
        monthLabel: formatMonthYear(createMonthDate(selectedYear, i + 1)),
        totalSpending: 0,
        transactionCount: 0,
      }));
    }

    // Group transactions by month and calculate totals
    const monthlyData = new Map<string, { total: number; count: number }>();

    // Initialize all 12 months for selected year
    for (let month = 0; month < 12; month++) {
      const key = `${selectedYear}-${String(month + 1).padStart(2, '0')}`;
      monthlyData.set(key, { total: 0, count: 0 });
    }

    // Process each transaction
    transactions.forEach((transaction) => {
      const transactionDate = parseLocalDate(transaction.date);
      const transactionYear = transactionDate.getFullYear();

      // Only include transactions from selected year
      if (transactionYear !== selectedYear) {
        return;
      }

      // Filter by transaction type
      const expectedType = transactionType === 'debit' ? 'DEBIT' : 'CREDIT';
      if (transaction.type !== expectedType) {
        return;
      }

      const monthKey = getMonthKey(transaction.date);

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
      const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
      const data = monthlyData.get(monthKey) || { total: 0, count: 0 };

      return {
        year: selectedYear,
        month,
        monthLabel: formatMonthYear(createMonthDate(selectedYear, month)),
        totalSpending: data.total,
        transactionCount: data.count,
      };
    });
  }, [transactions, selectedYear, displayCurrency, exchangeRatesMap, transactionType]);

  return {
    monthlySpending,
    earliestYear,
    latestYear,
  };
}
