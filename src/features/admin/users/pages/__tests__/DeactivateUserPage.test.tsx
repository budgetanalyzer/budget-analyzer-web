import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { DeactivateUserPage } from '@/features/admin/users/pages/DeactivateUserPage';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/users/deactivate']}>
        <Routes>
          <Route path="/admin/users/deactivate" element={<DeactivateUserPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DeactivateUserPage', () => {
  it('renders the deactivate form', () => {
    renderPage();
    expect(screen.getByLabelText('User ID')).toBeInTheDocument();
  });
});
