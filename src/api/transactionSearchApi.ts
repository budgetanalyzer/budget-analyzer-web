// src/api/transactionSearchApi.ts
import { apiClient } from '@/api/client';
import type {
  TransactionSearchResult,
  TransactionSearchQuery,
  PagedResponse,
} from '@/types/transactionSearch';

export const transactionSearchApi = {
  search: async (
    query: TransactionSearchQuery,
  ): Promise<PagedResponse<TransactionSearchResult>> => {
    const response = await apiClient.get<PagedResponse<TransactionSearchResult>>(
      '/v1/transactions/search',
      {
        params: query,
        // Serialize sort=date,DESC&sort=id,DESC (Spring style), not sort[0]=...
        paramsSerializer: { indexes: null },
      },
    );
    return response.data;
  },
};
