import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('@/features/auth/hooks/useAuth');

import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermission } from '@/features/auth/hooks/usePermission';

const mockUseAuth = vi.mocked(useAuth);

function mockAuthUser(permissions: string[] | null) {
  mockUseAuth.mockReturnValue({
    user:
      permissions === null
        ? null
        : {
            sub: 'user-1',
            email: 'user@example.com',
            authenticated: true,
            roles: ['USER'],
            permissions,
          },
    isLoading: false,
    isAuthenticated: permissions !== null,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

describe('usePermission', () => {
  it('returns true when the current user holds the permission', () => {
    mockAuthUser(['transactions:read:any']);
    const { result } = renderHook(() => usePermission('transactions:read:any'));
    expect(result.current).toBe(true);
  });

  it('returns false when the current user lacks the permission', () => {
    mockAuthUser(['transactions:read']);
    const { result } = renderHook(() => usePermission('transactions:read:any'));
    expect(result.current).toBe(false);
  });

  it('returns false when there is no current user', () => {
    mockAuthUser(null);
    const { result } = renderHook(() => usePermission('transactions:read'));
    expect(result.current).toBe(false);
  });
});
