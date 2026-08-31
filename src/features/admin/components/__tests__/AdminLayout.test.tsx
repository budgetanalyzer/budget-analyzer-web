import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

vi.mock('@/features/auth/hooks/useAuth');
vi.mock('@/features/auth/hooks/usePermission');

import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';
import { renderWithProviders } from '@/testing/test-utils';

const mockUseAuth = vi.mocked(useAuth);
const mockUsePermission = vi.mocked(usePermission);
const BODY_SCROLL_LOCK_CLASS = 'overflow-hidden';

function renderLayout(initialPath: string = '/admin') {
  return renderWithProviders(<AdminLayout />, {
    initialEntries: [initialPath],
  });
}

function AdminDialogHarness() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);

  return (
    <>
      <button type="button" onClick={handleOpen}>
        Open admin dialog
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Admin dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    </>
  );
}

function renderLayoutWithDialog() {
  return renderWithProviders(
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminDialogHarness />} />
      </Route>
    </Routes>,
    { initialEntries: ['/admin'] },
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
    error: null,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
  });
});

afterEach(() => {
  document.body.classList.remove(BODY_SCROLL_LOCK_CLASS);
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

describe('AdminLayout dialog portal scope', () => {
  it('keeps dialogs opened by an admin route beneath the admin theme scope', async () => {
    const user = userEvent.setup();
    renderLayoutWithDialog();

    await user.click(screen.getByRole('button', { name: 'Open admin dialog' }));

    const adminScope = document.querySelector('.admin');
    expect(screen.getByRole('dialog', { name: 'Admin dialog' }).closest('.admin')).toBe(adminScope);
  });
});

describe('AdminLayout mobile overlay body scroll lock', () => {
  it('uses a static body class and removes it when closed', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open admin menu' }));

    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);
    expect(document.body).not.toHaveAttribute('style');

    await user.click(screen.getByRole('button', { name: 'Open admin menu' }));

    expect(document.body).not.toHaveClass(BODY_SCROLL_LOCK_CLASS);
  });

  it('removes the body class when Escape closes the overlay', async () => {
    const user = userEvent.setup();
    renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open admin menu' }));
    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);

    await user.keyboard('{Escape}');

    expect(document.body).not.toHaveClass(BODY_SCROLL_LOCK_CLASS);
  });

  it('removes the body class when the open overlay unmounts', async () => {
    const user = userEvent.setup();
    const { unmount } = renderLayout();

    await user.click(screen.getByRole('button', { name: 'Open admin menu' }));
    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);

    unmount();

    expect(document.body).not.toHaveClass(BODY_SCROLL_LOCK_CLASS);
  });
});
