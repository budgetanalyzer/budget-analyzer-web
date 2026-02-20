// src/features/transactions/hooks/useBatchImport.ts
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { PreviewTransaction, BatchImportResponse } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

export const useBatchImport = (): UseMutationResult<
  BatchImportResponse,
  ApiError,
  PreviewTransaction[]
> => {
  const queryClient = useQueryClient();

  return useMutation<BatchImportResponse, ApiError, PreviewTransaction[]>({
    mutationFn: (transactions: PreviewTransaction[]) =>
      transactionApi.batchImportTransactions(transactions),
    onSuccess: () => {
      // Invalidate transactions query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
