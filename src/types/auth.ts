/**
 * Authentication types
 */

export type UserRole = 'USER' | 'ADMIN';

/**
 * User profile information from Session Gateway /auth/v1/user endpoint
 * Maps to OAuth2User attributes from identity provider
 *
 * `roles` drives layout-level decisions (e.g., `AdminRoute`).
 * `permissions` drives action-level UI gating via `usePermission(...)`
 * (bulletproof-react convention). See:
 * `docs/authentication.md`.
 */
export interface User {
  sub: string; // User ID (IdP subject)
  email: string;
  name?: string;
  picture?: string; // Profile picture URL from identity provider
  authenticated: boolean;
  roles: UserRole[];
  permissions: string[];
}
