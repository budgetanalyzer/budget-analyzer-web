// src/hooks/useBulkDeleteTransactions.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

export interface BulkDeleteResult {
  deletedCount: number;
  notFoundIds: number[];
}

export const useBulkDeleteTransactions = () => {
  const queryClient = useQueryClient();

  return useMutation<BulkDeleteResult, ApiError, number[]>({
    mutationFn: (ids: number[]) => transactionApi.bulkDeleteTransactions(ids),
    onSuccess: (result, deletedIds) => {
      // Optimistically update cache by removing successfully deleted transactions
      const successfullyDeletedIds = deletedIds.filter((id) => !result.notFoundIds.includes(id));

      queryClient.setQueryData<Transaction[]>(['transactions'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter((transaction) => !successfullyDeletedIds.includes(transaction.id));
      });

      queryClient.invalidateQueries({ queryKey: ['transactionCount'] });
    },
  });
};
