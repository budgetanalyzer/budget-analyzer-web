// src/features/analytics/hooks/useAnalyticsData.ts
import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import { ExchangeRateResponse } from '@/types/currency';
import type { DisplayAmount } from '@/types/displayAmount';
import { projectDisplayAmount } from '@/utils/displayAmount';
import {
  getCurrentYear,
  createMonthDate,
  formatMonthYear,
  parseLocalDate,
  getMonthKey,
} from '@/utils/dates';

export interface MonthlySpending {
  year: number;
  month: number;
  monthLabel: string;
  totalSpending: number | null;
  transactionCount: number;
  unavailableAmountCount: number;
}

export interface YearlySpending {
  year: number;
  yearLabel: string;
  totalSpending: number | null;
  transactionCount: number;
  unavailableAmountCount: number;
}

export interface AnalyticsData {
  monthlySpending: MonthlySpending[];
  yearlySpending: YearlySpending[];
  earliestYear: number;
  latestYear: number;
  yearsWithTransactions: number[];
}

/**
 * Hook that processes transaction data into analytics-ready formats
 * Uses memoization for expensive calculations
 */
export function useAnalyticsData(
  transactions: Transaction[] | undefined,
  displayCurrency: string,
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>,
  selectedYear: number,
  transactionType: 'debit' | 'credit' = 'debit',
): AnalyticsData {
  const displayAmounts = useMemo<ReadonlyMap<number, DisplayAmount>>(
    () =>
      new Map(
        (transactions ?? []).map((transaction) => [
          transaction.id,
          projectDisplayAmount(transaction, displayCurrency, exchangeRatesMap),
        ]),
      ),
    [displayCurrency, exchangeRatesMap, transactions],
  );

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
        unavailableAmountCount: 0,
      }));
    }

    // Group transactions by month and calculate totals
    const monthlyData = new Map<
      string,
      { total: number; count: number; unavailableCount: number }
    >();

    // Initialize all 12 months for selected year
    for (let month = 0; month < 12; month++) {
      const key = `${selectedYear}-${String(month + 1).padStart(2, '0')}`;
      monthlyData.set(key, { total: 0, count: 0, unavailableCount: 0 });
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

      const displayAmount = displayAmounts.get(transaction.id);
      const existing = monthlyData.get(monthKey) ?? {
        total: 0,
        count: 0,
        unavailableCount: 0,
      };
      monthlyData.set(monthKey, {
        total: existing.total + (displayAmount?.available ? displayAmount.value : 0),
        count: existing.count + 1,
        unavailableCount: existing.unavailableCount + (displayAmount?.available ? 0 : 1),
      });
    });

    // Convert map to array and format
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthKey = `${selectedYear}-${String(month).padStart(2, '0')}`;
      const data = monthlyData.get(monthKey) ?? {
        total: 0,
        count: 0,
        unavailableCount: 0,
      };

      return {
        year: selectedYear,
        month,
        monthLabel: formatMonthYear(createMonthDate(selectedYear, month)),
        totalSpending: data.count > 0 && data.unavailableCount === data.count ? null : data.total,
        transactionCount: data.count,
        unavailableAmountCount: data.unavailableCount,
      };
    });
  }, [displayAmounts, selectedYear, transactionType, transactions]);

  // Calculate yearly spending across all years
  const yearlySpending = useMemo<YearlySpending[]>(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Group transactions by year and calculate totals
    const yearlyData = new Map<
      number,
      { total: number; count: number; unavailableCount: number }
    >();

    // Process each transaction
    transactions.forEach((transaction) => {
      const transactionDate = parseLocalDate(transaction.date);
      const transactionYear = transactionDate.getFullYear();

      // Filter by transaction type
      const expectedType = transactionType === 'debit' ? 'DEBIT' : 'CREDIT';
      if (transaction.type !== expectedType) {
        return;
      }

      const displayAmount = displayAmounts.get(transaction.id);
      const existing = yearlyData.get(transactionYear) ?? {
        total: 0,
        count: 0,
        unavailableCount: 0,
      };
      yearlyData.set(transactionYear, {
        total: existing.total + (displayAmount?.available ? displayAmount.value : 0),
        count: existing.count + 1,
        unavailableCount: existing.unavailableCount + (displayAmount?.available ? 0 : 1),
      });
    });

    // Convert map to array and format, sorted by year ascending
    return Array.from(yearlyData.entries())
      .map(([year, data]) => ({
        year,
        yearLabel: year.toString(),
        totalSpending: data.unavailableCount === data.count ? null : data.total,
        transactionCount: data.count,
        unavailableAmountCount: data.unavailableCount,
      }))
      .sort((a, b) => a.year - b.year);
  }, [displayAmounts, transactionType, transactions]);

  // Extract years that have transactions (memoized based on yearlySpending)
  const yearsWithTransactions = useMemo<number[]>(() => {
    return yearlySpending.map((ys) => ys.year);
  }, [yearlySpending]);

  return {
    monthlySpending,
    yearlySpending,
    earliestYear,
    latestYear,
    yearsWithTransactions,
  };
}
