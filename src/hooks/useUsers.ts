// src/hooks/useUsers.ts
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { userApi } from '@/api/userApi';
import type { ApiError } from '@/types/apiError';
import type { PagedResponse } from '@/types/transactionSearch';
import type { UserDetail, UserSearchQuery, UserSummary } from '@/types/user';

export const userKeys = {
  detail: (id: string | undefined) => ['user', id] as const,
  search: (q: UserSearchQuery) => ['userSearch', q] as const,
  searchAll: ['userSearch'] as const,
};

/**
 * Mutation hook to deactivate a user by ID.
 */
export function useDeactivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => userApi.deactivateUser(userId),
    onSuccess: async (_, userId) => {
      await queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
      await queryClient.invalidateQueries({ queryKey: userKeys.searchAll });
    },
  });
}

/**
 * Query hook for searching users with filters, sorting, and pagination.
 */
export function useUserSearch(
  query: UserSearchQuery,
): UseQueryResult<PagedResponse<UserSummary>, ApiError> {
  return useQuery({
    queryKey: userKeys.search(query),
    queryFn: () => userApi.searchUsers(query),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
    retry: 1,
  });
}

/**
 * Query hook for fetching a single user by ID.
 */
export function useUser(id: string | undefined): UseQueryResult<UserDetail, ApiError> {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => userApi.getUser(id as string),
    enabled: !!id,
    staleTime: 1000 * 30,
    retry: 1,
  });
}
