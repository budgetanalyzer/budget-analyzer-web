// src/components/Layout.tsx
import { Outlet, Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { Wallet } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CurrencySelector } from '@/components/CurrencySelector';
import { ViewSelector } from '@/components/ViewSelector';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { UserProfileDropdown } from '@/features/auth/components/UserProfileDropdown';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isAdmin } from '@/features/auth/utils/role';
import { cn } from '@/utils/cn';
import { PermissionGuard } from '@/features/auth/components/PermissionGuard';

export function Layout() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Check if we should show breadcrumbs (only when returnTo and breadcrumbLabel are present)
  const returnTo = searchParams.get('returnTo');
  const breadcrumbLabel = searchParams.get('breadcrumbLabel');
  const showBreadcrumbs = returnTo && breadcrumbLabel;

  // Redirect authenticated admin users to their role-specific layout.
  if (user && isAdmin(user.roles)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2 font-semibold">
              <Wallet className="h-6 w-6 text-primary" />
              <span className="text-xl">Budget Analyzer</span>
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                to="/"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  location.pathname === '/' ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Transactions
              </Link>
              <Link
                to="/analytics"
                className={cn(
                  'text-sm font-medium transition-colors hover:text-primary',
                  location.pathname === '/analytics' ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                Analytics
              </Link>
              <PermissionGuard permission="views:read" fallback={null}>
                <ViewSelector />
              </PermissionGuard>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <CurrencySelector />
            <ThemeToggle />
            <UserProfileDropdown />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {showBreadcrumbs && <Breadcrumbs returnTo={returnTo} label={breadcrumbLabel} />}
        <Outlet />
      </main>
    </div>
  );
}
