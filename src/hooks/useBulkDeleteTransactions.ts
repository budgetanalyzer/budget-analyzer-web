// src/hooks/useBulkDeleteTransactions.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';
import { transactionKeys, viewKeys } from '@/queryKeys';

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

      queryClient.setQueryData<Transaction[]>(transactionKeys.list(), (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter((transaction) => !successfullyDeletedIds.includes(transaction.id));
      });

      queryClient.invalidateQueries({ queryKey: transactionKeys.list() });
      queryClient.invalidateQueries({ queryKey: transactionKeys.count() });
      queryClient.invalidateQueries({ queryKey: viewKeys.all });
    },
  });
};
