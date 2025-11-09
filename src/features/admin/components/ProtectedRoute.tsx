import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/admin/hooks/useAuth';
import type { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  requireAnyRole?: UserRole[];
  requireAllRoles?: UserRole[];
}

/**
 * Route guard component that protects routes based on authentication and authorization
 *
 * Usage:
 * - <ProtectedRoute>...</ProtectedRoute> - Requires authentication only
 * - <ProtectedRoute requiredRole="ADMIN">...</ProtectedRoute> - Requires ADMIN role
 * - <ProtectedRoute requireAnyRole={["ADMIN", "SUPER_ADMIN"]}>...</ProtectedRoute> - Requires at least one role
 * - <ProtectedRoute requireAllRoles={["ADMIN", "EDITOR"]}>...</ProtectedRoute> - Requires all roles
 */
export function ProtectedRoute({
  children,
  requiredRole,
  requireAnyRole,
  requireAllRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, hasAnyRole, hasAllRoles } = useAuth();

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

  // Check role requirements
  if (requiredRole && !hasRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requireAnyRole && !hasAnyRole(...requireAnyRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requireAllRoles && !hasAllRoles(...requireAllRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // User is authenticated and authorized
  return <>{children}</>;
}
