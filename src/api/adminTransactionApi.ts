// src/api/adminTransactionApi.ts
import { apiClient } from '@/api/client';
import type {
  AdminTransaction,
  AdminTransactionsQuery,
  PagedResponse,
} from '@/types/adminTransaction';

export const adminTransactionApi = {
  searchTransactions: async (
    query: AdminTransactionsQuery,
  ): Promise<PagedResponse<AdminTransaction>> => {
    const response = await apiClient.get<PagedResponse<AdminTransaction>>(
      '/v1/admin/transactions',
      {
        params: query,
        // Serialize sort=date,DESC&sort=id,DESC (Spring style), not sort[0]=...
        paramsSerializer: { indexes: null },
      },
    );
    return response.data;
  },
};
