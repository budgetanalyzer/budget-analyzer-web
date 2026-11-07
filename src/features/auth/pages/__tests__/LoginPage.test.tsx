import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';

vi.mock('@/features/auth/hooks/useAuth');

import { LoginPage } from '@/features/auth/pages/LoginPage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { User, UserRole } from '@/types/auth';

const mockUseAuth = vi.mocked(useAuth);

function createUser(roles: UserRole[]): User {
  return {
    sub: 'user-1',
    email: 'user@example.com',
    authenticated: true,
    roles,
    permissions: [],
  };
}

function CurrentLocation() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderLoginPage(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/login${search}`]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockAuthenticated(roles: UserRole[]) {
  mockUseAuth.mockReturnValue({
    user: createUser(roles),
    error: null,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('navigates an authenticated user to a safe returnUrl', async () => {
    mockAuthenticated(['USER']);

    renderLoginPage(`?returnUrl=${encodeURIComponent('/transactions?view=recent')}`);

    expect(await screen.findByTestId('location')).toHaveTextContent('/transactions?view=recent');
  });

  it.each([
    'https://evil.example/path',
    '//evil.example/path',
    '/\\evil.example/path',
    'javascript:alert(1)',
  ])('falls back to the default path for unsafe returnUrl %s', async (returnUrl) => {
    mockAuthenticated(['USER']);

    renderLoginPage(`?returnUrl=${encodeURIComponent(returnUrl)}`);

    expect(await screen.findByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('falls back to the admin default path for an unsafe returnUrl', async () => {
    mockAuthenticated(['ADMIN']);

    renderLoginPage(`?returnUrl=${encodeURIComponent('//evil.example/path')}`);

    expect(await screen.findByTestId('location')).toHaveTextContent(/^\/admin$/);
  });
});
