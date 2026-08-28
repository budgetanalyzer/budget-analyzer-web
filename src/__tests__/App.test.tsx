import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

const routeMounts = vi.hoisted(() => ({
  dataHook: vi.fn(),
  layout: vi.fn(),
  transactions: vi.fn(),
  views: vi.fn(),
}));

vi.mock('@/features/auth/hooks/useAuth');
vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/features/auth/utils/loginRedirect', () => ({
  replaceWithLogin: vi.fn(),
}));
vi.mock('@/components/SessionHeartbeatProvider', () => ({
  SessionHeartbeatProvider: () => <div data-testid="session-heartbeat-provider" />,
}));
vi.mock('@/components/Layout', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const { Outlet } = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    Layout: () => {
      routeMounts.layout();
      return React.createElement(Outlet);
    },
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
  TransactionsPage: () => {
    routeMounts.transactions();
    routeMounts.dataHook();
    return <div>transactions home</div>;
  },
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
vi.mock('@/features/views/pages/ViewsPage', () => ({
  ViewsPage: () => {
    routeMounts.views();
    return 'views page';
  },
}));
vi.mock('@/features/views/pages/ViewPage', () => ({
  ViewPage: () => {
    routeMounts.views();
    return 'view detail page';
  },
}));
vi.mock('@/features/admin/components/UnauthorizedPage', () => ({
  UnauthorizedPage: () => 'unauthorized route',
}));

import App from '@/App';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { replaceWithLogin } from '@/features/auth/utils/loginRedirect';
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
    error: null,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
  });
}

function mockRegularAuth() {
  mockUseAuth.mockReturnValue({
    user: regularUser,
    error: null,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
  });
}

describe('App route authorization', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUsePermission.mockReset();
    vi.mocked(replaceWithLogin).mockReset();
    routeMounts.dataHook.mockReset();
    routeMounts.layout.mockReset();
    routeMounts.transactions.mockReset();
    routeMounts.views.mockReset();
    mockAdminAuth();
  });

  it('renders an admin read route only when its permission is granted', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'currencies:read');

    renderApp('/admin/currencies');

    expect(await screen.findByText('currencies list page')).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('currencies:read');
  });

  it('places session status before the authenticated route tree', async () => {
    mockRegularAuth();

    renderApp('/');

    const sessionStatus = screen.getByTestId('session-heartbeat-provider');
    const routeContent = await screen.findByText('transactions home');

    expect(sessionStatus.compareDocumentPosition(routeContent)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
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
    mockRegularAuth();
    mockUsePermission.mockImplementation((permission) => permission === 'statementformats:read');

    renderApp('/statement-formats');

    expect(await screen.findByText('statement format management page')).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('statementformats:read');
  });

  it.each(['/views', '/views/view-1'])(
    'gates saved-view route %s with views:read',
    async (path) => {
      mockRegularAuth();
      mockUsePermission.mockImplementation((permission) => permission === 'views:read');

      renderApp(path);

      expect(
        await screen.findByText(path === '/views' ? 'views page' : 'view detail page'),
      ).toBeInTheDocument();
      expect(mockUsePermission).toHaveBeenCalledWith('views:read');
      expect(routeMounts.views).toHaveBeenCalledOnce();
    },
  );

  it('does not mount a denied saved-view route', async () => {
    mockRegularAuth();
    mockUsePermission.mockReturnValue(false);

    renderApp('/views/view-1');

    expect(await screen.findByText('unauthorized route')).toBeInTheDocument();
    expect(routeMounts.views).not.toHaveBeenCalled();
  });

  it('keeps non-admin authenticated users out of the admin route tree', async () => {
    mockUseAuth.mockReturnValue({
      user: regularUser,
      error: null,
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      refetch: vi.fn(),
    });
    mockUsePermission.mockReturnValue(true);

    renderApp('/admin/currencies');

    expect(await screen.findByText('transactions home')).toBeInTheDocument();
    expect(screen.queryByText('currencies list page')).not.toBeInTheDocument();
  });

  it('keeps public login reachable while authentication bootstrap is pending', () => {
    mockUseAuth.mockReturnValue({
      user: undefined,
      error: null,
      isLoading: true,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    renderApp('/login');

    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(routeMounts.layout).not.toHaveBeenCalled();
    expect(routeMounts.transactions).not.toHaveBeenCalled();
    expect(routeMounts.dataHook).not.toHaveBeenCalled();
  });

  it('does not mount the protected layout or page before authentication succeeds', () => {
    mockUseAuth.mockReturnValue({
      user: undefined,
      error: null,
      isLoading: true,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    renderApp('/');

    expect(screen.getByRole('status', { name: 'Checking authentication' })).toBeInTheDocument();
    expect(routeMounts.layout).not.toHaveBeenCalled();
    expect(routeMounts.transactions).not.toHaveBeenCalled();
    expect(routeMounts.dataHook).not.toHaveBeenCalled();
    expect(mockUsePermission).not.toHaveBeenCalled();
  });

  it('does not mount protected routes when bootstrap fails', () => {
    mockUseAuth.mockReturnValue({
      user: undefined,
      error: new Error('Network unavailable'),
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    renderApp('/admin');

    expect(screen.getByRole('alert')).toHaveTextContent('Authentication unavailable');
    expect(routeMounts.layout).not.toHaveBeenCalled();
    expect(mockUsePermission).not.toHaveBeenCalled();
    expect(replaceWithLogin).not.toHaveBeenCalled();
  });

  it.each(['/', '/analytics', '/transactions/42', '/admin'])(
    'redirects anonymous access to protected route %s without mounting protected children',
    (path) => {
      mockUseAuth.mockReturnValue({
        user: null,
        error: null,
        isLoading: false,
        isAuthenticated: false,
        login: vi.fn(),
        logout: vi.fn(),
        refetch: vi.fn(),
      });

      renderApp(path);

      expect(replaceWithLogin).toHaveBeenCalledTimes(1);
      expect(replaceWithLogin).toHaveBeenCalledWith(path);
      expect(routeMounts.layout).not.toHaveBeenCalled();
      expect(routeMounts.transactions).not.toHaveBeenCalled();
      expect(routeMounts.dataHook).not.toHaveBeenCalled();
      expect(mockUsePermission).not.toHaveBeenCalled();
    },
  );
});
