/**
 * Authentication types
 */

export type UserRole = 'USER' | 'ADMIN';

/**
 * User profile information from Session Gateway /auth/v1/user endpoint
 * Maps to OAuth2User attributes from identity provider
 */
export interface User {
  sub: string; // User ID (IdP subject)
  email: string;
  name?: string;
  picture?: string; // Profile picture URL from identity provider
  authenticated: boolean;
  roles: UserRole[];
}
