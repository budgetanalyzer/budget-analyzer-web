/**
 * Authentication types
 */

/**
 * User profile information from Session Gateway /user endpoint
 * Maps to OAuth2User attributes from Auth0
 */
export interface User {
  sub: string; // User ID (Auth0 subject)
  email: string;
  name?: string;
  picture?: string; // Profile picture URL from Auth0
  emailVerified?: boolean;
  authenticated: boolean;
  registrationId?: string; // OAuth2 registration ID (e.g., "auth0")
}
