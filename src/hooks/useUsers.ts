// src/hooks/useUsers.ts
import { useMutation } from '@tanstack/react-query';
import { userApi } from '@/api/userApi';

/**
 * Mutation hook to deactivate a user by ID.
 */
export function useDeactivateUser() {
  return useMutation({
    mutationFn: (userId: string) => userApi.deactivateUser(userId),
  });
}
