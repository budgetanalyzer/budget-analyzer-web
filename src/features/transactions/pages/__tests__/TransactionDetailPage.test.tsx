import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { TransactionDetailPage } from '@/features/transactions/pages/TransactionDetailPage';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient, renderWithProviders } from '@/testing/test-utils';
import type { Transaction } from '@/types/transaction';
import type { User } from '@/types/auth';

const transaction: Transaction = {
  id: 42,
  accountId: 'checking-123',
  bankName: 'Acme Bank',
  date: '2026-05-01',
  currencyIsoCode: 'USD',
  amount: 42.5,
  type: 'DEBIT',
  description: 'Coffee shop',
  createdAt: '2026-05-01T12:00:00Z',
  updatedAt: '2026-05-01T12:00:00Z',
};

const authenticatedUser: User = {
  sub: 'user-123',
  email: 'user@example.com',
  name: 'Test User',
  authenticated: true,
  roles: [],
  permissions: ['transactions:read', 'transactions:write', 'transactions:delete'],
};

function useDetailReferenceHandlers() {
  server.use(
    http.get('/api/v1/transactions', () => HttpResponse.json([transaction])),
    http.get('/api/v1/currencies', () => HttpResponse.json([])),
  );
}

function renderDetailPage(permissions = authenticatedUser.permissions, displayCurrency = 'USD') {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData<User | null>(['auth', 'currentUser'], {
    ...authenticatedUser,
    permissions,
  });

  return renderWithProviders(
    <Routes>
      <Route path="/" element={<h1>Transaction List</h1>} />
      <Route path="/transactions/:id" element={<TransactionDetailPage />} />
    </Routes>,
    {
      initialEntries: ['/transactions/42'],
      queryClient,
      preloadedState: {
        ui: { theme: 'light', displayCurrency, adminSidebarOpen: true },
      },
    },
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('TransactionDetailPage', () => {
  it('renders the loading state while transaction details are fetched', () => {
    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions/:id', async () => {
        await delay(150);
        return HttpResponse.json(transaction);
      }),
    );

    renderDetailPage();

    expect(screen.getByText('Loading transaction details...')).toBeInTheDocument();
  });

  it('renders transaction details after a successful load', async () => {
    useDetailReferenceHandlers();
    server.use(http.get('/api/v1/transactions/:id', () => HttpResponse.json(transaction)));

    renderDetailPage();

    expect(await screen.findByRole('heading', { name: 'Transaction Details' })).toBeInTheDocument();
    expect(screen.getByText('Coffee shop')).toBeInTheDocument();
    expect(screen.getByText('Acme Bank')).toBeInTheDocument();
    expect(screen.getByText('checking-123')).toBeInTheDocument();
    expect(screen.getByText('$42.50 USD')).toBeInTheDocument();
    expect(screen.getByText('May 1, 2026')).toBeInTheDocument();
  });

  it.each([
    [404, 'NOT_FOUND', 'Transaction not found'],
    [403, 'FORBIDDEN', 'You do not have access to this transaction'],
    [500, 'INTERNAL_ERROR', 'Transaction service unavailable'],
  ] as const)('renders the %i detail error state', async (status, type, message) => {
    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions/:id', () => HttpResponse.json({ type, message }, { status })),
    );

    renderDetailPage();

    expect(await screen.findAllByText(message, {}, { timeout: 3000 })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
  });

  it('hides write and delete affordances when permissions are missing', async () => {
    useDetailReferenceHandlers();
    server.use(http.get('/api/v1/transactions/:id', () => HttpResponse.json(transaction)));

    renderDetailPage(['transactions:read']);

    expect(await screen.findByRole('heading', { name: 'Transaction Details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('updates editable detail fields without a redundant success notification', async () => {
    const user = userEvent.setup();
    let requestBody: unknown;

    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions/:id', () => HttpResponse.json(transaction)),
      http.patch('/api/v1/transactions/:id', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({
          ...transaction,
          description: 'Coffee and bagel',
          accountId: 'savings-987',
          updatedAt: '2026-05-01T13:00:00Z',
        });
      }),
    );

    renderDetailPage();

    await user.click(await screen.findByRole('button', { name: 'Edit Details' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Coffee and bagel');
    await user.clear(screen.getByLabelText('Account ID'));
    await user.type(screen.getByLabelText('Account ID'), 'savings-987');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(requestBody).toEqual({
        description: 'Coffee and bagel',
        accountId: 'savings-987',
      });
    });
    expect(await screen.findByText('Coffee and bagel')).toBeInTheDocument();
    expect(screen.getByText('savings-987')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Details' })).toBeInTheDocument();
  });

  it('keeps both edit drafts available when update fails and preserves them on dismissal', async () => {
    const user = userEvent.setup();

    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions/:id', () => HttpResponse.json(transaction)),
      http.patch('/api/v1/transactions/:id', () =>
        HttpResponse.json(
          { type: 'VALIDATION_ERROR', message: 'Description is too long' },
          { status: 422 },
        ),
      ),
    );

    renderDetailPage();

    await user.click(await screen.findByRole('button', { name: 'Edit Details' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Rejected description');
    await user.clear(screen.getByLabelText('Account ID'));
    await user.type(screen.getByLabelText('Account ID'), 'rejected-account');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Description is too long');
    expect(screen.getByLabelText('Description')).toHaveValue('Rejected description');
    expect(screen.getByLabelText('Account ID')).toHaveValue('rejected-account');

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Rejected description');
    expect(screen.getByLabelText('Account ID')).toHaveValue('rejected-account');
  });

  it('clears failed edit feedback and drafts when editing is cancelled', async () => {
    const user = userEvent.setup();

    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions/:id', () => HttpResponse.json(transaction)),
      http.patch('/api/v1/transactions/:id', () =>
        HttpResponse.json({ type: 'APPLICATION_ERROR', message: 'Update failed' }, { status: 500 }),
      ),
    );

    renderDetailPage();

    await user.click(await screen.findByRole('button', { name: 'Edit Details' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Rejected description');
    await user.clear(screen.getByLabelText('Account ID'));
    await user.type(screen.getByLabelText('Account ID'), 'rejected-account');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Update failed');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Edit Details' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toHaveValue('Coffee shop');
    expect(screen.getByLabelText('Account ID')).toHaveValue('checking-123');
  });

  it('clears failed edit feedback on retry and exits edit mode after a successful retry', async () => {
    const user = userEvent.setup();
    let updateAttempts = 0;

    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions/:id', () => HttpResponse.json(transaction)),
      http.patch('/api/v1/transactions/:id', async () => {
        updateAttempts += 1;

        if (updateAttempts === 1) {
          return HttpResponse.json(
            { type: 'APPLICATION_ERROR', message: 'Update failed' },
            { status: 500 },
          );
        }

        await delay(150);
        return HttpResponse.json({
          ...transaction,
          description: 'Coffee and bagel',
          accountId: 'savings-987',
          updatedAt: '2026-05-01T13:00:00Z',
        });
      }),
    );

    renderDetailPage();

    await user.click(await screen.findByRole('button', { name: 'Edit Details' }));
    await user.clear(screen.getByLabelText('Description'));
    await user.type(screen.getByLabelText('Description'), 'Coffee and bagel');
    await user.clear(screen.getByLabelText('Account ID'));
    await user.type(screen.getByLabelText('Account ID'), 'savings-987');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Update failed');

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(await screen.findByText('Coffee and bagel')).toBeInTheDocument();
    expect(screen.getByText('savings-987')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Details' })).toBeInTheDocument();
  });

  it('deletes the transaction and returns to the list without a redundant success notification', async () => {
    const user = userEvent.setup();

    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions/:id', () => HttpResponse.json(transaction)),
      http.delete('/api/v1/transactions/:id', () => new HttpResponse(null, { status: 204 })),
    );

    const { queryClient } = renderDetailPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(queryClient.getQueryData(['transaction', transaction.id])).toEqual(transaction);
    expect(await screen.findByRole('heading', { name: 'Delete Transaction' })).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[deleteButtons.length - 1]);

    expect(await screen.findByRole('heading', { name: 'Transaction List' })).toBeInTheDocument();
    expect(queryClient.getQueryState(['transaction', transaction.id])?.isInvalidated).toBe(true);
  });

  it('keeps the delete dialog open and surfaces failure feedback when delete fails', async () => {
    const user = userEvent.setup();

    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions/:id', () => HttpResponse.json(transaction)),
      http.delete('/api/v1/transactions/:id', () =>
        HttpResponse.json({ type: 'APPLICATION_ERROR', message: 'Delete failed' }, { status: 500 }),
      ),
    );

    renderDetailPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('heading', { name: 'Delete Transaction' })).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[deleteButtons.length - 1]);

    expect(await screen.findByRole('alert')).toHaveTextContent('Delete failed');
    expect(screen.getByRole('heading', { name: 'Delete Transaction' })).toBeInTheDocument();
    expect(screen.getAllByText('Coffee shop')).toHaveLength(2);
  });

  it('shows positive native disclosure and two-leg weekend publication provenance', async () => {
    const eurTransaction = {
      ...transaction,
      amount: -80,
      currencyIsoCode: 'EUR',
      date: '2026-01-04',
    };

    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions', () => HttpResponse.json([eurTransaction])),
      http.get('/api/v1/transactions/:id', () => HttpResponse.json(eurTransaction)),
      http.get('/api/v1/exchange-rates', ({ request }) => {
        const targetCurrency = new URL(request.url).searchParams.get('targetCurrency');
        const rates = {
          EUR: 0.8,
          GBP: 0.5,
        };
        const rate = targetCurrency && rates[targetCurrency as keyof typeof rates];

        return HttpResponse.json(
          rate
            ? [
                {
                  baseCurrency: 'USD',
                  targetCurrency,
                  date: '2026-01-04',
                  publishedDate: '2026-01-02',
                  rate,
                },
              ]
            : [],
        );
      }),
    );

    renderDetailPage(authenticatedUser.permissions, 'GBP');

    expect(await screen.findAllByText('€80.00 EUR')).toHaveLength(2);
    expect(screen.queryByText(/-€80\.00/)).not.toBeInTheDocument();
    expect(await screen.findByText('£50.00')).toBeInTheDocument();
    expect(screen.getByText('EUR to USD exchange-rate leg')).toBeInTheDocument();
    expect(screen.getByText('USD to GBP exchange-rate leg')).toBeInTheDocument();
    expect(screen.getAllByText(/Published Jan 2, 2026/)).toHaveLength(2);
    expect(screen.getAllByText(/Currency Service carried forward/)).toHaveLength(2);
  });
});
