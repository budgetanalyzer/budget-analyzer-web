// src/api/transactionApi.ts
import { apiClient } from '@/api/client';
import {
  Transaction,
  TransactionUpdateRequest,
  TransactionCountFilter,
  PreviewResponse,
  PreviewTransaction,
  BatchImportResponse,
} from '@/types/transaction';

export const transactionApi = {
  getTransactions: async (): Promise<Transaction[]> => {
    const response = await apiClient.get<Transaction[]>('/v1/transactions');
    return response.data;
  },

  getTransaction: async (id: number): Promise<Transaction> => {
    const response = await apiClient.get<Transaction>(`/v1/transactions/${id}`);
    return response.data;
  },

  deleteTransaction: async (id: number): Promise<void> => {
    await apiClient.delete(`/v1/transactions/${id}`);
  },

  bulkDeleteTransactions: async (
    ids: number[],
  ): Promise<{ deletedCount: number; notFoundIds: number[] }> => {
    const response = await apiClient.post<{ deletedCount: number; notFoundIds: number[] }>(
      '/v1/transactions/bulk-delete',
      { ids },
    );
    return response.data;
  },

  updateTransaction: async (id: number, data: TransactionUpdateRequest): Promise<Transaction> => {
    const response = await apiClient.patch<Transaction>(`/v1/transactions/${id}`, data);
    return response.data;
  },

  previewTransactions: async (
    file: File,
    format: string,
    accountId?: string,
  ): Promise<PreviewResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams({ format });
    if (accountId) {
      params.append('accountId', accountId);
    }

    const response = await apiClient.post<PreviewResponse>(
      `/v1/transactions/preview?${params.toString()}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );
    return response.data;
  },

  batchImportTransactions: async (
    transactions: PreviewTransaction[],
  ): Promise<BatchImportResponse> => {
    const response = await apiClient.post<BatchImportResponse>('/v1/transactions/batch', {
      transactions,
    });
    return response.data;
  },

  countTransactions: async (filter: TransactionCountFilter): Promise<number> => {
    const response = await apiClient.get<number>('/v1/transactions/count', { params: filter });
    return response.data;
  },
};
