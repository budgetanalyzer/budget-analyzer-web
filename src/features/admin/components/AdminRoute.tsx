import { Navigate, Outlet } from 'react-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isAdmin } from '@/features/auth/utils/role';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Skeleton that mimics AdminLayout structure during auth loading
 */
function AdminSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar skeleton */}
      <aside className="flex w-64 flex-col border-r bg-card">
        {/* Header */}
        <div className="border-b px-5 py-5">
          <Skeleton className="h-6 w-36 rounded-md" />
        </div>
        {/* User info */}
        <div className="flex items-center gap-3 border-b px-5 py-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>
        {/* Nav items */}
        <div className="flex-1 px-3 py-4">
          <Skeleton className="mb-3 h-3 w-20 rounded" />
          <div className="space-y-1.5">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </div>
      </aside>
      {/* Content skeleton */}
      <main className="flex-1 p-8">
        <Skeleton className="mb-2 h-8 w-48 rounded-md" />
        <Skeleton className="mb-8 h-4 w-72 rounded" />
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </main>
    </div>
  );
}

/**
 * Route guard for admin routes.
 * - Loading → skeleton mimicking admin layout
 * - Not authenticated → redirect to /login
 * - Authenticated but not admin → redirect to /
 * - Admin → render child routes
 */
export function AdminRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AdminSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !isAdmin(user.roles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
