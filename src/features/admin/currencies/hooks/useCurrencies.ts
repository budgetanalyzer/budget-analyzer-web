import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as currenciesApi from '@/api/currencies';
import type { CurrencySeriesCreateRequest, CurrencySeriesUpdateRequest } from '@/api/currencies';

/**
 * Query key factory for currencies
 */
const currenciesKeys = {
  all: ['currencies'] as const,
  lists: () => [...currenciesKeys.all, 'list'] as const,
  list: (enabledOnly?: boolean) => [...currenciesKeys.lists(), { enabledOnly }] as const,
  details: () => [...currenciesKeys.all, 'detail'] as const,
  detail: (id: number) => [...currenciesKeys.details(), id] as const,
};

/**
 * Hook to fetch all currencies
 */
export function useCurrencies(enabledOnly?: boolean) {
  return useQuery({
    queryKey: currenciesKeys.list(enabledOnly),
    queryFn: () => currenciesApi.getCurrencies(enabledOnly),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single currency by ID
 */
export function useCurrency(id: number) {
  return useQuery({
    queryKey: currenciesKeys.detail(id),
    queryFn: () => currenciesApi.getCurrencyById(id),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to create a new currency
 */
export function useCreateCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CurrencySeriesCreateRequest) => currenciesApi.createCurrency(data),
    onSuccess: () => {
      // Invalidate all currency lists to refetch with new data
      queryClient.invalidateQueries({ queryKey: currenciesKeys.lists() });
    },
  });
}

/**
 * Hook to update an existing currency
 */
export function useUpdateCurrency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CurrencySeriesUpdateRequest }) =>
      currenciesApi.updateCurrency(id, data),
    onSuccess: (updatedCurrency) => {
      // Invalidate lists and specific detail query
      queryClient.invalidateQueries({ queryKey: currenciesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: currenciesKeys.detail(updatedCurrency.id) });
    },
  });
}
