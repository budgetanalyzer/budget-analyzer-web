// src/hooks/useMissingCurrencies.ts
import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useCurrencies } from '@/hooks/useCurrencies';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

/**
 * Detects disabled currencies that still have active transactions.
 * Uses the count API to decouple detection from exchange rate cache timing.
 */
export const useMissingCurrencies = (): string[] => {
  // Fetch all currencies (enabled + disabled)
  const { data: allCurrencies } = useCurrencies(false);

  // Identify disabled currency codes
  const disabledCurrencyCodes = useMemo(() => {
    if (!allCurrencies) return [];
    return allCurrencies.filter((c) => !c.enabled).map((c) => c.currencyCode);
  }, [allCurrencies]);

  // For each disabled currency, count transactions
  const countResults = useQueries({
    queries: disabledCurrencyCodes.map((currencyIsoCode) => ({
      queryKey: ['transactionCount', { currencyIsoCode }],
      queryFn: () => transactionApi.countTransactions({ currencyIsoCode }),
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Return codes where count > 0
  return useMemo(() => {
    return disabledCurrencyCodes.filter((_, index) => {
      const result = countResults[index] as unknown as { data?: number; error?: ApiError };
      return result.data != null && result.data > 0;
    });
  }, [disabledCurrencyCodes, countResults]);
};
