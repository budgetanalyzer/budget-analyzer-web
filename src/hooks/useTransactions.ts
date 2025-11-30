// src/hooks/useTransactions.ts
import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { Transaction, TransactionUpdateRequest } from '@/types/transaction';
import { transactionApi } from '@/api/transactionApi';
import { mockTransactions } from '@/api/mockData';
import { ApiError } from '@/types/apiError';

const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export const useTransactions = (): UseQueryResult<Transaction[], ApiError> => {
  return useQuery<Transaction[], ApiError>({
    queryKey: ['transactions'],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        return mockTransactions;
      }
      return transactionApi.getTransactions();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
};

export const useTransaction = (id: number): UseQueryResult<Transaction, ApiError> => {
  return useQuery<Transaction, ApiError>({
    queryKey: ['transaction', id],
    queryFn: async () => {
      if (USE_MOCK_DATA) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        const transaction = mockTransactions.find((t) => t.id === id);
        if (!transaction) {
          throw new ApiError(404, {
            type: 'NOT_FOUND',
            message: `Transaction with ID ${id} could not be located.`,
          });
        }
        return transaction;
      }
      return transactionApi.getTransaction(id);
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
    enabled: !!id,
  });
};

export const useDeleteTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation<void, ApiError, number>({
    mutationFn: async (id: number) => {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        // In mock mode, just simulate success
        return;
      }
      return transactionApi.deleteTransaction(id);
    },
    onSuccess: (_data, deletedId) => {
      // Optimistically update cache by removing the deleted transaction
      queryClient.setQueryData<Transaction[]>(['transactions'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.filter((transaction) => transaction.id !== deletedId);
      });
    },
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation<Transaction, ApiError, { id: number; data: TransactionUpdateRequest }>({
    mutationFn: async ({ id, data }) => {
      if (USE_MOCK_DATA) {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        // In mock mode, find and update the transaction
        const transaction = mockTransactions.find((t) => t.id === id);
        if (!transaction) {
          throw new ApiError(404, {
            type: 'NOT_FOUND',
            message: `Transaction with ID ${id} could not be located.`,
          });
        }
        return {
          ...transaction,
          ...data,
          updatedAt: new Date().toISOString(),
        };
      }
      return transactionApi.updateTransaction(id, data);
    },
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
