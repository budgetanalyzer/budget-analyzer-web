import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { TransactionDetailPage } from '@/features/transactions/pages/TransactionDetailPage';
import { toast } from '@/hooks/useToast';
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

function renderDetailPage(permissions = authenticatedUser.permissions) {
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
    expect(screen.getByText('$42.50')).toBeInTheDocument();
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

  it('updates editable detail fields and surfaces success feedback', async () => {
    const user = userEvent.setup();
    const successToast = vi.spyOn(toast, 'success');
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
      expect(successToast).toHaveBeenCalledWith('Transaction updated');
    });
    expect(await screen.findByText('Coffee and bagel')).toBeInTheDocument();
    expect(screen.getByText('savings-987')).toBeInTheDocument();
  });

  it('keeps edit mode open and surfaces failure feedback when update fails', async () => {
    const user = userEvent.setup();
    const errorToast = vi.spyOn(toast, 'error');

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
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(errorToast).toHaveBeenCalledWith('Description is too long');
    });
    expect(screen.getByLabelText('Description')).toHaveValue('Rejected description');
  });

  it('deletes the transaction, shows success feedback, and returns to the list', async () => {
    const user = userEvent.setup();
    const successToast = vi.spyOn(toast, 'success');

    useDetailReferenceHandlers();
    server.use(
      http.get('/api/v1/transactions/:id', () => HttpResponse.json(transaction)),
      http.delete('/api/v1/transactions/:id', () => new HttpResponse(null, { status: 204 })),
    );

    renderDetailPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('heading', { name: 'Delete Transaction' })).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await user.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => {
      expect(successToast).toHaveBeenCalledWith('Transaction deleted successfully');
    });
    expect(await screen.findByRole('heading', { name: 'Transaction List' })).toBeInTheDocument();
  });

  it('keeps the delete dialog open and surfaces failure feedback when delete fails', async () => {
    const user = userEvent.setup();
    const errorToast = vi.spyOn(toast, 'error');

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

    await waitFor(() => {
      expect(errorToast).toHaveBeenCalledWith('Delete failed');
    });
    expect(screen.getByRole('heading', { name: 'Delete Transaction' })).toBeInTheDocument();
  });
});
