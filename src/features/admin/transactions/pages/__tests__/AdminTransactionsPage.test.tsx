import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AdminTransactionsPage } from '@/features/admin/transactions/pages/AdminTransactionsPage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/transactions']}>
        <Routes>
          <Route path="/admin/transactions" element={<AdminTransactionsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminTransactionsPage', () => {
  it('renders the transactions search UI', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /^Transactions$/ })).toBeInTheDocument();
  });
});
