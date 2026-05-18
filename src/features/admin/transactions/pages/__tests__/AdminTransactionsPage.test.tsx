import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';

import { AdminTransactionsPage } from '@/features/admin/transactions/pages/AdminTransactionsPage';
import { renderWithProviders } from '@/testing/test-utils';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/transactions" element={<AdminTransactionsPage />} />
    </Routes>,
    { initialEntries: ['/admin/transactions'] },
  );
}

describe('AdminTransactionsPage', () => {
  it('renders the transactions search UI', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /^Transactions$/ })).toBeInTheDocument();
  });
});
