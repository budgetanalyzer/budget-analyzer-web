import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router';

vi.mock('@/features/auth/hooks/useAuth');
vi.mock('@/components/CurrencySelector', () => ({
  CurrencySelector: () => <div>currency selector</div>,
}));
vi.mock('@/components/ViewSelector', () => ({
  ViewSelector: () => <div>view selector</div>,
}));
vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div>theme toggle</div>,
}));
vi.mock('@/features/auth/components/UserProfileDropdown', () => ({
  UserProfileDropdown: () => <div>user profile</div>,
}));

import { Layout } from '@/components/Layout';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { renderWithProviders } from '@/testing/test-utils';
import type { User } from '@/types/auth';

const mockUseAuth = vi.mocked(useAuth);

function mockAuthenticatedUser(user: User) {
  mockUseAuth.mockReturnValue({
    user,
    error: null,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
  });
}

describe('Layout', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('renders only authenticated profile chrome and no login affordance', () => {
    mockAuthenticatedUser({
      sub: 'user-1',
      email: 'user@example.com',
      authenticated: true,
      roles: ['USER'],
      permissions: [],
    });

    renderWithProviders(<Layout />, { initialEntries: ['/'] });

    expect(screen.getByText('user profile')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login' })).not.toBeInTheDocument();
  });

  it('retains the authenticated admin redirect to the admin layout', () => {
    mockAuthenticatedUser({
      sub: 'admin-1',
      email: 'admin@example.com',
      authenticated: true,
      roles: ['ADMIN'],
      permissions: [],
    });

    renderWithProviders(
      <Routes>
        <Route path="/" element={<Layout />} />
        <Route path="/admin" element={<div>admin destination</div>} />
      </Routes>,
      { initialEntries: ['/'] },
    );

    expect(screen.getByText('admin destination')).toBeInTheDocument();
    expect(screen.queryByText('user profile')).not.toBeInTheDocument();
  });
});
