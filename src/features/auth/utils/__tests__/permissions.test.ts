import { describe, it, expect } from 'vitest';
import { hasPermission } from '@/features/auth/utils/permissions';
import type { User } from '@/types/auth';

function makeUser(permissions: string[]): User {
  return {
    sub: 'user-1',
    email: 'user@example.com',
    authenticated: true,
    roles: ['USER'],
    permissions,
  };
}

describe('hasPermission', () => {
  it('returns false when user is null', () => {
    expect(hasPermission(null, 'transactions:read')).toBe(false);
  });

  it('returns false when user lacks the permission', () => {
    const user = makeUser(['transactions:read']);
    expect(hasPermission(user, 'transactions:write')).toBe(false);
  });

  it('returns true when user holds the permission', () => {
    const user = makeUser(['transactions:read', 'transactions:write']);
    expect(hasPermission(user, 'transactions:write')).toBe(true);
  });

  it('returns false for an unknown permission string (typo fails safe)', () => {
    const user = makeUser(['transactions:read']);
    expect(hasPermission(user, 'transactions:reed')).toBe(false);
  });

  it('returns false when user has an empty permission list', () => {
    const user = makeUser([]);
    expect(hasPermission(user, 'transactions:read')).toBe(false);
  });
});
