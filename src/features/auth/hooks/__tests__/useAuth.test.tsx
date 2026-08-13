import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { navigateToLogin } from '@/features/auth/utils/loginRedirect';
import { createTestQueryClient } from '@/testing/test-utils';
import { server } from '@/testing/mocks/server';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/features/auth/utils/loginRedirect', () => ({
  navigateToLogin: vi.fn(),
}));

const authenticatedUser = {
  sub: 'user-1',
  email: 'user@example.com',
  authenticated: true,
  roles: ['USER'] as const,
  permissions: ['transactions:read'],
};

function renderUseAuth() {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, ...renderHook(() => useAuth(), { wrapper: Wrapper }) };
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.mocked(navigateToLogin).mockReset();
  });

  it('exposes an authenticated user after bootstrap succeeds', async () => {
    server.use(http.get('/auth/v1/user', () => HttpResponse.json(authenticatedUser)));
    const { result } = renderUseAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toEqual(authenticatedUser);
    expect(result.current.error).toBeNull();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('treats only HTTP 401 as an anonymous session', async () => {
    server.use(http.get('/auth/v1/user', () => new HttpResponse(null, { status: 401 })));
    const { result } = renderUseAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it.each([500, 503])('exposes HTTP %s bootstrap failures as retryable errors', async (status) => {
    server.use(
      http.get('/auth/v1/user', () => HttpResponse.json({ message: 'Unavailable' }, { status })),
    );
    const { result } = renderUseAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeUndefined();
    expect(result.current.error).toMatchObject({ response: { status } });
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('exposes network bootstrap failures instead of treating them as anonymous', async () => {
    server.use(http.get('/auth/v1/user', () => HttpResponse.error()));
    const { result } = renderUseAuth();

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeUndefined();
    expect(result.current.error).toBeTruthy();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('exposes refetch so authentication bootstrap can be retried', async () => {
    let isAvailable = false;
    server.use(
      http.get('/auth/v1/user', () =>
        isAvailable
          ? HttpResponse.json(authenticatedUser)
          : HttpResponse.json({ message: 'Unavailable' }, { status: 503 }),
      ),
    );
    const { result } = renderUseAuth();
    await waitFor(() => expect(result.current.error).toBeTruthy());

    isAvailable = true;
    await act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    expect(result.current.user).toEqual(authenticatedUser);
    expect(result.current.error).toBeNull();
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('memoizes login and logout and routes login through the navigation utility', async () => {
    server.use(http.get('/auth/v1/user', () => HttpResponse.json(authenticatedUser)));
    const { result, rerender } = renderUseAuth();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    const firstLogin = result.current.login;
    const firstLogout = result.current.logout;

    rerender();
    result.current.login('/analytics?range=month#chart');

    expect(result.current.login).toBe(firstLogin);
    expect(result.current.logout).toBe(firstLogout);
    expect(navigateToLogin).toHaveBeenCalledWith('/analytics?range=month#chart');
  });
});
