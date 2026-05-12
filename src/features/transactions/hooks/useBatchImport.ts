// src/features/transactions/hooks/useBatchImport.ts
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { BatchImportRequest, BatchImportResponse } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

export const useBatchImport = (): UseMutationResult<
  BatchImportResponse,
  ApiError,
  BatchImportRequest
> => {
  const queryClient = useQueryClient();

  return useMutation<BatchImportResponse, ApiError, BatchImportRequest>({
    mutationFn: (request: BatchImportRequest) => transactionApi.batchImportTransactions(request),
    onSuccess: () => {
      // Invalidate transactions query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactionCount'] });
    },
  });
};
