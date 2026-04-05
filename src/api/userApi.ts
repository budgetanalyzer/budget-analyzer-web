// src/api/userApi.ts
import { apiClient } from '@/api/client';
import { UserDeactivationResponse } from '@/types/user';

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
};
