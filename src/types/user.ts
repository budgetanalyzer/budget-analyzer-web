// src/types/user.ts
export interface UserDeactivationResponse {
  userId: string;
  status: 'ACTIVE' | 'DEACTIVATED';
  rolesRemoved: number;
  sessionsRevoked: boolean;
}
