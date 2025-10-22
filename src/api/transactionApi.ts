// src/api/transactionApi.ts
import { apiClient } from './client';
import { Transaction } from '@/types/transaction';

export const transactionApi = {
  getTransactions: async (): Promise<Transaction[]> => {
    const response = await apiClient.get<Transaction[]>('/transactions');
    return response.data;
  },

  getTransaction: async (id: number): Promise<Transaction> => {
    const response = await apiClient.get<Transaction>(`/transactions/${id}`);
    return response.data;
  },

  importTransactions: async (file: File): Promise<Transaction[]> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<Transaction[]>(
      '/transactions/import?format=capital-one&accountId=checking-12345',
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
