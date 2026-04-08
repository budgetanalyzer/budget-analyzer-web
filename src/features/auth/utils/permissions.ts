import type { User } from '@/types/auth';

/**
 * Check whether the given user holds the named backend permission.
 *
 * Permissions drive action-level UI gating (button visibility, page guards).
 * Layout decisions (which chrome surrounds the page) belong to `isAdmin` /
 * `AdminRoute`. See `docs/plans/permission-based-authorization-cleanup.md`.
 *
 * Returns `false` for an absent user or unknown permission string.
 */
export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}
