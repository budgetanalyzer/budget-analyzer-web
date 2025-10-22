// src/hooks/useImportTransactions.ts
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { Transaction } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { mockTransactions } from '@/api/mockData';
import { ApiError } from '@/types/apiError';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export const useImportTransactions = (): UseMutationResult<Transaction[], ApiError, File> => {
  const queryClient = useQueryClient();

  return useMutation<Transaction[], ApiError, File>({
    mutationFn: async (file: File) => {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Return a subset of mock transactions to simulate import
        return mockTransactions.slice(0, 3);
      }
      return transactionApi.importTransactions(file);
    },
    onSuccess: () => {
      // Invalidate transactions query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
