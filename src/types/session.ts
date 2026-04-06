export interface SessionStatus {
  active: boolean;
  userId: string;
  roles: string[];
  expiresAt: number; // Unix epoch seconds
}
