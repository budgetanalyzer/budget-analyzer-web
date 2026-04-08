import { Navigate } from 'react-router';
import { usePermission } from '@/features/auth/hooks/usePermission';

interface PermissionGuardProps {
  permission: string;
  children: React.ReactNode;
  /** Override the default redirect-to-unauthorized behavior (e.g. `null` to hide inline). */
  fallback?: React.ReactNode;
}

/**
 * Guards a subtree on a single backend permission string.
 *
 * - Route-level usage: omit `fallback`; denied users are redirected to
 *   `/unauthorized`. Because children never mount, their queries never fire.
 * - Inline usage: pass `fallback={null}` (or any alternative UI) to hide the
 *   subtree without navigating away.
 *
 * For multi-permission gates or imperative checks, use `usePermission` directly.
 */
export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const allowed = usePermission(permission);
  if (!allowed) {
    return fallback !== undefined ? <>{fallback}</> : <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
