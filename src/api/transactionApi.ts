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
};
