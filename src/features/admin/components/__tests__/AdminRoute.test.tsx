import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('@/features/auth/hooks/useAuth');

import { useAuth } from '@/features/auth/hooks/useAuth';
import { AdminRoute } from '@/features/admin/components/AdminRoute';
import type { User } from '@/types/auth';

const mockUseAuth = vi.mocked(useAuth);

const adminUser: User = {
  sub: 'admin-1',
  email: 'admin@example.com',
  authenticated: true,
  roles: ['ADMIN'],
  permissions: [],
};

const user: User = {
  sub: 'user-1',
  email: 'user@example.com',
  authenticated: true,
  roles: ['USER'],
  permissions: [],
};

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div>home page</div>} />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/admin" element={<AdminRoute />}>
          <Route index element={<div>admin content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('renders child routes for authenticated admins', () => {
    mockUseAuth.mockReturnValue({
      user: adminUser,
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderAdminRoute();

    expect(screen.getByText('admin content')).toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderAdminRoute();

    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('redirects authenticated non-admin users to the home route', () => {
    mockUseAuth.mockReturnValue({
      user,
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });

    renderAdminRoute();

    expect(screen.getByText('home page')).toBeInTheDocument();
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
  });

  it('shows the admin loading skeleton while auth state is loading', () => {
    const { container } = renderAdminRouteWithAuth({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    expect(container.querySelector('aside')).toBeInTheDocument();
    expect(container.querySelector('main')).toBeInTheDocument();
    expect(screen.queryByText('admin content')).not.toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
});

function renderAdminRouteWithAuth(authState: ReturnType<typeof useAuth>) {
  mockUseAuth.mockReturnValue(authState);
  return renderAdminRoute();
}
