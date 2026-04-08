import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/features/auth/hooks/usePermission');

import { usePermission } from '@/features/auth/hooks/usePermission';
import { DeactivateUserPage } from '@/features/admin/users/pages/DeactivateUserPage';

const mockUsePermission = vi.mocked(usePermission);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/users/deactivate']}>
        <Routes>
          <Route path="/admin/users/deactivate" element={<DeactivateUserPage />} />
          <Route path="/unauthorized" element={<div>unauthorized route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DeactivateUserPage', () => {
  beforeEach(() => {
    mockUsePermission.mockReset();
  });

  it('redirects to /unauthorized when users:write is missing', () => {
    mockUsePermission.mockReturnValue(false);
    renderPage();
    expect(screen.getByText('unauthorized route')).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('users:write');
    expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument();
  });

  it('renders the deactivate form when users:write is granted', () => {
    mockUsePermission.mockReturnValue(true);
    renderPage();
    expect(screen.getByLabelText('User ID')).toBeInTheDocument();
    expect(screen.queryByText('unauthorized route')).not.toBeInTheDocument();
  });
});
