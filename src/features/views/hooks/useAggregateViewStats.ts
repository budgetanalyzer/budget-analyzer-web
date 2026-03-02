// src/features/views/hooks/useAggregateViewStats.ts
import { useMemo } from 'react';
import { Transaction } from '@/types/transaction';
import { SavedView } from '@/types/view';
import { ExchangeRateResponse } from '@/types/currency';
import { filterTransactionsByCriteria } from '@/utils/filterTransactions';
import { useTransactionStats } from '@/features/transactions/hooks/useTransactionStats';

export interface UseAggregateViewStatsOptions {
  views: SavedView[];
  selectedViewIds: string[];
  transactions: Transaction[];
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
}

export function useAggregateViewStats({
  views,
  selectedViewIds,
  transactions,
  displayCurrency,
  exchangeRatesMap,
}: UseAggregateViewStatsOptions) {
  // Aggregate transactions from selected views with deduplication
  const aggregatedTransactions = useMemo(() => {
    const selectedViewsSet = new Set(selectedViewIds);
    const transactionMap = new Map<number, Transaction>();

    views.forEach((view) => {
      if (selectedViewsSet.has(view.id)) {
        const viewTransactions = filterTransactionsByCriteria(transactions, view.criteria);
        viewTransactions.forEach((transaction) => {
          transactionMap.set(transaction.id, transaction);
        });
      }
    });

    return Array.from(transactionMap.values());
  }, [views, selectedViewIds, transactions]);

  // Calculate stats using the existing hook
  return useTransactionStats({
    transactions: aggregatedTransactions,
    displayCurrency,
    exchangeRatesMap,
  });
}
