import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';

import { UsersListPage } from '@/features/admin/users/pages/UsersListPage';
import { renderWithProviders } from '@/testing/test-utils';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/users" element={<UsersListPage />} />
    </Routes>,
    { initialEntries: ['/admin/users'] },
  );
}

describe('UsersListPage', () => {
  it('renders the users search UI', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /^Users$/ })).toBeInTheDocument();
  });
});
