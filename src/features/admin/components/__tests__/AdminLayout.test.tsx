import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { configureStore } from '@reduxjs/toolkit';

vi.mock('@/features/auth/hooks/useAuth');
vi.mock('@/features/auth/hooks/usePermission');

import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import uiReducer from '@/store/uiSlice';

const mockUseAuth = vi.mocked(useAuth);
const mockUsePermission = vi.mocked(usePermission);

function renderLayout(initialPath: string = '/admin') {
  const store = configureStore({ reducer: { ui: uiReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <AdminLayout />
      </MemoryRouter>
    </Provider>,
  );
}

beforeEach(() => {
  mockUsePermission.mockReset();
  mockUseAuth.mockReturnValue({
    user: {
      sub: 'user-1',
      email: 'admin@example.com',
      authenticated: true,
      roles: ['ADMIN'],
      permissions: [],
    },
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  });
});

describe('AdminLayout nav gating', () => {
  it('shows all gated nav items when the user has every permission', () => {
    mockUsePermission.mockReturnValue(true);
    renderLayout();
    expect(screen.getByRole('link', { name: /Currencies/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Statement Formats/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Transactions/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Users/ })).toBeInTheDocument();
  });

  it('hides the Currencies nav item when currencies:read is missing', () => {
    mockUsePermission.mockImplementation((permission) => permission !== 'currencies:read');
    renderLayout();
    expect(screen.queryByRole('link', { name: /Currencies/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Statement Formats/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Transactions/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Users/ })).toBeInTheDocument();
  });

  it('hides the Statement Formats nav item when statementformats:read is missing', () => {
    mockUsePermission.mockImplementation((permission) => permission !== 'statementformats:read');
    renderLayout();
    expect(screen.getByRole('link', { name: /Currencies/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Statement Formats/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Transactions/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Users/ })).toBeInTheDocument();
  });

  it('hides the Transactions nav item when transactions:read:any is missing', () => {
    mockUsePermission.mockImplementation((permission) => permission !== 'transactions:read:any');
    renderLayout();
    expect(screen.queryByRole('link', { name: /Transactions/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Users/ })).toBeInTheDocument();
  });

  it('hides the Users nav item when users:read is missing', () => {
    mockUsePermission.mockImplementation((permission) => permission !== 'users:read');
    renderLayout();
    expect(screen.getByRole('link', { name: /Transactions/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Users/ })).not.toBeInTheDocument();
  });

  it('hides every gated item when no permissions are granted', () => {
    mockUsePermission.mockReturnValue(false);
    renderLayout();
    expect(screen.queryByRole('link', { name: /Currencies/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Statement Formats/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Transactions/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Users/ })).not.toBeInTheDocument();
    // Ungated Dashboard link still renders.
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
  });
});

describe('AdminLayout nav active state', () => {
  it('highlights the Users nav link when viewing a nested user detail path', () => {
    mockUsePermission.mockReturnValue(true);
    renderLayout('/admin/users/usr_abc123');
    const usersLink = screen.getByRole('link', { name: /Users/ });
    expect(usersLink.className).toContain('bg-primary/10');
    expect(usersLink.className).toContain('text-primary');
  });
});
