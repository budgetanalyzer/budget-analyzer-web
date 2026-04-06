// src/features/admin/transactions/api/useAdminTransactions.ts
import { useQuery, keepPreviousData, type UseQueryResult } from '@tanstack/react-query';
import { adminTransactionApi } from '@/api/adminTransactionApi';
import type {
  AdminTransaction,
  AdminTransactionsQuery,
  PagedResponse,
} from '@/types/adminTransaction';
import type { ApiError } from '@/types/apiError';

const adminTransactionsKey = (q: AdminTransactionsQuery) => ['adminTransactions', q] as const;

export function useAdminTransactions(
  query: AdminTransactionsQuery,
): UseQueryResult<PagedResponse<AdminTransaction>, ApiError> {
  return useQuery({
    queryKey: adminTransactionsKey(query),
    queryFn: () => adminTransactionApi.searchTransactions(query),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
    retry: 1,
  });
}
