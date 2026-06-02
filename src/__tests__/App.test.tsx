import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('@/features/auth/hooks/useAuth');
vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/components/SessionHeartbeatProvider', () => ({
  SessionHeartbeatProvider: () => null,
}));
vi.mock('@/components/ui/Toaster', () => ({
  Toaster: () => null,
}));
vi.mock('@/components/Layout', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const { Outlet } = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    Layout: () => React.createElement(Outlet),
  };
});
vi.mock('@/features/admin/components/AdminLayout', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const { Outlet } = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    AdminLayout: () => React.createElement(Outlet),
  };
});
vi.mock('@/features/transactions/pages/TransactionsPage', () => ({
  TransactionsPage: () => 'transactions home',
}));
vi.mock('@/features/auth/pages/LoginPage', () => ({
  LoginPage: () => 'login page',
}));
vi.mock('@/features/admin/currencies/pages/CurrenciesListPage', () => ({
  CurrenciesListPage: () => 'currencies list page',
}));
vi.mock('@/features/admin/currencies/pages/CurrencyCreatePage', () => ({
  CurrencyCreatePage: () => 'currency create page',
}));
vi.mock('@/features/admin/transactions/pages/AdminTransactionsPage', () => ({
  AdminTransactionsPage: () => 'admin transactions page',
}));
vi.mock('@/features/statement-formats/pages/StatementFormatManagementPage', () => ({
  StatementFormatManagementPage: () => 'statement format management page',
}));
vi.mock('@/features/admin/components/UnauthorizedPage', () => ({
  UnauthorizedPage: () => 'unauthorized route',
}));

import App from '@/App';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { renderWithProviders } from '@/testing/test-utils';
import type { User } from '@/types/auth';

const mockUseAuth = vi.mocked(useAuth);
const mockUsePermission = vi.mocked(usePermission);

const adminUser: User = {
  sub: 'admin-1',
  email: 'admin@example.com',
  authenticated: true,
  roles: ['ADMIN'],
  permissions: [],
};

const regularUser: User = {
  sub: 'user-1',
  email: 'user@example.com',
  authenticated: true,
  roles: ['USER'],
  permissions: [],
};

function renderApp(path: string) {
  return renderWithProviders(<App />, {
    initialEntries: [path],
  });
}

function mockAdminAuth() {
  mockUseAuth.mockReturnValue({
    user: adminUser,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  });
}

describe('App route authorization', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUsePermission.mockReset();
    mockAdminAuth();
  });

  it('renders an admin read route only when its permission is granted', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'currencies:read');

    renderApp('/admin/currencies');

    expect(await screen.findByText('currencies list page')).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('currencies:read');
  });

  it('redirects denied admin routes to the unauthorized page', async () => {
    mockUsePermission.mockReturnValue(false);

    renderApp('/admin/currencies');

    expect(await screen.findByText('unauthorized route')).toBeInTheDocument();
    expect(screen.queryByText('currencies list page')).not.toBeInTheDocument();
  });

  it('uses the write permission for the admin currency create route', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'currencies:write');

    renderApp('/admin/currencies/new');

    expect(await screen.findByText('currency create page')).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('currencies:write');
  });

  it('uses the cross-user transaction read permission for admin transaction search', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:read:any');

    renderApp('/admin/transactions');

    expect(await screen.findByText('admin transactions page')).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('transactions:read:any');
  });

  it('uses the read permission for the user statement format management route', async () => {
    mockUseAuth.mockReturnValue({
      user: regularUser,
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUsePermission.mockImplementation((permission) => permission === 'statementformats:read');

    renderApp('/statement-formats');

    expect(await screen.findByText('statement format management page')).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('statementformats:read');
  });

  it('keeps non-admin authenticated users out of the admin route tree', async () => {
    mockUseAuth.mockReturnValue({
      user: regularUser,
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUsePermission.mockReturnValue(true);

    renderApp('/admin/currencies');

    expect(await screen.findByText('transactions home')).toBeInTheDocument();
    expect(screen.queryByText('currencies list page')).not.toBeInTheDocument();
  });
});
