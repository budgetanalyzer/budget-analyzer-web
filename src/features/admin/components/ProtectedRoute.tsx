import { Navigate } from 'react-router-dom';
import type { UserRole } from '@/types/auth';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthorization } from '@/lib/useAuthorization';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

/**
 * Route guard component that protects routes based on authentication and roles
 *
 * Usage:
 * - <ProtectedRoute>...</ProtectedRoute> - Requires authentication only
 * - <ProtectedRoute allowedRoles={['ADMIN']}>...</ProtectedRoute> - Requires auth + role
 */
export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { checkAccess } = useAuthorization();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role-based access if roles are specified
  if (allowedRoles && !checkAccess({ allowedRoles })) {
    return <Navigate to="/unauthorized" replace />;
  }

  // User is authenticated and authorized
  return <>{children}</>;
}
