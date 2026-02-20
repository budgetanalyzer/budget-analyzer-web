// src/features/transactions/hooks/usePreviewTransactions.ts
import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { PreviewResponse } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

interface PreviewTransactionsParams {
  file: File;
  format: string;
  accountId?: string;
}

export const usePreviewTransactions = (): UseMutationResult<
  PreviewResponse,
  ApiError,
  PreviewTransactionsParams
> => {
  return useMutation<PreviewResponse, ApiError, PreviewTransactionsParams>({
    mutationFn: ({ file, format, accountId }: PreviewTransactionsParams) =>
      transactionApi.previewTransactions(file, format, accountId),
  });
};
