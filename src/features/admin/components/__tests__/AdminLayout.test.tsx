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

function renderLayout() {
  const store = configureStore({ reducer: { ui: uiReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/admin']}>
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
    expect(screen.getByRole('link', { name: /Transactions/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Deactivate User/ })).toBeInTheDocument();
  });

  it('hides the Transactions nav item when transactions:read:any is missing', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'users:write');
    renderLayout();
    expect(screen.queryByRole('link', { name: /Transactions/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Deactivate User/ })).toBeInTheDocument();
  });

  it('hides the Deactivate User nav item when users:write is missing', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:read:any');
    renderLayout();
    expect(screen.getByRole('link', { name: /Transactions/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Deactivate User/ })).not.toBeInTheDocument();
  });

  it('hides both gated items when no action permissions are granted', () => {
    mockUsePermission.mockReturnValue(false);
    renderLayout();
    expect(screen.queryByRole('link', { name: /Transactions/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Deactivate User/ })).not.toBeInTheDocument();
    // Ungated items still render
    expect(screen.getByRole('link', { name: /Currencies/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Statement Formats/ })).toBeInTheDocument();
  });
});
