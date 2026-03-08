// src/hooks/useCurrencies.ts
import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  CurrencySeriesResponse,
  ExchangeRateResponse,
  CurrencySeriesCreateRequest,
  CurrencySeriesUpdateRequest,
} from '@/types/currency';
import { currencyApi } from '@/api/currencyApi';
import { ApiError } from '@/types/apiError';
import { buildExchangeRateMap } from '@/utils/currency';
import { useTransactions } from '@/hooks/useTransactions';

/**
 * Query key factory for currencies
 */
const currenciesKeys = {
  all: ['currencies'] as const,
  detail: (id: number) => [...currenciesKeys.all, 'detail', id] as const,
};

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
    queryFn: () => currencyApi.getCurrencies(enabledOnly),
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
    queryFn: () => currencyApi.getExchangeRates({ targetCurrency, startDate, endDate }),
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

  // Fetch enabled currencies to categorize missing rates
  const { data: enabledCurrencies } = useCurrencies(true);

  // Build set of enabled currency codes (USD always available)
  const enabledCurrencyCodes = useMemo(() => {
    const codes = new Set<string>(['USD']);
    enabledCurrencies?.forEach((c) => codes.add(c.currencyCode));
    return codes;
  }, [enabledCurrencies]);

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
      queryFn: () =>
        currencyApi.getExchangeRates({
          targetCurrency,
          startDate,
        }),
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 1,
      enabled: !!targetCurrency,
    })),
    combine: (results) => {
      // Combine all exchange rate data from all queries
      const allRates: ExchangeRateResponse[] = [];
      const currenciesWithNoRates: string[] = [];

      results.forEach((result, index) => {
        if (result.data && result.data.length > 0) {
          allRates.push(...result.data);
        } else if (!result.isLoading && !result.error) {
          // Currency fetch completed but no rates returned
          currenciesWithNoRates.push(currenciesNeeded[index]);
        }
      });

      return {
        data: allRates,
        currenciesWithNoRates,
        isLoading: results.some((result) => result.isLoading),
        error: results.find((result) => result.error)?.error as ApiError | undefined,
      };
    },
  });

  const { data: allExchangeRatesData, currenciesWithNoRates, isLoading, error } = combinedResult;

  const pendingCurrencies = useMemo(
    () => currenciesWithNoRates.filter((c) => enabledCurrencyCodes.has(c)),
    [currenciesWithNoRates, enabledCurrencyCodes],
  );

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
    pendingCurrencies,
    isLoading,
    error,
  };
};

/**
 * Fetch a single currency by ID
 * Used in admin edit forms
 */
export const useCurrency = (id: number): UseQueryResult<CurrencySeriesResponse, ApiError> => {
  return useQuery<CurrencySeriesResponse, ApiError>({
    queryKey: currenciesKeys.detail(id),
    queryFn: () => currencyApi.getCurrencyById(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};

/**
 * Create a new currency series
 * Admin mutation hook
 */
export const useCreateCurrency = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CurrencySeriesCreateRequest) => currencyApi.createCurrency(data),
    onSuccess: async () => {
      // Invalidate all currency queries (both full list and enabled-only)
      await queryClient.invalidateQueries({ queryKey: currenciesKeys.all });
    },
  });
};

/**
 * Update an existing currency series
 * Admin mutation hook
 */
export const useUpdateCurrency = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CurrencySeriesUpdateRequest }) =>
      currencyApi.updateCurrency(id, data),
    onSuccess: async (updatedCurrency) => {
      // Invalidate all currency queries (both full list and enabled-only)
      // Also invalidate the specific detail query to ensure fresh data in edit forms
      // Await to ensure cache is refreshed before component callbacks run
      await queryClient.invalidateQueries({ queryKey: currenciesKeys.all });
      await queryClient.invalidateQueries({ queryKey: currenciesKeys.detail(updatedCurrency.id) });
      queryClient.invalidateQueries({ queryKey: ['transactionCount'] });
    },
  });
};
