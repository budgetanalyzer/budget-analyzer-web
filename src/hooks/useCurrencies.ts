// src/hooks/useCurrencies.ts
import { useQuery, useQueries, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { CurrencySeriesResponse, ExchangeRateResponse } from '@/types/currency';
import { currencyApi } from '@/api/currencyApi';
import { mockCurrencies, mockExchangeRates } from '@/api/mockData';
import { ApiError } from '@/types/apiError';
import { buildExchangeRateMap } from '@/utils/currency';
import { useTransactions } from '@/hooks/useTransactions';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

/**
 * Fetch the list of supported currency series
 * Cached indefinitely since currency list changes infrequently
 * @param enabledOnly - If true, only returns enabled currencies (default: false)
 */
export const useCurrencies = (
  enabledOnly = false,
): UseQueryResult<CurrencySeriesResponse[], ApiError> => {
  return useQuery<CurrencySeriesResponse[], ApiError>({
    queryKey: ['currencies', enabledOnly],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 300));
        return enabledOnly ? mockCurrencies.filter((c) => c.enabled) : mockCurrencies;
      }
      return currencyApi.getCurrencies(enabledOnly);
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
              rate.targetCurrency === targetCurrency &&
              rate.date >= startDate &&
              rate.date <= endDate,
          );
        }
        // Otherwise return all rates for this currency
        return mockExchangeRates.filter((rate) => rate.targetCurrency === targetCurrency);
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
 * Fetch exchange rates for currencies used in transactions and build a Map for fast lookups
 *
 * IMPORTANT: The API always returns USD as base currency (USD→targetCurrency).
 * This hook intelligently fetches only the rates needed based on:
 * - Currencies present in the full transaction list
 * - The selected display currency
 * - Always fetches the full date range (2000-01-01 onwards) to avoid refetching on filter changes
 *
 * Uses React Query's useQueries to fetch rates for all needed currencies in parallel.
 * TODO: Future optimization - create a batch fetch API endpoint
 *
 * @param displayCurrency The currently selected display currency
 */
export const useExchangeRatesMap = (params: { displayCurrency: string }) => {
  const { displayCurrency } = params;

  // Always fetch the full transaction list to determine all currencies needed
  // This ensures we don't refetch rates when users filter transactions or view single transactions
  const { data: transactions } = useTransactions();

  // Extract unique non-USD currencies from transactions + display currency
  const currenciesNeeded = useMemo(() => {
    const currencies = new Set<string>();

    // Add currencies from transactions (excluding USD since it's the base)
    if (transactions) {
      transactions.forEach((t) => {
        if (t.currencyIsoCode !== 'USD') {
          currencies.add(t.currencyIsoCode);
        }
      });
    }

    // Always include display currency if it's not USD
    if (displayCurrency !== 'USD') {
      currencies.add(displayCurrency);
    }

    return Array.from(currencies);
  }, [transactions, displayCurrency]);

  // Always fetch the full date range (2000-01-01 onwards)
  // This prevents refetching when transactions are filtered, deleted, or when viewing single transactions
  const startDate = transactions?.length ? '2000-01-01' : undefined;

  // Fetch exchange rates for needed currencies in parallel using useQueries
  // Use the combine option to efficiently merge results and avoid unnecessary re-renders
  const combinedResult = useQueries({
    queries: currenciesNeeded.map((targetCurrency: string) => ({
      queryKey: ['exchangeRates', targetCurrency, startDate],
      queryFn: async () => {
        if (USE_MOCK_DATA) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          // Filter by currency and start date if provided
          let filtered = mockExchangeRates.filter((rate) => rate.targetCurrency === targetCurrency);
          if (startDate) {
            filtered = filtered.filter((rate) => rate.date >= startDate);
          }
          return filtered;
        }
        return currencyApi.getExchangeRates({
          targetCurrency,
          startDate,
        });
      },
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 1,
      enabled: !!targetCurrency,
    })),
    combine: (results) => {
      // Combine all exchange rate data from all queries
      const allRates: ExchangeRateResponse[] = [];
      results.forEach((result) => {
        if (result.data) {
          allRates.push(...result.data);
        }
      });

      return {
        data: allRates,
        isLoading: results.some((result) => result.isLoading),
        error: results.find((result) => result.error)?.error as ApiError | undefined,
      };
    },
  });

  const { data: allExchangeRatesData, isLoading, error } = combinedResult;

  // Build the exchange rates map from all combined data
  const exchangeRatesMap = useMemo(() => {
    if (allExchangeRatesData.length === 0) {
      return new Map<string, Map<string, ExchangeRateResponse>>();
    }
    return buildExchangeRateMap(allExchangeRatesData);
  }, [allExchangeRatesData]);

  // Memoized sorted array of all exchange rate dates (ascending order)
  const sortedExchangeRateDates = useMemo(() => {
    if (allExchangeRatesData.length === 0) return [];
    // Get unique dates across all currencies
    const uniqueDates = new Set(allExchangeRatesData.map((rate) => rate.date));
    return Array.from(uniqueDates).sort();
  }, [allExchangeRatesData]);

  // Memoized earliest exchange rate date across all currencies
  const earliestExchangeRateDate = useMemo(() => {
    return sortedExchangeRateDates[0] || null;
  }, [sortedExchangeRateDates]);

  return {
    exchangeRatesMap,
    exchangeRatesData: allExchangeRatesData,
    sortedExchangeRateDates,
    earliestExchangeRateDate,
    isLoading,
    error,
  };
};
