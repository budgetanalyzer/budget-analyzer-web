import { describe, it, expect } from 'vitest';
import { isAdmin } from '@/features/auth/utils/role';

describe('isAdmin', () => {
  it('returns true when ADMIN is present among the roles', () => {
    expect(isAdmin(['USER', 'ADMIN'])).toBe(true);
  });

  it('returns false for users without the ADMIN role', () => {
    expect(isAdmin(['USER'])).toBe(false);
  });

  it('returns false when the role list is empty', () => {
    expect(isAdmin([])).toBe(false);
  });
});
