import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { User } from '@/types/auth';
import * as authApi from '@/api/auth';

/**
 * Authentication hook
 * Manages user authentication state and provides auth operations
 *
 * Authentication flow:
 * 1. User clicks login -> redirected to Session Gateway OAuth flow
 * 2. Session Gateway handles OAuth with identity provider, stores tokens in Redis
 * 3. Session Gateway dual-writes session data to ext_authz Redis schema
 * 4. Session Gateway sets HttpOnly session cookie in browser
 * 5. Frontend checks /user endpoint to get current user info
 * 6. All API calls include session cookie automatically (credentials: 'include')
 * 7. ext_authz validates session and injects identity headers per-request
 */
export function useAuth() {
  const queryClient = useQueryClient();

  // Get current user from Session Gateway
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['auth', 'currentUser'],
    queryFn: async () => {
      try {
        // Call Session Gateway /user endpoint to get current user
        // This validates the session cookie and returns user info
        const user = await authApi.getCurrentUser();
        return user;
      } catch {
        // No valid session - user is not authenticated
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on auth failures
  });

  // Login - redirect to Session Gateway OAuth flow
  const login = (returnUrl?: string) => {
    // Redirect to Session Gateway OAuth2 authorization endpoint
    // Session Gateway will:
    // 1. Redirect to identity provider for authentication
    // 2. Handle OAuth callback
    // 3. Store tokens in Redis
    // 4. Set session cookie
    // 5. Redirect back to frontend
    const url = returnUrl
      ? `/oauth2/authorization/idp?returnUrl=${encodeURIComponent(returnUrl)}`
      : '/oauth2/authorization/idp';
    window.location.href = url;
  };

  // Logout - navigate to Session Gateway logout endpoint
  // This allows the browser to follow the full redirect chain:
  // /logout → Session Gateway clears session → IdP logout → back to app
  const logout = () => {
    // Clear cached data before navigating
    queryClient.clear();
    // Navigate to logout endpoint (browser follows redirects)
    window.location.href = '/logout';
  };

  return {
    // State
    user,
    isLoading,
    isAuthenticated: !!user,

    // Operations
    login,
    logout,
  };
}

/**
 * Hook to require authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  if (!isLoading && !isAuthenticated) {
    navigate('/login', { replace: true });
  }

  return { isLoading };
}
