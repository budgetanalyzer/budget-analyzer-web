// src/hooks/useCurrencies.ts
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { CurrencyCode, ExchangeRateResponse } from '@/types/currency';
import { currencyApi } from '@/api/currencyApi';
import { mockCurrencies, mockExchangeRates } from '@/api/mockData';
import { ApiError } from '@/types/apiError';
import { buildExchangeRateMap } from '@/lib/currency';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/**
 * Fetch the list of supported currencies
 * Cached indefinitely since currency list changes infrequently
 */
export const useCurrencies = (): UseQueryResult<CurrencyCode[], ApiError> => {
  return useQuery<CurrencyCode[], ApiError>({
    queryKey: ['currencies'],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 300));
        return mockCurrencies;
      }
      return currencyApi.getCurrencies();
    },
    staleTime: Infinity, // Never mark as stale - only refetch on mount or manual invalidation
    retry: 1,
  });
};

/**
 * Fetch exchange rates for a target currency
 * Historical exchange rates never change, so cache indefinitely
 * If no date range is provided, fetches all available rates
 */
export const useExchangeRates = (params: {
  targetCurrency: string;
  startDate?: string;
  endDate?: string;
  enabled?: boolean;
}): UseQueryResult<ExchangeRateResponse[], ApiError> => {
  const { targetCurrency, startDate, endDate, enabled = true } = params;

  return useQuery<ExchangeRateResponse[], ApiError>({
    queryKey: ['exchangeRates', targetCurrency, startDate, endDate],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 400));
        // Filter mock data if date range provided
        if (startDate && endDate) {
          return mockExchangeRates.filter(
            (rate) =>
              rate.targetCurrency.currencyCode === targetCurrency &&
              rate.date >= startDate &&
              rate.date <= endDate,
          );
        }
        // Otherwise return all rates for this currency
        return mockExchangeRates.filter(
          (rate) => rate.targetCurrency.currencyCode === targetCurrency,
        );
      }
      return currencyApi.getExchangeRates({ targetCurrency, startDate, endDate });
    },
    staleTime: Infinity, // Historical data never changes
    gcTime: Infinity, // Keep in cache indefinitely
    retry: 1,
    enabled: enabled && !!targetCurrency,
  });
};

/**
 * Fetch exchange rates for all non-USD currencies and build a Map for fast lookups
 *
 * IMPORTANT: The API always returns USD as base currency (USD→targetCurrency).
 * We need to fetch rates for ALL non-USD currencies because:
 * - Transactions can be in any currency
 * - Display currency can be any currency
 * - The convertCurrency function handles both directions (multiply or divide)
 *
 * For now, this fetches rates for each non-USD currency individually.
 * TODO: Future optimization - batch fetch if API supports it
 */
export const useExchangeRatesMap = () => {
  // First, get the list of all supported currencies
  const { data: currencies } = useCurrencies();

  // Get all non-USD currencies that need exchange rates
  const nonUsdCurrencies = useMemo(() => {
    if (!currencies) return [];
    return currencies.filter((currency) => currency !== 'USD');
  }, [currencies]);

  // Fetch exchange rates for the first non-USD currency
  // TODO: In the future, we should fetch for ALL non-USD currencies
  // For now, we assume the first non-USD currency (e.g., THB)
  const targetCurrency = nonUsdCurrencies[0] || 'THB';

  const { data: exchangeRatesData, ...rest } = useExchangeRates({
    targetCurrency,
    enabled: !!targetCurrency,
  });

  const exchangeRatesMap = useMemo(() => {
    if (!exchangeRatesData) return new Map<string, number>();
    return buildExchangeRateMap(exchangeRatesData);
  }, [exchangeRatesData]);

  return { exchangeRatesMap, exchangeRatesData, ...rest };
};
