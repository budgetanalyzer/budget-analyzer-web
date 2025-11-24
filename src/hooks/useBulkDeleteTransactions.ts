// src/hooks/useBulkDeleteTransactions.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export interface BulkDeleteResult {
  deletedCount: number;
  notFoundIds: number[];
}

export const useBulkDeleteTransactions = () => {
  const queryClient = useQueryClient();

  return useMutation<BulkDeleteResult, ApiError, number[]>({
    mutationFn: async (ids: number[]) => {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        // In mock mode, simulate all successes
        return {
          deletedCount: ids.length,
          notFoundIds: [],
        };
      }

      // Call bulk delete endpoint
      return await transactionApi.bulkDeleteTransactions(ids);
    },
    onSuccess: (result, deletedIds) => {
      // Optimistically update cache by removing successfully deleted transactions
      const successfullyDeletedIds = deletedIds.filter((id) => !result.notFoundIds.includes(id));

      queryClient.setQueryData<Transaction[]>(['transactions'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter((transaction) => !successfullyDeletedIds.includes(transaction.id));
      });
    },
  });
};
