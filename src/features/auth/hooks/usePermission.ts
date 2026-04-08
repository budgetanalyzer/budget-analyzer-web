import { useAuth } from '@/features/auth/hooks/useAuth';
import { hasPermission } from '@/features/auth/utils/permissions';

/**
 * React hook returning whether the current user holds the named permission.
 *
 * Use for action-level gating (button visibility, page guards). For layout
 * decisions, prefer `isAdmin` / `AdminRoute`. See
 * `docs/plans/permission-based-authorization-cleanup.md`.
 */
export function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return hasPermission(user ?? null, permission);
}
