export interface SessionStatus {
  userId: string;
  roles: string[];
  expiresAt: number; // Unix epoch seconds
}
