import { useCallback } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * Peace Page - Logout confirmation
 *
 * Displayed after successful logout from Auth0.
 * Provides option to sign back in.
 */
export function PeacePage() {
  const { login } = useAuth();

  const handleLogin = useCallback(() => {
    login();
  }, [login]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Peace out
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            You've been logged out successfully
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <button
            onClick={handleLogin}
            className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Sign in again
          </button>
        </div>
      </div>
    </div>
  );
}
