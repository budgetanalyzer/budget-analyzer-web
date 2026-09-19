import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateTransactionDialog } from '@/features/transactions/components/CreateTransactionDialog';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { CurrencySeriesResponse } from '@/types/currency';
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

function currency(id: number, currencyCode: string, enabled = true): CurrencySeriesResponse {
  return {
    id,
    currencyCode,
    providerSeriesId: `SERIES-${currencyCode}-${id}`,
    enabled,
    createdAt: '2026-09-18T06:00:00Z',
    updatedAt: '2026-09-18T06:00:00Z',
  };
}

const defaultCurrencies = [currency(2, 'EUR'), currency(3, 'CAD')];

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

async function getReadyCurrencySelect() {
  const currencySelect = screen.getByLabelText('Currency');
  await waitFor(() => expect(currencySelect).not.toBeDisabled());
  return currencySelect;
}

async function enterAmount(amount: string) {
  const amountInput = screen.getByLabelText('Amount');
  await userEvent.clear(amountInput);
  await userEvent.type(amountInput, amount);
}

beforeEach(() => {
  server.use(http.get('/api/v1/currencies', () => HttpResponse.json(defaultCurrencies)));
});

describe('CreateTransactionDialog', () => {
  it('renders USD first with deduplicated enabled currencies and defaults to the available display currency', async () => {
    let enabledOnly: string | null = null;
    server.use(
      http.get('/api/v1/currencies', ({ request }) => {
        enabledOnly = new URL(request.url).searchParams.get('enabledOnly');
        return HttpResponse.json([
          currency(5, 'GBP'),
          currency(1, 'USD'),
          currency(4, 'CAD'),
          currency(2, 'EUR'),
          currency(6, 'CAD'),
          currency(7, 'JPY', false),
          currency(8, 'USD'),
        ]);
      }),
    );

    renderDialog('EUR');

    const currencySelect = await getReadyCurrencySelect();
    expect(enabledOnly).toBe('true');
    expect(currencySelect).toHaveValue('EUR');
    expect(
      within(currencySelect)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['USD', 'CAD', 'EUR', 'GBP']);
  });

  it('falls back to USD when the display currency is not enabled', async () => {
    renderDialog('JPY');

    expect(await getReadyCurrencySelect()).toHaveValue('USD');
  });

  it('submits defaults with an empty description and omits blank optional metadata', async () => {
    const user = userEvent.setup();
    let capturedBody: unknown;
    const response = {
      ...createdTransaction,
      date: getCurrentLocalDate(),
    };
    server.use(
      http.post('/api/v1/transactions', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(response, { status: 201 });
      }),
    );
    const { onClose, onCreated } = renderDialog();

    expect(screen.getByRole('dialog', { name: 'Create transaction' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue(getCurrentLocalDate());
    expect(await getReadyCurrencySelect()).toHaveValue('USD');
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
    expect(onClose).not.toHaveBeenCalled();
  });

  it('submits the selected currency, trimmed text, CREDIT, and optional metadata', async () => {
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
    server.use(
      http.post('/api/v1/transactions', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(creditResponse, { status: 201 });
      }),
    );
    renderDialog('EUR');

    await user.type(screen.getByLabelText('Description'), '  Cash deposit  ');
    await enterAmount('500');
    await user.selectOptions(await getReadyCurrencySelect(), 'CAD');
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

  it('rejects empty or zero amounts before transport', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.post('/api/v1/transactions', () => {
        requestCount += 1;
        return HttpResponse.json(createdTransaction, { status: 201 });
      }),
    );
    renderDialog();
    await getReadyCurrencySelect();

    await enterAmount('0');
    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    expect(screen.getByText('Enter a finite amount greater than zero.')).toBeInTheDocument();
    expect(requestCount).toBe(0);

    await user.clear(screen.getByLabelText('Amount'));
    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    expect(screen.getByText('Enter a finite amount greater than zero.')).toBeInTheDocument();
    expect(requestCount).toBe(0);
  });

  it('maps a 422 currency rejection and preserves every draft value and selection', async () => {
    const user = userEvent.setup();
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
    const { onClose, onCreated } = renderDialog();

    await user.type(screen.getByLabelText('Description'), 'Cash purchase');
    await enterAmount('8.75');
    await user.selectOptions(await getReadyCurrencySelect(), 'CAD');
    await user.selectOptions(screen.getByLabelText('Type'), 'CREDIT');
    await user.type(screen.getByLabelText('Bank name (optional)'), 'Local Bank');
    await user.type(screen.getByLabelText('Account ID (optional)'), 'wallet-7');
    await user.click(screen.getByRole('button', { name: 'Create transaction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This currency code is not supported for transactions',
    );
    expect(screen.getByLabelText('Description')).toHaveValue('Cash purchase');
    expect(screen.getByLabelText('Amount')).toHaveValue(8.75);
    expect(screen.getByLabelText('Currency')).toHaveValue('CAD');
    expect(screen.getByLabelText('Type')).toHaveValue('CREDIT');
    expect(screen.getByLabelText('Bank name (optional)')).toHaveValue('Local Bank');
    expect(screen.getByLabelText('Account ID (optional)')).toHaveValue('wallet-7');
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('blocks submission while currency choices are loading', async () => {
    const responseGate = createDeferredPromise();
    let requestCount = 0;
    server.use(
      http.get('/api/v1/currencies', async () => {
        await responseGate.promise;
        return HttpResponse.json(defaultCurrencies);
      }),
      http.post('/api/v1/transactions', () => {
        requestCount += 1;
        return HttpResponse.json(createdTransaction, { status: 201 });
      }),
    );
    renderDialog();

    const currencySelect = screen.getByLabelText('Currency');
    expect(currencySelect).toBeDisabled();
    expect(currencySelect).toHaveValue('');
    expect(within(currencySelect).getByRole('option')).toHaveTextContent('Loading currencies...');
    const createButton = screen.getByRole('button', { name: 'Create transaction' });
    expect(createButton).toBeDisabled();

    fireEvent.submit(createButton.closest('form')!);
    expect(requestCount).toBe(0);

    responseGate.resolve();

    expect(await getReadyCurrencySelect()).toHaveValue('USD');
    expect(createButton).toBeEnabled();
  });

  it('keeps a first-load currency failure blocking and retries it in context', async () => {
    const user = userEvent.setup();
    let requestCount = 0;
    server.use(
      http.get('/api/v1/currencies', () => {
        requestCount += 1;
        if (requestCount <= 2) {
          return HttpResponse.json(
            { type: 'SERVICE_UNAVAILABLE', message: 'Currency service unavailable' },
            { status: 503 },
          );
        }
        return HttpResponse.json(defaultCurrencies);
      }),
    );
    renderDialog();

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Currency service unavailable' },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Currency')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create transaction' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await getReadyCurrencySelect()).toHaveValue('USD');
    expect(
      screen.queryByRole('heading', { name: 'Currency service unavailable' }),
    ).not.toBeInTheDocument();
    expect(requestCount).toBe(3);
  });

  it('prevents duplicate submission and backdrop, Escape, or Cancel dismissal while pending', async () => {
    const user = userEvent.setup();
    const responseGate = createDeferredPromise();
    let requestCount = 0;
    server.use(
      http.post('/api/v1/transactions', async () => {
        requestCount += 1;
        await responseGate.promise;
        return HttpResponse.json(createdTransaction, { status: 201 });
      }),
    );
    const { onClose, onCreated } = renderDialog();
    await getReadyCurrencySelect();

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
    expect(onClose).not.toHaveBeenCalled();
  });
});
