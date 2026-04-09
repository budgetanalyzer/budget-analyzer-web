// src/types/user.ts
export type UserStatus = 'ACTIVE' | 'DEACTIVATED';

export interface UserReference {
  id: string;
  displayName?: string;
  email?: string;
}

export interface UserDeactivationResponse {
  userId: string;
  status: UserStatus;
  rolesRemoved: number;
  sessionsRevoked: boolean;
}

export interface UserSummary {
  id: string;
  idpSub: string;
  email: string;
  displayName: string;
  status: UserStatus;
  roleIds: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  deactivatedAt?: string; // ISO 8601
}

export interface UserDetail extends UserSummary {
  deactivatedBy?: UserReference;
  deletedAt?: string; // ISO 8601
  deletedBy?: UserReference;
}

export interface UserSearchFilters {
  id?: string;
  email?: string;
  displayName?: string;
  idpSub?: string;
  status?: UserStatus;
  createdAfter?: string; // ISO 8601
  createdBefore?: string; // ISO 8601
  updatedAfter?: string; // ISO 8601
  updatedBefore?: string; // ISO 8601
}

export interface UserSearchQuery extends UserSearchFilters {
  page: number; // 0-based
  size: number;
  sort: string[]; // e.g. ['createdAt,DESC', 'id,DESC']
}
