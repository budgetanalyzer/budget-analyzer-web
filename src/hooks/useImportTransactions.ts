// src/hooks/useImportTransactions.ts
import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { Transaction } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

export const useImportTransactions = (): UseMutationResult<Transaction[], ApiError, File> => {
  const queryClient = useQueryClient();

  return useMutation<Transaction[], ApiError, File>({
    mutationFn: (file: File) => transactionApi.importTransactions(file),
    onSuccess: () => {
      // Invalidate transactions query to refetch the updated list
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
