import type { UserRole } from '@/types/auth';
import { useAuthorization } from '@/lib/useAuthorization';

interface AuthorizationProps {
  allowedRoles: UserRole[];
  forbiddenFallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Authorization component
 * Renders children only if user has at least one matching role
 */
export function Authorization({
  allowedRoles,
  forbiddenFallback = null,
  children,
}: AuthorizationProps) {
  const { checkAccess } = useAuthorization();

  if (!checkAccess({ allowedRoles })) {
    return <>{forbiddenFallback}</>;
  }

  return <>{children}</>;
}
