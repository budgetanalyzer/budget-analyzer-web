import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type { User } from '@/types/auth';
import * as authApi from '@/api/auth';
import { navigateToLogin } from '@/features/auth/utils/loginRedirect';

/**
 * Authentication hook
 * Manages user authentication state and provides auth operations
 *
 * Authentication flow:
 * 1. User clicks login -> redirected to Session Gateway OAuth flow
 * 2. Session Gateway handles OAuth with identity provider, stores tokens in the server-side session
 * 3. Session Gateway sets HttpOnly session cookie in browser
 * 4. Frontend checks /auth/v1/user endpoint to get current user info
 * 5. Frontend heartbeat (GET /auth/v1/session) extends the local session TTL (does not call the IdP)
 * 6. All API calls include session cookie automatically (credentials: 'include')
 * 7. ext_authz reads the server-side session and injects identity headers per-request
 */
export function useAuth() {
  const queryClient = useQueryClient();

  // Get current user from Session Gateway
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<User | null>({
    queryKey: ['auth', 'currentUser'],
    queryFn: async () => {
      try {
        // Call Session Gateway /auth/v1/user endpoint to get current user
        // This validates the session cookie and returns user info
        const user = await authApi.getCurrentUser();
        return user;
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return null;
        }

        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on auth failures
  });

  // Login - redirect to Session Gateway OAuth flow
  const login = useCallback((returnUrl?: string) => {
    // Redirect to Session Gateway OAuth2 authorization endpoint
    // Session Gateway will:
    // 1. Redirect to identity provider for authentication
    // 2. Handle OAuth callback
    // 3. Store session data in Redis
    // 4. Set session cookie
    // 5. Redirect back to frontend
    navigateToLogin(returnUrl);
  }, []);

  // Logout - navigate to Session Gateway logout endpoint
  // This allows the browser to follow the full redirect chain:
  // /logout → Session Gateway clears session → IdP logout → back to app
  const logout = useCallback(() => {
    // Clear cached data before navigating
    queryClient.clear();
    // Navigate to logout endpoint (browser follows redirects)
    window.location.assign('/logout');
  }, [queryClient]);

  return {
    // State
    user,
    error,
    isLoading,
    isAuthenticated: !!user,

    // Operations
    login,
    logout,
    refetch,
  };
}
