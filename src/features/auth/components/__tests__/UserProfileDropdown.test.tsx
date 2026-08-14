import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';

vi.mock('@/features/auth/hooks/useAuth');

import { useAuth } from '@/features/auth/hooks/useAuth';
import { UserProfileDropdown } from '@/features/auth/components/UserProfileDropdown';
import { renderWithProviders } from '@/testing/test-utils';
import type { User } from '@/types/auth';

const mockUseAuth = vi.mocked(useAuth);

const namedUser: User = {
  sub: 'user-1',
  email: 'pat@example.com',
  name: 'Pat Example',
  picture: 'https://example.com/pat.png',
  authenticated: true,
  roles: ['USER'],
  permissions: ['statementformats:read'],
};

function mockAuth(user: User | null, logout = vi.fn()) {
  mockUseAuth.mockReturnValue({
    user,
    error: null,
    isLoading: false,
    isAuthenticated: user !== null,
    login: vi.fn(),
    logout,
    refetch: vi.fn(),
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe('UserProfileDropdown', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it('renders nothing when there is no current user', () => {
    mockAuth(null);

    const { container } = renderWithProviders(<UserProfileDropdown />, {
      initialEntries: ['/'],
      router: 'dom',
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the current user identity in the opened menu', async () => {
    mockAuth(namedUser);
    const user = userEvent.setup();

    renderWithProviders(<UserProfileDropdown />, { initialEntries: ['/'], router: 'dom' });
    await user.click(screen.getByRole('button', { name: 'Pat Example' }));

    expect(screen.getByText('Pat Example')).toBeInTheDocument();
    expect(screen.getByText('pat@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /statement formats/i })).toBeInTheDocument();
  });

  it('calls logout from the menu affordance', async () => {
    const logout = vi.fn();
    mockAuth(namedUser, logout);
    const user = userEvent.setup();

    renderWithProviders(<UserProfileDropdown />, { initialEntries: ['/'], router: 'dom' });
    await user.click(screen.getByRole('button', { name: 'Pat Example' }));
    await user.click(screen.getByRole('menuitem', { name: /logout/i }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('navigates to statement format preferences from the permitted menu item', async () => {
    mockAuth(namedUser);
    const user = userEvent.setup();

    renderWithProviders(
      <>
        <UserProfileDropdown />
        <LocationProbe />
      </>,
      { initialEntries: ['/'], router: 'dom' },
    );
    await user.click(screen.getByRole('button', { name: 'Pat Example' }));
    await user.click(screen.getByRole('menuitem', { name: /statement formats/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/statement-formats');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('restores trigger focus on Escape and synchronizes outside dismissal', async () => {
    mockAuth(namedUser);
    const user = userEvent.setup();

    renderWithProviders(<UserProfileDropdown />, { initialEntries: ['/'], router: 'dom' });
    const trigger = screen.getByRole('button', { name: 'Pat Example' });

    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /statement formats/i })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('falls back to email identity when optional profile fields are missing', async () => {
    mockAuth({
      sub: 'user-2',
      email: 'fallback@example.com',
      authenticated: true,
      roles: ['USER'],
      permissions: [],
    });
    const user = userEvent.setup();

    renderWithProviders(<UserProfileDropdown />, { initialEntries: ['/'], router: 'dom' });
    await user.click(screen.getByRole('button', { name: 'F' }));

    expect(screen.getByText('fallback@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Pat Example')).not.toBeInTheDocument();
  });

  it('hides the statement formats link when read permission is missing', async () => {
    mockAuth({ ...namedUser, permissions: [] });
    const user = userEvent.setup();

    renderWithProviders(<UserProfileDropdown />, { initialEntries: ['/'], router: 'dom' });
    await user.click(screen.getByRole('button', { name: 'Pat Example' }));

    expect(screen.queryByRole('menuitem', { name: /statement formats/i })).not.toBeInTheDocument();
  });
});
