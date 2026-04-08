// src/features/admin/transactions/api/useTransactionSearch.ts
import { useQuery, keepPreviousData, type UseQueryResult } from '@tanstack/react-query';
import { transactionSearchApi } from '@/api/transactionSearchApi';
import type {
  TransactionSearchResult,
  TransactionSearchQuery,
  PagedResponse,
} from '@/types/transactionSearch';
import type { ApiError } from '@/types/apiError';

const transactionSearchKey = (q: TransactionSearchQuery) => ['transactionSearch', q] as const;

interface UseTransactionSearchOptions {
  enabled?: boolean;
}

export function useTransactionSearch(
  query: TransactionSearchQuery,
  options: UseTransactionSearchOptions = {},
): UseQueryResult<PagedResponse<TransactionSearchResult>, ApiError> {
  return useQuery({
    queryKey: transactionSearchKey(query),
    queryFn: () => transactionSearchApi.search(query),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
    retry: 1,
    enabled: options.enabled,
  });
}
