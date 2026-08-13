// src/api/transactionApi.ts
import { apiClient } from '@/api/client';
import { assertArrayResponse } from '@/api/collectionResponse';
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

const PREVIEW_UPLOAD_TOO_LARGE_MESSAGE = 'The selected files exceed the upload size limit.';
const GROUPED_PREVIEW_TIMEOUT_MS = 60_000;

export interface PreviewTransactionsRequest {
  files: File[];
  statementFormatId: number;
  accountId?: string;
}

export const transactionApi = {
  getTransactions: async (): Promise<Transaction[]> => {
    const response = await apiClient.get<unknown>('/v1/transactions');
    return assertArrayResponse<Transaction>(response.data);
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

  previewTransactions: async ({
    files,
    statementFormatId,
    accountId,
  }: PreviewTransactionsRequest): Promise<PreviewResponse> => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const params = new URLSearchParams({ statementFormatId: String(statementFormatId) });
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
          timeout: GROUPED_PREVIEW_TIMEOUT_MS,
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
      files: request.files.map((file) => ({
        previewImportToken: file.previewImportToken,
        transactions: file.transactions.map(toBatchImportTransaction),
      })),
    });
    return response.data;
  },

  countTransactions: async (filter: TransactionCountFilter): Promise<number> => {
    const response = await apiClient.get<number>('/v1/transactions/count', { params: filter });
    return response.data;
  },
};
