// src/hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Transaction, TransactionUpdateRequest } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { ApiError } from '@/types/apiError';

export const useTransactions = (): UseQueryResult<Transaction[], ApiError> => {
  return useQuery<Transaction[], ApiError>({
    queryKey: ['transactions'],
    queryFn: () => transactionApi.getTransactions(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
};

export const useTransaction = (id: number): UseQueryResult<Transaction, ApiError> => {
  return useQuery<Transaction, ApiError>({
    queryKey: ['transaction', id],
    queryFn: () => transactionApi.getTransaction(id),
    staleTime: 1000 * 60 * 5,
    retry: 1,
    enabled: !!id,
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: (id: number) => transactionApi.deleteTransaction(id),
    onSuccess: (_data, deletedId) => {
      // Optimistically update cache by removing the deleted transaction
      queryClient.setQueryData<Transaction[]>(['transactions'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter((transaction) => transaction.id !== deletedId);
      });

      queryClient.invalidateQueries({ queryKey: ['transactionCount'] });
    },
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation<Transaction, ApiError, { id: number; data: TransactionUpdateRequest }>({
    mutationFn: ({ id, data }) => transactionApi.updateTransaction(id, data),
    onSuccess: (updatedTransaction) => {
      // Update the transactions list cache
      queryClient.setQueryData<Transaction[]>(['transactions'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map((transaction) =>
          transaction.id === updatedTransaction.id ? updatedTransaction : transaction,
        );
      });

      // Update the single transaction cache
      queryClient.setQueryData<Transaction>(
        ['transaction', updatedTransaction.id],
        updatedTransaction,
      );
    },
  });
};
