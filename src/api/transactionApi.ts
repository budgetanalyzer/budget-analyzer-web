// src/api/transactionApi.ts
import { apiClient } from '@/api/client';
import { Transaction, TransactionFilter } from '@/types/transaction';

export const transactionApi = {
  getTransactions: async (): Promise<Transaction[]> => {
    const response = await apiClient.get<Transaction[]>('/v1/transactions');
    return response.data;
  },

  getTransaction: async (id: number): Promise<Transaction> => {
    const response = await apiClient.get<Transaction>(`/v1/transactions/${id}`);
    return response.data;
  },

  searchTransactions: async (filter: TransactionFilter): Promise<Transaction[]> => {
    const response = await apiClient.post<Transaction[]>('/v1/transactions/search', filter);
    return response.data;
  },

  deleteTransaction: async (id: number): Promise<void> => {
    await apiClient.delete(`/v1/transactions/${id}`);
  },

  importTransactions: async (
    files: File[],
    format: string,
    accountId?: string,
  ): Promise<Transaction[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const params = new URLSearchParams({ format });
    if (accountId) {
      params.append('accountId', accountId);
    }

    const response = await apiClient.post<Transaction[]>(
      `/v1/transactions/import?${params.toString()}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },
};
