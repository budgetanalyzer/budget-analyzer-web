export interface SessionStatus {
  authenticated: boolean;
  userId: string;
  roles: string[];
  expiresAt: number; // Unix epoch seconds
  tokenRefreshed: boolean;
}
