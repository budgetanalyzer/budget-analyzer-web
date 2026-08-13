import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('@/features/auth/hooks/useAuth');

import { AuthenticatedRoute } from '@/features/auth/components/AuthenticatedRoute';
import { useAuth } from '@/features/auth/hooks/useAuth';
import type { User } from '@/types/auth';

const mockUseAuth = vi.mocked(useAuth);
const replace = vi.fn();
const authenticatedUser: User = {
  sub: 'user-1',
  email: 'user@example.com',
  authenticated: true,
  roles: ['USER'],
  permissions: [],
};

function renderRoute(child = <div>protected content</div>, strict = false) {
  const routes = (
    <MemoryRouter initialEntries={['/transactions/42?returnTo=%2Fviews%2F1&mode=full#details']}>
      <Routes>
        <Route element={<AuthenticatedRoute />}>
          <Route path="/transactions/:id" element={child} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

  return render(strict ? <StrictMode>{routes}</StrictMode> : routes);
}

describe('AuthenticatedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    replace.mockReset();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        origin: 'https://app.budgetanalyzer.localhost',
        replace,
      },
      writable: true,
    });
  });

  it('renders the protected outlet only for an authenticated user', () => {
    mockUseAuth.mockReturnValue({
      user: authenticatedUser,
      error: null,
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    renderRoute();

    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('shows a neutral loading state without mounting protected children while pending', () => {
    const childRender = vi.fn();
    function ProtectedChild() {
      childRender();
      return <div>protected content</div>;
    }
    mockUseAuth.mockReturnValue({
      user: undefined,
      error: null,
      isLoading: true,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    renderRoute(<ProtectedChild />);

    expect(screen.getByRole('status', { name: 'Checking authentication' })).toBeInTheDocument();
    expect(childRender).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('preserves a deep link and suppresses duplicate Strict Mode redirects for an anonymous user', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      error: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refetch: vi.fn(),
    });

    renderRoute(<div>protected content</div>, true);

    expect(screen.getByRole('status', { name: 'Checking authentication' })).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      `/oauth2/authorization/idp?returnUrl=${encodeURIComponent(
        '/transactions/42?returnTo=%2Fviews%2F1&mode=full#details',
      )}`,
    );
  });

  it('shows an availability error and retries without starting OAuth', async () => {
    const refetch = vi.fn();
    mockUseAuth.mockReturnValue({
      user: undefined,
      error: new Error('Service unavailable'),
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refetch,
    });
    const user = userEvent.setup();

    renderRoute();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Authentication unavailable');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });
});
