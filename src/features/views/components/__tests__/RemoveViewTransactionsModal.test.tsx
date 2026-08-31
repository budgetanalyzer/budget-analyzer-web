import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { RemoveViewTransactionsModal } from '@/features/views/components/RemoveViewTransactionsModal';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';

const transaction: Transaction = {
  id: 5,
  accountId: 'checking',
  bankName: 'Test Bank',
  date: '2026-01-04',
  currencyIsoCode: 'EUR',
  amount: -80,
  type: 'DEBIT',
  description: 'Weekend purchase',
  createdAt: '2026-01-04T00:00:00Z',
  updatedAt: '2026-01-04T00:00:00Z',
};

const displayAmount: DisplayAmount = {
  available: true,
  sourceMagnitude: 80,
  sourceCurrency: 'EUR',
  targetCurrency: 'USD',
  minorUnitCount: 2,
  value: 100,
  rateLegs: [],
};

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

function renderModal(
  transactionIds = [3, 3, 8],
  selectedDisplayAmount: DisplayAmount | null = displayAmount,
) {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();
  const uniqueIds = Array.from(new Set(transactionIds));
  const selectedTransaction = uniqueIds.length === 1 && uniqueIds[0] === transaction.id;
  const result = renderWithProviders(
    <RemoveViewTransactionsModal
      viewId="view-1"
      transactionIds={transactionIds}
      transaction={selectedTransaction ? transaction : null}
      displayAmount={selectedTransaction ? selectedDisplayAmount : null}
      open
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />,
  );

  return { ...result, onOpenChange, onSuccess };
}

describe('RemoveViewTransactionsModal', () => {
  it('confirms the unique count and treats a bodyless 204 as complete success', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request }) => {
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onOpenChange, onSuccess } = renderModal();

    const dialog = screen.getByRole('dialog', { name: 'Remove from view' });
    expect(dialog.querySelector('.lucide-triangle-alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Remove 2 transactions from this view/)).toBeInTheDocument();
    expect(screen.queryByText('Weekend purchase')).not.toBeInTheDocument();
    const confirmButton = screen.getByRole('button', { name: 'Remove from view' });
    expect(confirmButton).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(confirmButton).not.toHaveClass('bg-destructive', 'text-destructive-foreground');

    await userEvent.click(confirmButton);

    await waitFor(() =>
      expect(requestBody).toEqual({
        addTransactionIds: [],
        removeTransactionIds: [3, 8],
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('identifies one transaction with only its available selected-currency amount', () => {
    renderModal([5, 5]);

    expect(screen.getByText('Jan 4, 2026')).toBeInTheDocument();
    expect(screen.getByText('Weekend purchase')).toBeInTheDocument();
    expect(screen.getByText('Amount in USD:')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.queryByText('€80.00')).not.toBeInTheDocument();
  });

  it('identifies one transaction when its selected-currency projection is unavailable', () => {
    renderModal([5], {
      available: false,
      sourceMagnitude: 80,
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      reason: 'MISSING_SOURCE_RATE',
    });

    expect(screen.getByText('Jan 4, 2026')).toBeInTheDocument();
    expect(screen.getByText('Weekend purchase')).toBeInTheDocument();
    expect(screen.getByText('Amount in USD:')).toBeInTheDocument();
    expect(screen.getByText('Amount in USD unavailable')).toBeInTheDocument();
    expect(screen.queryByText('€80.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$80.00')).not.toBeInTheDocument();
  });

  it('keeps single-transaction context and omits the amount when no projection exists', () => {
    renderModal([5], null);

    expect(screen.getByText('Jan 4, 2026')).toBeInTheDocument();
    expect(screen.getByText('Weekend purchase')).toBeInTheDocument();
    expect(screen.queryByText(/Amount in/)).not.toBeInTheDocument();
    expect(screen.queryByText('€80.00')).not.toBeInTheDocument();
  });

  it('cancels without issuing a membership delta', async () => {
    let requestCount = 0;
    server.use(
      http.patch('/api/v1/views/:id/transactions', () => {
        requestCount += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onOpenChange, onSuccess } = renderModal();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(requestCount).toBe(0);
  });

  it('shows a normalized dismissible alert while keeping the dialog and selection intact', async () => {
    server.use(
      http.patch('/api/v1/views/:id/transactions', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            message: 'Snapshot rejected',
            code: 'SAVED_VIEW_MEMBERSHIP_STALE',
          },
          { status: 422 },
        ),
      ),
    );
    const { onOpenChange, onSuccess } = renderModal([5]);

    await userEvent.click(screen.getByRole('button', { name: 'Remove from view' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove from view' })).toBeEnabled(),
    );

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The transaction snapshot changed and must be refreshed before updating this saved view.',
    );
    expect(screen.getByRole('heading', { name: 'Remove from view' })).toBeInTheDocument();
    expect(screen.getByText(/Remove 1 transaction from this view/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Remove 1 transaction from this view/)).toBeInTheDocument();
  });

  it('clears a prior error and completes a successful retry with the same atomic selection', async () => {
    const retryResponse = createDeferredPromise();
    const requestBodies: unknown[] = [];
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request }) => {
        requestBodies.push(await request.json());
        if (requestBodies.length === 1) {
          return HttpResponse.json(
            { type: 'INTERNAL_ERROR', message: 'Membership update failed' },
            { status: 500 },
          );
        }

        await retryResponse.promise;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { onOpenChange, onSuccess } = renderModal([5]);

    await userEvent.click(screen.getByRole('button', { name: 'Remove from view' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Membership update failed');

    await userEvent.click(screen.getByRole('button', { name: 'Remove from view' }));
    expect(await screen.findByRole('button', { name: 'Removing...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/Remove 1 transaction from this view/)).toBeInTheDocument();

    await userEvent.click(getDialogBackdrop());
    await userEvent.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Remove from view' })).toBeInTheDocument();
    expect(screen.getByText(/Remove 1 transaction from this view/)).toBeInTheDocument();

    retryResponse.resolve();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(requestBodies).toEqual([
      { addTransactionIds: [], removeTransactionIds: [5] },
      { addTransactionIds: [], removeTransactionIds: [5] },
    ]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
