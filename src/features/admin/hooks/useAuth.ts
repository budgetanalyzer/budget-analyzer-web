import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { User, UserRole } from '@/types/auth';
import * as authApi from '@/api/auth';

/**
 * Authentication hook
 * Manages user authentication state and provides auth operations
 *
 * Authentication flow:
 * 1. User clicks login -> redirected to Session Gateway OAuth flow
 * 2. Session Gateway handles OAuth with Auth0, stores JWT in Redis
 * 3. Session Gateway sets HttpOnly session cookie in browser
 * 4. Frontend checks /user endpoint to get current user info
 * 5. All API calls include session cookie automatically (credentials: 'include')
 * 6. Session Gateway adds JWT to requests before forwarding to backend
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
  const login = () => {
    // Redirect to Session Gateway OAuth2 authorization endpoint
    // Session Gateway will:
    // 1. Redirect to Auth0 for authentication
    // 2. Handle OAuth callback
    // 3. Store tokens in Redis
    // 4. Set session cookie
    // 5. Redirect back to frontend
    window.location.href = '/oauth2/authorization/auth0';
  };

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      // Clear user data from cache
      queryClient.setQueryData(['auth', 'currentUser'], null);
      queryClient.clear(); // Clear all cached data
      // Redirect to home page after logout
      window.location.href = '/';
    },
  });

  return {
    // State
    user,
    isLoading,
    isAuthenticated: !!user,

    // Operations
    login,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,

    // Authorization helpers
    hasRole: (role: UserRole) => user?.roles?.includes(role) ?? false,
    hasAnyRole: (...roles: UserRole[]) => roles.some((role) => user?.roles?.includes(role)),
    hasAllRoles: (...roles: UserRole[]) => roles.every((role) => user?.roles?.includes(role)),
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

/**
 * Hook to require specific role
 * Redirects to unauthorized page if user doesn't have the role
 */
export function useRequireRole(role: UserRole) {
  const { hasRole, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isLoading) {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    } else if (!hasRole(role)) {
      navigate('/unauthorized', { replace: true });
    }
  }

  return { isLoading };
}
