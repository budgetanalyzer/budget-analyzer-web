import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionHeartbeatProvider } from '@/components/SessionHeartbeatProvider';

vi.mock('@/features/auth/hooks/useAuth');
vi.mock('@/hooks/useSessionHeartbeat');

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSessionHeartbeat } from '@/hooks/useSessionHeartbeat';

const mockUseAuth = vi.mocked(useAuth);
const mockUseSessionHeartbeat = vi.mocked(useSessionHeartbeat);

describe('SessionHeartbeatProvider', () => {
  it('does not activate heartbeat when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      error: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refetch: vi.fn(),
    });
    mockUseSessionHeartbeat.mockReturnValue({
      showWarning: true,
      isSending: false,
      sendHeartbeat: vi.fn(),
      expiresAt: null,
      connectionWarning: 'Unable to reach the server. Your session may expire.',
      dismissConnectionWarning: vi.fn(),
    });

    render(<SessionHeartbeatProvider />);

    expect(mockUseSessionHeartbeat).toHaveBeenCalledWith({ enabled: false });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('Session Expiring')).not.toBeInTheDocument();
  });

  it('activates heartbeat when user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: {
        sub: 'user-1',
        email: 'test@example.com',
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
    mockUseSessionHeartbeat.mockReturnValue({
      showWarning: false,
      isSending: false,
      sendHeartbeat: vi.fn(),
      expiresAt: null,
      connectionWarning: null,
      dismissConnectionWarning: vi.fn(),
    });

    render(<SessionHeartbeatProvider />);

    expect(mockUseSessionHeartbeat).toHaveBeenCalledWith({ enabled: true });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders an accessible connection warning with a dismiss control', async () => {
    const dismissConnectionWarning = vi.fn();
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: {
        sub: 'user-1',
        email: 'test@example.com',
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
    mockUseSessionHeartbeat.mockReturnValue({
      showWarning: false,
      isSending: false,
      sendHeartbeat: vi.fn(),
      expiresAt: null,
      connectionWarning: 'Unable to reach the server. Your session may expire.',
      dismissConnectionWarning,
    });

    render(<SessionHeartbeatProvider />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Unable to reach the server. Your session may expire.',
    );
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(dismissConnectionWarning).toHaveBeenCalledOnce();
  });

  it('renders InactivityWarningModal when showWarning is true', () => {
    mockUseAuth.mockReturnValue({
      user: {
        sub: 'user-1',
        email: 'test@example.com',
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
    mockUseSessionHeartbeat.mockReturnValue({
      showWarning: true,
      isSending: false,
      sendHeartbeat: vi.fn(),
      expiresAt: null,
      connectionWarning: null,
      dismissConnectionWarning: vi.fn(),
    });

    render(<SessionHeartbeatProvider />);

    expect(screen.getByText('Session Expiring')).toBeInTheDocument();
  });
});
