import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { http, HttpResponse } from 'msw';

import { UserDetailPage } from '@/features/admin/users/pages/UserDetailPage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function getDialogBackdrop() {
  const backdrop = screen.getByRole('dialog').previousElementSibling;
  if (!backdrop) throw new Error('Expected a dialog backdrop');
  return backdrop;
}

function createPartialUser(isDeactivated: boolean) {
  return {
    id: 'usr_partial',
    idpSub: 'auth0|partial',
    email: 'partial@example.com',
    displayName: 'Partial User',
    status: isDeactivated ? 'DEACTIVATED' : 'ACTIVE',
    roleIds: isDeactivated ? [] : ['USER'],
    createdAt: '2026-04-01T12:00:00Z',
    updatedAt: '2026-04-09T12:00:00Z',
    ...(isDeactivated
      ? {
          deactivatedAt: '2026-04-09T12:00:00Z',
          deactivatedBy: {
            id: 'usr_abc123',
            displayName: 'Admin User',
            email: 'admin@example.com',
          },
        }
      : {}),
  };
}

function renderPage(initialPath: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/users/:id" element={<UserDetailPage />} />
    </Routes>,
    { initialEntries: [initialPath] },
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

  it('hides the deactivate action when users:write is missing', async () => {
    server.use(
      http.get('/auth/v1/user', () =>
        HttpResponse.json({
          sub: 'mock-user-id',
          email: 'readonly-admin@example.com',
          name: 'Readonly Admin',
          authenticated: true,
          roles: ['ADMIN'],
          permissions: ['users:read'],
        }),
      ),
    );

    renderPage('/admin/users/usr_abc123');

    expect(await screen.findByRole('heading', { name: 'Admin User' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate User' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry session revocation' }),
    ).not.toBeInTheDocument();
  });

  it('renders the deactivation section for a deactivated user', async () => {
    renderPage('/admin/users/usr_deactivated');

    expect(await screen.findByRole('heading', { name: 'Former User' })).toBeInTheDocument();
    expect(screen.getByText('Deactivation')).toBeInTheDocument();
    expect(screen.getByText('Deactivated By')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText(/usr_abc123/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate User' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry session revocation' }),
    ).not.toBeInTheDocument();
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

  it('deactivates an active user and reflects the result in the detail page', async () => {
    renderPage('/admin/users/usr_abc123');

    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate User' }));

    expect(screen.getByRole('heading', { name: 'Deactivate Admin User?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate Account' }));

    expect(await screen.findByText('Deactivation')).toBeInTheDocument();
    expect(screen.getAllByText('DEACTIVATED')).toHaveLength(2);
    expect(screen.getByText('Deactivated At')).toBeInTheDocument();
    expect(screen.getByText('Deactivated By')).toBeInTheDocument();
    expect(screen.queryByText('User usr_abc123 deactivated successfully.')).not.toBeInTheDocument();
    expect(screen.queryByText('Session revocation completed.')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Deactivate Admin User?' }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Deactivate User' })).not.toBeInTheDocument();
    });
  });

  it('blocks dialog dismissal while deactivation is pending and closes after success', async () => {
    const user = userEvent.setup();
    const response = createDeferredPromise();
    server.use(
      http.post('/api/v1/users/:id/deactivate', async () => {
        await response.promise;
        return HttpResponse.json({
          userId: 'usr_abc123',
          status: 'DEACTIVATED',
          rolesRemoved: 1,
          sessionsRevoked: true,
        });
      }),
    );

    renderPage('/admin/users/usr_abc123');

    await user.click(await screen.findByRole('button', { name: 'Deactivate User' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate Account' }));

    const dialog = screen.getByRole('dialog', { name: 'Deactivate Admin User?' });
    expect(within(dialog).getByRole('button', { name: 'Deactivating...' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();

    await user.click(getDialogBackdrop());
    await user.keyboard('{Escape}');

    expect(screen.getByRole('dialog', { name: 'Deactivate Admin User?' })).toBeInTheDocument();

    response.resolve();

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Deactivate Admin User?' }),
      ).not.toBeInTheDocument();
    });
  });

  it('shows a dismissible error without a retry action when deactivation fails', async () => {
    const user = userEvent.setup();
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

    await user.click(await screen.findByRole('button', { name: 'Deactivate User' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate Account' }));

    expect(await screen.findByText('User deactivation failed')).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Deactivate Admin User?' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate User' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry session revocation' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    await waitFor(() => {
      expect(screen.queryByText('User deactivation failed')).not.toBeInTheDocument();
    });
  });

  it('offers a partial-deactivation retry only in the dismissible error banner', async () => {
    const user = userEvent.setup();
    let isDeactivated = false;

    server.use(
      http.get('/api/v1/users/:id', () => HttpResponse.json(createPartialUser(isDeactivated))),
      http.post('/api/v1/users/:id/deactivate', () => {
        isDeactivated = true;
        return HttpResponse.json(
          {
            type: 'SERVICE_UNAVAILABLE',
            message: 'Backend-specific session revocation failure',
          },
          { status: 503 },
        );
      }),
    );

    renderPage('/admin/users/usr_partial');

    await user.click(await screen.findByRole('button', { name: 'Deactivate User' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate Account' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Session revocation could not be confirmed. It is safe to retry.',
    );
    expect(await screen.findByText('Deactivation')).toBeInTheDocument();
    expect(screen.getAllByText('DEACTIVATED')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Deactivate User' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Deactivate Partial User?' }),
    ).not.toBeInTheDocument();

    const retryAction = screen.getByRole('button', { name: 'Retry session revocation' });
    expect(alert.parentElement).toContainElement(retryAction);

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Retry session revocation' }),
      ).not.toBeInTheDocument();
    });
  });

  it('retries the current user manually, remains actionable after 503, and reports success', async () => {
    const user = userEvent.setup();
    const repeatedFailure = createDeferredPromise();
    const requestedUserIds: string[] = [];
    let isDeactivated = false;

    server.use(
      http.get('/api/v1/users/:id', () => HttpResponse.json(createPartialUser(isDeactivated))),
      http.post('/api/v1/users/:id/deactivate', async ({ params }) => {
        requestedUserIds.push(String(params.id));
        isDeactivated = true;

        if (requestedUserIds.length === 2) {
          await repeatedFailure.promise;
        }

        if (requestedUserIds.length < 3) {
          return HttpResponse.json(
            {
              type: 'SERVICE_UNAVAILABLE',
              message: 'Session revocation unavailable',
            },
            { status: 503 },
          );
        }

        return HttpResponse.json({
          userId: String(params.id),
          status: 'DEACTIVATED',
          rolesRemoved: 0,
          sessionsRevoked: true,
        });
      }),
    );

    renderPage('/admin/users/usr_partial');

    await user.click(await screen.findByRole('button', { name: 'Deactivate User' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate Account' }));

    await user.click(await screen.findByRole('button', { name: 'Retry session revocation' }));

    await waitFor(() => {
      expect(requestedUserIds).toEqual(['usr_partial', 'usr_partial']);
      expect(
        screen.queryByRole('button', { name: 'Retry session revocation' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Session revocation could not be confirmed. It is safe to retry.',
    );

    repeatedFailure.resolve();

    await user.click(await screen.findByRole('button', { name: 'Retry session revocation' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Session revocation completed.');
    expect(requestedUserIds).toEqual(['usr_partial', 'usr_partial', 'usr_partial']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry session revocation' }),
    ).not.toBeInTheDocument();
  });
});
