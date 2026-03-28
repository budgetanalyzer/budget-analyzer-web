import type { UserRole } from '@/types/auth';

export function isAdmin(roles: UserRole[]): boolean {
  return roles.includes('ADMIN');
}
