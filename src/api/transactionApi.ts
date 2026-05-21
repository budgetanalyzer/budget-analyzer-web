// src/api/transactionApi.ts
import { apiClient } from '@/api/client';
import { ApiError } from '@/types/apiError';
import {
  Transaction,
  TransactionUpdateRequest,
  TransactionCountFilter,
  PreviewResponse,
  BatchImportRequest,
  BatchImportTransactionRequest,
  BatchImportResponse,
} from '@/types/transaction';

function toBatchImportTransaction(
  transaction: BatchImportTransactionRequest,
): BatchImportTransactionRequest {
  const {
    date,
    description,
    amount,
    type,
    category,
    bankName,
    currencyIsoCode,
    accountId,
    allowDuplicate,
  } = transaction;

  return {
    date,
    description,
    amount,
    type,
    category,
    bankName,
    currencyIsoCode,
    accountId,
    ...(allowDuplicate === true ? { allowDuplicate } : {}),
  };
}

const PREVIEW_UPLOAD_TOO_LARGE_MESSAGE = 'Sorry, the file exceeds our 25MB limit.';

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

    try {
      const response = await apiClient.post<PreviewResponse>(
        `/v1/transactions/preview?${params.toString()}`,
        formData,
        {
          // Override the API client's JSON default so Axios leaves FormData as multipart.
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
      return response.data;
    } catch (error) {
      if (error instanceof ApiError && error.status === 413) {
        throw new ApiError(413, {
          type: 'INVALID_REQUEST',
          message: PREVIEW_UPLOAD_TOO_LARGE_MESSAGE,
        });
      }

      throw error;
    }
  },

  batchImportTransactions: async (request: BatchImportRequest): Promise<BatchImportResponse> => {
    const response = await apiClient.post<BatchImportResponse>('/v1/transactions/batch', {
      previewImportToken: request.previewImportToken,
      transactions: request.transactions.map(toBatchImportTransaction),
    });
    return response.data;
  },

  countTransactions: async (filter: TransactionCountFilter): Promise<number> => {
    const response = await apiClient.get<number>('/v1/transactions/count', { params: filter });
    return response.data;
  },
};
