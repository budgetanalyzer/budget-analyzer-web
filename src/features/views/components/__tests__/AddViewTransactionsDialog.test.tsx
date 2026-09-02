import { useCallback, useState } from 'react';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddViewTransactionsDialog } from '@/features/views/components/AddViewTransactionsDialog';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';
import { projectDisplayAmount } from '@/utils/displayAmount';

const transactions: Transaction[] = [
  {
    id: 1,
    accountId: 'checking',
    bankName: 'Example Bank',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: 10,
    type: 'DEBIT',
    description: 'Coffee',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 2,
    accountId: 'savings',
    bankName: 'Second Bank',
    date: '2026-01-16',
    currencyIsoCode: 'USD',
    amount: 20,
    type: 'CREDIT',
    description: 'Salary',
    createdAt: '2026-01-16T00:00:00Z',
    updatedAt: '2026-01-16T00:00:00Z',
  },
];

const displayAmounts = new Map<number, DisplayAmount>(
  transactions.map((transaction) => [
    transaction.id,
    projectDisplayAmount(transaction, 'USD', new Map()),
  ]),
);

const defaultProps = {
  viewId: '11111111-1111-4111-8111-111111111111',
  viewName: 'Monthly activity',
  allTransactions: transactions,
  memberTransactionIds: [2],
  displayCurrency: 'USD',
  displayAmounts,
  isDisplayAmountLoading: false,
  onClose: vi.fn(),
};

type DialogProps = React.ComponentProps<typeof AddViewTransactionsDialog>;

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function getDialogBackdrop(): HTMLElement {
  const backdrop = screen.getByRole('dialog').previousElementSibling;
  if (!(backdrop instanceof HTMLElement)) throw new Error('Expected a dialog backdrop');
  return backdrop;
}

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props = { ...defaultProps, onClose: vi.fn(), ...overrides };
  return { props, ...renderWithProviders(<AddViewTransactionsDialog {...props} />) };
}

function DialogHarness() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      <button type="button" onClick={handleOpen}>
        Open transaction picker
      </button>
      {open && <AddViewTransactionsDialog {...defaultProps} onClose={handleClose} />}
    </>
  );
}

afterEach(() => {
  cleanup();
  document.body.classList.remove('overflow-hidden');
});

describe('AddViewTransactionsDialog', () => {
  it('uses shared dialog naming, initial focus, and focus restoration', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DialogHarness />);

    const trigger = screen.getByRole('button', { name: 'Open transaction picker' });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Add transactions to Monthly activity' });
    expect(dialog).toHaveAccessibleDescription(
      'Select active transactions to add. Transactions already in this view cannot be selected.',
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      screen.queryByRole('dialog', { name: 'Add transactions to Monthly activity' }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('submits one exact atomic addition delta and closes on success', async () => {
    let requestBody: unknown;
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request }) => {
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { props } = renderDialog();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select transaction 1 to add to Monthly activity',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));

    await waitFor(() =>
      expect(requestBody).toEqual({ addTransactionIds: [1], removeTransactionIds: [] }),
    );
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
  });

  it('cancels without issuing a membership request', async () => {
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

  it('keeps an ordinary failure and the reviewed selection available for retry', async () => {
    server.use(
      http.patch('/api/v1/views/:id/transactions', () =>
        HttpResponse.json(
          { type: 'SERVICE_UNAVAILABLE', message: 'Try again later' },
          { status: 503 },
        ),
      ),
    );
    const { props } = renderDialog();
    const user = userEvent.setup();
    const selection = screen.getByRole('checkbox', {
      name: 'Select transaction 1 to add to Monthly activity',
    });

    await user.click(selection);
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Try again later');
    expect(selection).toBeChecked();
    expect(screen.getByText('1 eligible transaction selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeEnabled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('requires a selection change after a stale failure before resubmitting', async () => {
    const requestBodies: unknown[] = [];
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request }) => {
        requestBodies.push(await request.json());
        if (requestBodies.length === 1) {
          return HttpResponse.json(
            {
              type: 'APPLICATION_ERROR',
              code: 'SAVED_VIEW_MEMBERSHIP_STALE',
              message: 'Snapshot changed',
            },
            { status: 422 },
          );
        }

        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { props } = renderDialog();
    const user = userEvent.setup();
    const selection = screen.getByRole('checkbox', {
      name: 'Select transaction 1 to add to Monthly activity',
    });

    await user.click(selection);
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Membership and transactions were refreshed; review your selection before submitting again.',
    );
    expect(selection).toBeChecked();
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeDisabled();

    await user.click(selection);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeDisabled();

    await user.click(selection);
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));

    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(requestBodies).toEqual([
      { addTransactionIds: [1], removeTransactionIds: [] },
      { addTransactionIds: [1], removeTransactionIds: [] },
    ]);
  });

  it('cannot be dismissed while an addition request is pending', async () => {
    const deferredResponse = createDeferredPromise();
    server.use(
      http.patch('/api/v1/views/:id/transactions', async () => {
        await deferredResponse.promise;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { props } = renderDialog();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select transaction 1 to add to Monthly activity',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));

    expect(await screen.findByRole('button', { name: 'Adding...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();

    await user.click(getDialogBackdrop());
    await user.keyboard('{Escape}');

    expect(props.onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: 'Add transactions to Monthly activity' }),
    ).toBeInTheDocument();

    await act(async () => deferredResponse.resolve());

    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
  });
});
