// src/features/transactions/hooks/usePreviewTransactions.ts
import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { PreviewResponse } from '@/types/transaction';
import { transactionApi, type PreviewTransactionsRequest } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

export const usePreviewTransactions = (): UseMutationResult<
  PreviewResponse,
  ApiError,
  PreviewTransactionsRequest
> => {
  return useMutation<PreviewResponse, ApiError, PreviewTransactionsRequest>({
    mutationFn: (request: PreviewTransactionsRequest) =>
      transactionApi.previewTransactions(request),
  });
};
