import { useCallback, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { replaceWithLogin } from '@/features/auth/utils/loginRedirect';

function AuthenticationLoadingState() {
  return (
    <div
      aria-label="Checking authentication"
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
    >
      <LoadingSpinner size="lg" text="Checking authentication…" />
    </div>
  );
}

export function AuthenticatedRoute() {
  const { error, isAuthenticated, isLoading, refetch } = useAuth();
  const location = useLocation();
  const returnUrl = `${location.pathname}${location.search}${location.hash}`;

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isLoading && !error && !isAuthenticated) {
      replaceWithLogin(returnUrl);
    }
  }, [error, isAuthenticated, isLoading, returnUrl]);

  if (isLoading || (!error && !isAuthenticated)) {
    return <AuthenticationLoadingState />;
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-4 text-center" role="alert">
          <h1 className="text-2xl font-semibold text-foreground">Authentication unavailable</h1>
          <p className="text-sm text-muted-foreground">
            We could not verify your session. Please try again.
          </p>
          <Button onClick={handleRetry}>Retry</Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
