import axios from 'axios';
import type { User } from '@/types/auth';
import type { SessionStatus } from '@/types/session';

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
 * - Frontend heartbeat (GET /auth/v1/session) refreshes IDP tokens and extends session TTL
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
 * Calls Session Gateway /auth/v1/user endpoint which validates session cookie
 * and returns user info from session hash
 */
export async function getCurrentUser(): Promise<User> {
  const response = await authClient.get<User>('/auth/v1/user');
  return response.data;
}

/**
 * Get session status for heartbeat
 * Calls Session Gateway /auth/v1/session which validates session,
 * refreshes IDP tokens if needed, and extends session TTL
 */
export async function getSessionStatus(): Promise<SessionStatus> {
  const response = await authClient.get<SessionStatus>('/auth/v1/session');
  return response.data;
}
