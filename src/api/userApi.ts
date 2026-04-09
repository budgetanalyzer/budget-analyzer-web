// src/api/userApi.ts
import { apiClient } from '@/api/client';
import type { PagedResponse } from '@/types/transactionSearch';
import type {
  UserDeactivationResponse,
  UserDetail,
  UserSearchQuery,
  UserSummary,
} from '@/types/user';

export const userApi = {
  /**
   * Deactivate a user by ID
   * POST /v1/users/{id}/deactivate
   */
  deactivateUser: async (id: string): Promise<UserDeactivationResponse> => {
    const response = await apiClient.post<UserDeactivationResponse>(
      `/v1/users/${encodeURIComponent(id)}/deactivate`,
    );
    return response.data;
  },

  /**
   * Search users with filters, sorting, and pagination
   * GET /v1/users
   */
  searchUsers: async (query: UserSearchQuery): Promise<PagedResponse<UserSummary>> => {
    const response = await apiClient.get<PagedResponse<UserSummary>>('/v1/users', {
      params: query,
      // Serialize sort=createdAt,DESC&sort=id,DESC (Spring style), not sort[0]=...
      paramsSerializer: { indexes: null },
    });
    return response.data;
  },

  /**
   * Fetch a single user by ID
   * GET /v1/users/{id}
   */
  getUser: async (id: string): Promise<UserDetail> => {
    const response = await apiClient.get<UserDetail>(`/v1/users/${encodeURIComponent(id)}`);
    return response.data;
  },
};
