// src/hooks/useTransactionCount.ts
import { useQuery } from '@tanstack/react-query';
import { TransactionCountFilter } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

export const useTransactionCount = (filter: TransactionCountFilter, enabled = true) => {
  return useQuery<number, ApiError>({
    queryKey: ['transactionCount', filter],
    queryFn: () => transactionApi.countTransactions(filter),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
};
