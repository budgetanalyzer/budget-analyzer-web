import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { CreateTransactionDialog } from '@/features/transactions/components/CreateTransactionDialog';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { Transaction } from '@/types/transaction';
import { getCurrentLocalDate } from '@/utils/dates';

const createdTransaction: Transaction = {
  id: 73,
  date: '2026-09-19',
  description: '',
  amount: 12.345,
  currencyIsoCode: 'USD',
  type: 'DEBIT',
  createdAt: '2026-09-19T06:00:00Z',
  updatedAt: '2026-09-19T06:00:00Z',
};

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function getDialogBackdrop() {
  const backdrop = screen.getByRole('dialog').previousElementSibling;
  if (!backdrop) throw new Error('Expected a dialog backdrop');
  return backdrop;
}

function renderDialog(displayCurrency = 'USD') {
  const onClose = vi.fn();
  const onCreated = vi.fn();

  renderWithProviders(
    <CreateTransactionDialog
      displayCurrency={displayCurrency}
      onClose={onClose}
      onCreated={onCreated}
    />,
  );

  return { onClose, onCreated };
}

async function enterAmount(amount: string) {
  const amountInput = screen.getByLabelText('Amount');
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, amount);
}

describe('CreateTransactionDialog', () => {
  it('submits defaults with an empty description and omits blank optional metadata', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown;
    const response = {
      ...createdTransaction,
      date: getCurrentLocalDate(),
    };
    const { onClose, onCreated } = renderDialog();

    server.use(
      http.post('/api/v1/transactions', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(response, { status: 201 });
      }),
    );

    expect(screen.getByRole('dialog', { name: 'Create transaction' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue(getCurrentLocalDate());
    expect(screen.getByLabelText('Currency')).toHaveValue('USD');
    expect(screen.getByLabelText('Type')).toHaveValue('DEBIT');

    await enterAmount('12.345');
    await user.type(screen.getByLabelText('Bank name (optional)'), '   ');
    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    await waitFor(() => {
      expect(capturedBody).toEqual({
        date: getCurrentLocalDate(),
        description: '',
        amount: 12.345,
        currencyIsoCode: 'USD',
        type: 'DEBIT',
      });
    });
    expect(onCreated).toHaveBeenCalledWith(response);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('uppercases text currency, trims text, and submits CREDIT with optional metadata', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown;
    const creditResponse: Transaction = {
      ...createdTransaction,
      id: 74,
      description: 'Cash deposit',
      amount: 500,
      currencyIsoCode: 'CAD',
      type: 'CREDIT',
      bankName: 'Community Bank',
      accountId: 'cash-1',
    };
    renderDialog('EUR');

    server.use(
      http.post('/api/v1/transactions', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(creditResponse, { status: 201 });
      }),
    );

    await user.type(screen.getByLabelText('Description'), '  Cash deposit  ');
    await enterAmount('500');
    await user.clear(screen.getByLabelText('Currency'));
    await user.type(screen.getByLabelText('Currency'), 'cad');
    await user.selectOptions(screen.getByLabelText('Type'), 'CREDIT');
    await user.type(screen.getByLabelText('Bank name (optional)'), '  Community Bank  ');
    await user.type(screen.getByLabelText('Account ID (optional)'), '  cash-1  ');
    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    await waitFor(() => {
      expect(capturedBody).toEqual({
        date: getCurrentLocalDate(),
        description: 'Cash deposit',
        amount: 500,
        currencyIsoCode: 'CAD',
        type: 'CREDIT',
        bankName: 'Community Bank',
        accountId: 'cash-1',
      });
    });
  });

  it('rejects empty or zero amounts and malformed currency before transport', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    renderDialog();

    server.use(
      http.post('/api/v1/transactions', () => {
        requestCount += 1;
        return HttpResponse.json(createdTransaction, { status: 201 });
      }),
    );

    await enterAmount('0');
    await user.clear(screen.getByLabelText('Currency'));
    await user.type(screen.getByLabelText('Currency'), 'u1');
    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    expect(screen.getByText('Enter a finite amount greater than zero.')).toBeInTheDocument();
    expect(screen.getByText('Enter a three-letter currency code.')).toBeInTheDocument();
    expect(requestCount).toBe(0);

    await user.clear(screen.getByLabelText('Amount'));
    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    expect(screen.getByText('Enter a finite amount greater than zero.')).toBeInTheDocument();
    expect(requestCount).toBe(0);
  });

  it('maps a 422 application code and preserves every draft value after failure', async () => {
    const user = userEvent.setup();
    const { onClose, onCreated } = renderDialog();

    server.use(
      http.post('/api/v1/transactions', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            message: 'Technical currency validation message',
            code: 'TRANSACTION_CURRENCY_INVALID',
          },
          { status: 422 },
        ),
      ),
    );

    await user.type(screen.getByLabelText('Description'), 'Cash purchase');
    await enterAmount('8.75');
    await user.clear(screen.getByLabelText('Currency'));
    await user.type(screen.getByLabelText('Currency'), 'abc');
    await user.selectOptions(screen.getByLabelText('Type'), 'CREDIT');
    await user.type(screen.getByLabelText('Bank name (optional)'), 'Local Bank');
    await user.type(screen.getByLabelText('Account ID (optional)'), 'wallet-7');
    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This currency code is not supported for transactions',
    );
    expect(screen.getByLabelText('Description')).toHaveValue('Cash purchase');
    expect(screen.getByLabelText('Amount')).toHaveValue(8.75);
    expect(screen.getByLabelText('Currency')).toHaveValue('ABC');
    expect(screen.getByLabelText('Type')).toHaveValue('CREDIT');
    expect(screen.getByLabelText('Bank name (optional)')).toHaveValue('Local Bank');
    expect(screen.getByLabelText('Account ID (optional)')).toHaveValue('wallet-7');
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('prevents duplicate submission and backdrop, Escape, or Cancel dismissal while pending', async () => {
    const user = userEvent.setup();
    const responseGate = createDeferredPromise();
    let requestCount = 0;
    const { onClose, onCreated } = renderDialog();

    server.use(
      http.post('/api/v1/transactions', async () => {
        requestCount += 1;
        await responseGate.promise;
        return HttpResponse.json(createdTransaction, { status: 201 });
      }),
    );

    await enterAmount('12.345');
    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    const pendingButton = await screen.findByRole('button', { name: 'Creating...' });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeDisabled();
    expect(screen.getByLabelText('Description')).toBeDisabled();
    expect(screen.getByLabelText('Amount')).toBeDisabled();
    expect(screen.getByLabelText('Currency')).toBeDisabled();
    expect(screen.getByLabelText('Type')).toBeDisabled();
    expect(screen.getByLabelText('Bank name (optional)')).toBeDisabled();
    expect(screen.getByLabelText('Account ID (optional)')).toBeDisabled();

    fireEvent.submit(pendingButton.closest('form')!);
    await user.click(getDialogBackdrop());
    await user.keyboard('{Escape}');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(requestCount).toBe(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Create transaction' })).toBeInTheDocument();

    responseGate.resolve();

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(createdTransaction));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
