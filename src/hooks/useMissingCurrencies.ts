// src/hooks/useMissingCurrencies.ts
import { useMemo } from 'react';
import { useCurrencies } from '@/hooks/useCurrencies';
import { useTransactions } from '@/hooks/useTransactions';

/**
 * Detects disabled currencies that still have active transactions.
 * Derives the answer from already-cached transaction and currency data
 * instead of making per-currency count API calls.
 */
export const useMissingCurrencies = (): string[] => {
  const { data: allCurrencies } = useCurrencies(false);
  const { data: transactions } = useTransactions();

  return useMemo(() => {
    if (!allCurrencies || !transactions) return [];

    const currenciesInTransactions = new Set(transactions.map((t) => t.currencyIsoCode));

    return allCurrencies
      .filter((c) => !c.enabled && currenciesInTransactions.has(c.currencyCode))
      .map((c) => c.currencyCode);
  }, [allCurrencies, transactions]);
};
