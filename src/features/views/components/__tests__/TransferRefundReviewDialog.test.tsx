import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransferRefundReviewDialog } from '@/features/views/components/TransferRefundReviewDialog';
import type { TransferRefundCandidate } from '@/features/views/types/transferRefundReview';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { DisplayAmount } from '@/types/displayAmount';

const candidate: TransferRefundCandidate = {
  key: 'TRANSFER:1:2',
  kind: 'TRANSFER',
  debit: {
    id: 1,
    accountId: 'checking',
    bankName: 'Alpha Bank',
    date: '2026-01-03',
    currencyIsoCode: 'USD',
    amount: 100,
    type: 'DEBIT',
    description: 'Transfer to savings',
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  },
  credit: {
    id: 2,
    accountId: 'savings',
    bankName: 'Beta Bank',
    date: '2026-01-04',
    currencyIsoCode: 'USD',
    amount: 100,
    type: 'CREDIT',
    description: 'Transfer from checking',
    createdAt: '2026-01-04T00:00:00Z',
    updatedAt: '2026-01-04T00:00:00Z',
  },
  absoluteDayDistance: 1,
  amountDifferenceBasisPoints: 0,
  sharedDescriptionTokens: ['transfer'],
  eligibleRemovalTransactionIds: [1],
};

const displayAmounts = new Map<number, DisplayAmount>([
  [
    1,
    {
      available: true,
      sourceMagnitude: 100,
      sourceCurrency: 'USD',
      targetCurrency: 'EUR',
      minorUnitCount: 2,
      value: 80,
      rateLegs: [],
    },
  ],
  [
    2,
    {
      available: false,
      sourceMagnitude: 100,
      sourceCurrency: 'USD',
      targetCurrency: 'EUR',
      reason: 'MISSING_TARGET_RATE',
    },
  ],
]);

const defaultProps = {
  viewId: 'view-1',
  viewName: 'Monthly activity',
  candidates: [candidate],
  displayAmounts,
  isLoading: false,
  error: null,
  onRetry: vi.fn(),
  onClose: vi.fn(),
  onComplete: vi.fn(),
};

type DialogProps = React.ComponentProps<typeof TransferRefundReviewDialog>;

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

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props = {
    ...defaultProps,
    onRetry: vi.fn(),
    onClose: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
  return { props, ...renderWithProviders(<TransferRefundReviewDialog {...props} />) };
}

afterEach(() => {
  cleanup();
  document.body.classList.remove('overflow-hidden');
});

describe('TransferRefundReviewDialog', () => {
  it('shows only selected-currency candidate amounts and unavailability', () => {
    renderDialog();

    const transfer = screen.getByRole('region', { name: 'Possible transfer' });
    expect(within(transfer).getByText('€80.00')).toBeInTheDocument();
    expect(within(transfer).getByText('Amount in EUR unavailable')).toBeInTheDocument();
    expect(within(transfer).queryByText('$100.00')).not.toBeInTheDocument();
  });

  it('shows nonmember evidence without presenting it as removal history or a selectable row', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', {
      name: 'Review possible transfers and refunds',
    });
    expect(dialog.querySelector('.lucide-triangle-alert')).not.toBeInTheDocument();
    const transfer = screen.getByRole('region', { name: 'Possible transfer' });
    expect(transfer).toHaveTextContent('Not currently in this view; shown as supporting evidence');
    expect(within(transfer).getAllByRole('checkbox')).toHaveLength(1);
    expect(
      screen.getByRole('checkbox', { name: 'Remove debit transaction 1 from this view' }),
    ).toBeChecked();
    expect(
      screen.queryByRole('checkbox', { name: 'Remove credit transaction 2 from this view' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/previous/i)).not.toBeInTheDocument();
  });

  it('submits only selected current member IDs in an atomic removal delta', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request }) => {
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { props } = renderDialog();

    const confirmButton = screen.getByRole('button', { name: 'Remove 1 from this view' });
    expect(confirmButton).toHaveClass('bg-primary', 'text-primary-foreground');
    expect(confirmButton).not.toHaveClass('bg-destructive', 'text-destructive-foreground');

    await userEvent.click(confirmButton);

    await waitFor(() =>
      expect(requestBody).toEqual({ addTransactionIds: [], removeTransactionIds: [1] }),
    );
    await waitFor(() => expect(props.onComplete).toHaveBeenCalledOnce());
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('allows cancellation without issuing a membership delta', async () => {
    let requestCount = 0;
    server.use(
      http.patch('/api/v1/views/:id/transactions', () => {
        requestCount += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { props } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onClose).toHaveBeenCalledOnce();
    expect(requestCount).toBe(0);
  });

  it('shows a normalized dismissible mutation alert while retaining the dialog and selection', async () => {
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
    const { props } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Remove 1 from this view' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The transaction snapshot changed and must be refreshed before updating this saved view.',
    );
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onComplete).not.toHaveBeenCalled();
    expect(
      screen.getByRole('checkbox', { name: 'Remove debit transaction 1 from this view' }),
    ).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Remove debit transaction 1 from this view' }),
    ).toBeChecked();
  });

  it('clears a prior error and completes a successful retry with the same selection', async () => {
    const retryResponse = createDeferredPromise();
    const requestBodies: unknown[] = [];
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request }) => {
        requestBodies.push(await request.json());
        if (requestBodies.length === 1) {
          return HttpResponse.json(
            { type: 'INTERNAL_ERROR', message: 'Membership could not be updated' },
            { status: 500 },
          );
        }

        await retryResponse.promise;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { props } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Remove 1 from this view' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Membership could not be updated');

    await userEvent.click(screen.getByRole('button', { name: 'Remove 1 from this view' }));
    expect(await screen.findByRole('button', { name: 'Removing...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Remove debit transaction 1 from this view' }),
    ).toBeChecked();

    await userEvent.click(getDialogBackdrop());
    await userEvent.keyboard('{Escape}');

    expect(props.onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: 'Review possible transfers and refunds' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Remove debit transaction 1 from this view' }),
    ).toBeChecked();

    retryResponse.resolve();

    await waitFor(() => expect(props.onComplete).toHaveBeenCalledOnce());
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(requestBodies).toEqual([
      { addTransactionIds: [], removeTransactionIds: [1] },
      { addTransactionIds: [], removeTransactionIds: [1] },
    ]);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('blocks stale candidates during loading and retries discovery errors', async () => {
    const loading = renderDialog({ isLoading: true });
    expect(screen.getByText('Finding possible transfers and refunds...')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Possible transfer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove 1 from this view' })).toBeDisabled();

    loading.unmount();
    const onRetry = vi.fn();
    renderDialog({ candidates: [], error: new Error('Discovery failed'), onRetry });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('explains an empty candidate result with removal language', () => {
    renderDialog({ candidates: [] });

    expect(screen.getByText('No possible transfers or refunds were found.')).toBeInTheDocument();
    expect(screen.getByText(/manually remove transactions from this view/)).toBeInTheDocument();
  });
});
