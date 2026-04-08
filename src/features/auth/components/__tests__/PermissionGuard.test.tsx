import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

vi.mock('@/features/auth/hooks/usePermission');

import { usePermission } from '@/features/auth/hooks/usePermission';
import { PermissionGuard } from '@/features/auth/components/PermissionGuard';

const mockUsePermission = vi.mocked(usePermission);

function renderGuard(ui: React.ReactNode, initialEntry = '/guarded') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/guarded" element={ui} />
        <Route path="/unauthorized" element={<div>unauthorized route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PermissionGuard', () => {
  beforeEach(() => {
    mockUsePermission.mockReset();
  });

  it('renders children when the permission is granted', () => {
    mockUsePermission.mockReturnValue(true);
    renderGuard(
      <PermissionGuard permission="currencies:read">
        <div>guarded content</div>
      </PermissionGuard>,
    );
    expect(screen.getByText('guarded content')).toBeInTheDocument();
    expect(screen.queryByText('unauthorized route')).not.toBeInTheDocument();
  });

  it('redirects to /unauthorized when denied and no fallback is provided', () => {
    mockUsePermission.mockReturnValue(false);
    renderGuard(
      <PermissionGuard permission="currencies:read">
        <div>guarded content</div>
      </PermissionGuard>,
    );
    expect(screen.getByText('unauthorized route')).toBeInTheDocument();
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument();
  });

  it('renders nothing when denied and fallback is null', () => {
    mockUsePermission.mockReturnValue(false);
    renderGuard(
      <PermissionGuard permission="currencies:read" fallback={null}>
        <div>guarded content</div>
      </PermissionGuard>,
    );
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument();
    expect(screen.queryByText('unauthorized route')).not.toBeInTheDocument();
  });

  it('renders a custom fallback when denied', () => {
    mockUsePermission.mockReturnValue(false);
    renderGuard(
      <PermissionGuard permission="currencies:read" fallback={<div>access denied</div>}>
        <div>guarded content</div>
      </PermissionGuard>,
    );
    expect(screen.getByText('access denied')).toBeInTheDocument();
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument();
    expect(screen.queryByText('unauthorized route')).not.toBeInTheDocument();
  });

  it('delegates to usePermission with the exact permission string', () => {
    mockUsePermission.mockReturnValue(true);
    renderGuard(
      <PermissionGuard permission="statementformats:write">
        <div>guarded content</div>
      </PermissionGuard>,
    );
    expect(mockUsePermission).toHaveBeenCalledWith('statementformats:write');
  });

  it('does not mount children when denied (no side effects from children)', () => {
    mockUsePermission.mockReturnValue(false);
    const childSpy = vi.fn();
    function Spy() {
      childSpy();
      return <div>guarded content</div>;
    }
    renderGuard(
      <PermissionGuard permission="currencies:read" fallback={null}>
        <Spy />
      </PermissionGuard>,
    );
    expect(childSpy).not.toHaveBeenCalled();
  });
});
