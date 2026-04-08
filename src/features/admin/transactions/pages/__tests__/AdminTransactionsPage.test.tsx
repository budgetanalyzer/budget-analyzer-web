import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/features/auth/hooks/usePermission');

import { usePermission } from '@/features/auth/hooks/usePermission';
import { AdminTransactionsPage } from '@/features/admin/transactions/pages/AdminTransactionsPage';

const mockUsePermission = vi.mocked(usePermission);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/transactions']}>
        <Routes>
          <Route path="/admin/transactions" element={<AdminTransactionsPage />} />
          <Route path="/unauthorized" element={<div>unauthorized route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminTransactionsPage', () => {
  beforeEach(() => {
    mockUsePermission.mockReset();
  });

  it('redirects to /unauthorized when transactions:read:any is missing', () => {
    mockUsePermission.mockReturnValue(false);
    renderPage();
    expect(screen.getByText('unauthorized route')).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('transactions:read:any');
    expect(screen.queryByRole('heading', { name: /^Transactions$/ })).not.toBeInTheDocument();
  });

  it('renders the transactions search UI when transactions:read:any is granted', () => {
    mockUsePermission.mockReturnValue(true);
    renderPage();
    expect(screen.getByRole('heading', { name: /^Transactions$/ })).toBeInTheDocument();
    expect(screen.queryByText('unauthorized route')).not.toBeInTheDocument();
  });
});
