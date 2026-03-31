import axios from 'axios';
import type { User } from '@/types/auth';

/**
 * Auth API endpoints
 *
 * Authentication is handled by the Session Gateway (port 8081), accessed via
 * Istio Ingress Gateway at https://app.budgetanalyzer.localhost (port 443).
 *
 * All auth-path requests are routed by Istio Ingress to Session Gateway:
 * - OAuth2/OIDC flows with identity provider
 * - Session cookies (HttpOnly, Secure, SameSite)
 * - Token storage in Redis session hash (for refresh)
 * - Frontend heartbeat (GET /auth/session) refreshes IDP tokens and extends session TTL
 *
 * Frontend never sees tokens - they're managed server-side by Session Gateway.
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
 * and returns user info from session hash
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
 * - Redirects to IdP logout (then back to app)
 */
export async function logout(): Promise<void> {
  await authClient.post('/logout');
}
