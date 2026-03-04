import type { UserRole } from '@/types/auth';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * Authorization hook
 * Checks if current user has any of the allowed roles
 */
export function useAuthorization() {
  const { user } = useAuth();

  const checkAccess = ({ allowedRoles }: { allowedRoles: UserRole[] }): boolean => {
    if (!user) return false;
    return user.roles.some((role) => allowedRoles.includes(role));
  };

  return { checkAccess };
}
