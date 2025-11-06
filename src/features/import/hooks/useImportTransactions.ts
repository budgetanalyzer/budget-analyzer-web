// src/features/import/hooks/useImportTransactions.ts
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { Transaction } from '@/types/transaction';
import { transactionApi } from '@/features/transactions/api/transactionApi';
import { mockTransactions } from '@/features/transactions/api/mockData';
import { ApiError } from '@/types/apiError';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

interface ImportTransactionsParams {
  files: File[];
  format: string;
  accountId?: string;
}

export const useImportTransactions = (): UseMutationResult<
  Transaction[],
  ApiError,
  ImportTransactionsParams
> => {
  const queryClient = useQueryClient();

  return useMutation<Transaction[], ApiError, ImportTransactionsParams>({
    mutationFn: async ({ files, format, accountId }: ImportTransactionsParams) => {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Return a subset of mock transactions to simulate import
        return mockTransactions.slice(0, files.length * 3);
      }
      return transactionApi.importTransactions(files, format, accountId);
    },
    onSuccess: () => {
      // Invalidate transactions query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
