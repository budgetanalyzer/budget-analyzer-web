import axios from 'axios';
import type { User } from '@/types/auth';

/**
 * Auth API endpoints
 *
 * Authentication is handled by the Session Gateway (port 8081), accessed via
 * NGINX SSL termination at https://app.budgetanalyzer.localhost (port 443).
 *
 * All requests go through the Session Gateway which manages:
 * - OAuth2/OIDC flows with Auth0
 * - Session cookies (HttpOnly, Secure, SameSite)
 * - JWT token storage in Redis
 * - Automatic token refresh
 *
 * Frontend never sees JWTs - they're managed server-side by Session Gateway.
 */

// Create a separate axios instance for auth that includes credentials
// and uses absolute paths (not the API base URL)
const authClient = axios.create({
  baseURL: '/', // Root of Session Gateway
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include session cookies in requests
  timeout: 10000,
});

/**
 * Get current user profile
 * Calls Session Gateway /user endpoint which validates session cookie
 * and returns user info extracted from JWT
 */
export async function getCurrentUser(): Promise<User> {
  const response = await authClient.get<User>('/user');
  return response.data;
}

/**
 * Logout
 * Calls Session Gateway /logout endpoint which:
 * - Invalidates Redis session
 * - Clears session cookie
 * - Redirects to Auth0 logout (then back to app)
 */
export async function logout(): Promise<void> {
  await authClient.post('/logout');
}
