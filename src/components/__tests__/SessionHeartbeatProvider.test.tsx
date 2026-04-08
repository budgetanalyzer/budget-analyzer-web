import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseSessionHeartbeat.mockReturnValue({
      showWarning: false,
      isSending: false,
      sendHeartbeat: vi.fn(),
      expiresAt: null,
    });

    render(<SessionHeartbeatProvider />);

    expect(mockUseSessionHeartbeat).toHaveBeenCalledWith({ enabled: false });
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
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseSessionHeartbeat.mockReturnValue({
      showWarning: false,
      isSending: false,
      sendHeartbeat: vi.fn(),
      expiresAt: null,
    });

    render(<SessionHeartbeatProvider />);

    expect(mockUseSessionHeartbeat).toHaveBeenCalledWith({ enabled: true });
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
      isLoading: false,
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    });
    mockUseSessionHeartbeat.mockReturnValue({
      showWarning: true,
      isSending: false,
      sendHeartbeat: vi.fn(),
      expiresAt: null,
    });

    render(<SessionHeartbeatProvider />);

    expect(screen.getByText('Session Expiring')).toBeInTheDocument();
  });
});
