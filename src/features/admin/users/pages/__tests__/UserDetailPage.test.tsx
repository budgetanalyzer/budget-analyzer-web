import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';

import { UserDetailPage } from '@/features/admin/users/pages/UserDetailPage';
import { server } from '@/mocks/server';
import uiReducer from '@/store/uiSlice';

function renderPage(initialPath: string) {
  const store = configureStore({ reducer: { ui: uiReducer } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/admin/users/:id" element={<UserDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe('UserDetailPage', () => {
  it('renders the active user detail after loading', async () => {
    renderPage('/admin/users/usr_abc123');

    expect(await screen.findByRole('heading', { name: 'Admin User' })).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
    expect(await screen.findByRole('button', { name: 'Deactivate User' })).toBeInTheDocument();
  });

  it('renders the deactivation section for a deactivated user', async () => {
    renderPage('/admin/users/usr_deactivated');

    expect(await screen.findByRole('heading', { name: 'Former User' })).toBeInTheDocument();
    expect(screen.getByText('Deactivation')).toBeInTheDocument();
    expect(screen.getByText('Deactivated By')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText(/usr_abc123/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate User' })).not.toBeInTheDocument();
  });

  it('renders a placeholder when the backend omits updatedAt', async () => {
    server.use(
      http.get('/api/v1/users/:id', () =>
        HttpResponse.json({
          id: 'usr_missing_updated',
          idpSub: 'auth0|missing-updated',
          email: 'missing.updated@example.com',
          displayName: 'Missing Updated',
          status: 'ACTIVE',
          roleIds: [],
          createdAt: '2026-04-01T12:00:00Z',
        }),
      ),
    );

    renderPage('/admin/users/usr_missing_updated');

    expect(await screen.findByRole('heading', { name: 'Missing Updated' })).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('deactivates an active user from the detail page and shows inline success feedback', async () => {
    renderPage('/admin/users/usr_abc123');

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate User' }));

    expect(screen.getByRole('heading', { name: 'Deactivate Admin User?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Account' }));

    expect(
      await screen.findByText('User usr_abc123 deactivated successfully.'),
    ).toBeInTheDocument();
    expect(await screen.findByText('Deactivation')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Deactivate User' })).not.toBeInTheDocument();
    });
  });

  it('shows an inline error banner when deactivation fails', async () => {
    server.use(
      http.post('/api/v1/users/:id/deactivate', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            message: 'User deactivation failed',
          },
          { status: 500 },
        ),
      ),
    );

    renderPage('/admin/users/usr_abc123');

    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate User' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Account' }));

    expect(await screen.findByText('User deactivation failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate User' })).toBeInTheDocument();
  });
});
