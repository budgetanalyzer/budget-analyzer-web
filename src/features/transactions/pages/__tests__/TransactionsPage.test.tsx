import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Transaction } from '@/types/transaction';

const { transactionTableMock, transactionData, currencyHookState } = vi.hoisted(() => ({
  transactionTableMock: vi.fn(),
  transactionData: [] as Transaction[],
  currencyHookState: {
    exchangeRatesMap: new Map(),
    pendingCurrencies: [] as string[],
    disabledCurrencies: [] as string[],
    isExchangeRatesLoading: false,
    enabledCurrencies: [] as Array<{ currencyCode: string }>,
    isCurrenciesLoading: false,
  },
}));

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/hooks/useTransactions', () => ({
  useTransactions: () => ({
    data: transactionData,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/useCurrencies', () => ({
  useExchangeRatesMap: () => ({
    exchangeRatesMap: currencyHookState.exchangeRatesMap,
    pendingCurrencies: currencyHookState.pendingCurrencies,
    isLoading: currencyHookState.isExchangeRatesLoading,
  }),
  useCurrencies: () => ({
    data: currencyHookState.enabledCurrencies,
    isLoading: currencyHookState.isCurrenciesLoading,
  }),
}));
vi.mock('@/hooks/useMissingCurrencies', () => ({
  useMissingCurrencies: () => currencyHookState.disabledCurrencies,
}));
vi.mock('@/features/transactions/components/TransactionTable', () => ({
  TransactionTable: (props: {
    viewTransactionIds?: number[];
    isViewTransactionIdsReady?: boolean;
    filters: unknown;
    transactions: Transaction[];
    availableBankNames: string[];
    availableAccountIds: string[];
    isAmountFilterLoading: boolean;
    unavailableAmountFilterCount: number;
  }) => {
    transactionTableMock(props);
    return (
      <div
        data-testid="transaction-table-stub"
        data-view-transaction-ids={props.viewTransactionIds?.join(',')}
        data-view-transaction-ids-ready={props.isViewTransactionIdsReady?.toString()}
        data-filters={JSON.stringify(props.filters)}
        data-transaction-ids={props.transactions.map((transaction) => transaction.id).join(',')}
        data-bank-options={props.availableBankNames.join(',')}
        data-account-options={props.availableAccountIds.join(',')}
        data-amount-loading={props.isAmountFilterLoading.toString()}
        data-unavailable-count={props.unavailableAmountFilterCount.toString()}
      />
    );
  },
}));
vi.mock('@/features/transactions/components/ImportButton', () => ({
  ImportButton: ({
    onSuccess,
    onError,
  }: {
    onSuccess?: (created: number, duplicatesSkipped: number, duplicatesImported: number) => void;
    onError?: (error: Error) => void;
  }) => (
    <>
      <button type="button">Import Transactions</button>
      <button type="button" onClick={() => onSuccess?.(7, 3, 2)}>
        Complete grouped import
      </button>
      <button
        type="button"
        onClick={() =>
          onError?.(
            new Error(
              "Failed to preview file 'bad-statement.csv': Missing required Description column",
            ),
          )
        }
      >
        Fail grouped preview
      </button>
    </>
  ),
}));

import { usePermission } from '@/features/auth/hooks/usePermission';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import { renderWithProviders } from '@/testing/test-utils';

const mockUsePermission = vi.mocked(usePermission);

function renderPage(initialEntry: string | string[] = '/transactions') {
  return renderWithProviders(<TransactionsPage />, {
    initialEntries: typeof initialEntry === 'string' ? [initialEntry] : initialEntry,
  });
}

beforeEach(() => {
  mockUsePermission.mockReset();
  transactionTableMock.mockReset();
  transactionData.splice(0);
  currencyHookState.exchangeRatesMap = new Map();
  currencyHookState.pendingCurrencies = [];
  currencyHookState.disabledCurrencies = [];
  currencyHookState.isExchangeRatesLoading = false;
  currencyHookState.enabledCurrencies = [];
  currencyHookState.isCurrenciesLoading = false;
});

describe('TransactionsPage Import button gating', () => {
  it('renders the Import Transactions button when transactions:write is granted', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:write');
    renderPage();

    expect(screen.getByRole('button', { name: /Import Transactions/ })).toBeInTheDocument();
    expect(mockUsePermission).toHaveBeenCalledWith('transactions:write');
  });

  it('hides the Import Transactions button when transactions:write is missing', () => {
    mockUsePermission.mockReturnValue(false);
    renderPage();

    expect(screen.queryByRole('button', { name: /Import Transactions/ })).not.toBeInTheDocument();
  });

  it('uses aggregate grouped-import counts in the existing success banner', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:write');
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Complete grouped import' }));

    expect(
      screen.getByText(
        'Successfully imported 7 transactions, including 2 duplicates. Skipped 3 duplicates.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a filename-bearing first-file preview failure in the existing error banner', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:write');
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Fail grouped preview' }));

    expect(
      screen.getByText(
        "Failed to preview file 'bad-statement.csv': Missing required Description column",
      ),
    ).toBeInTheDocument();
  });
});

describe('TransactionsPage exchange-rate warnings', () => {
  it('reports selected-currency unavailability for disabled and pending rates', () => {
    currencyHookState.disabledCurrencies = ['EUR'];
    currencyHookState.pendingCurrencies = ['GBP'];
    mockUsePermission.mockReturnValue(false);

    renderPage();

    expect(
      screen.getByText('EUR is disabled. Amounts are unavailable in the selected currency.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Exchange rates for GBP are being imported. Amounts are unavailable in the selected currency.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});

describe('TransactionsPage shared transaction filters', () => {
  it('passes the shared model and independently applies a from date to table rows', async () => {
    transactionData.push(
      {
        id: 1,
        accountId: 'checking',
        bankName: 'Bank B',
        date: '2026-01-01',
        currencyIsoCode: 'USD',
        amount: -10,
        type: 'DEBIT',
        description: 'Coffee',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 2,
        accountId: 'savings',
        bankName: 'Bank A',
        date: '2026-01-15',
        currencyIsoCode: 'USD',
        amount: 100,
        type: 'CREDIT',
        description: 'Salary',
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      },
      {
        id: 3,
        accountId: 'checking',
        bankName: 'Bank B',
        date: '2026-02-01',
        currencyIsoCode: 'USD',
        amount: -200,
        type: 'DEBIT',
        description: 'Rent',
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
      },
    );
    mockUsePermission.mockReturnValue(false);

    renderPage('/transactions?dateFrom=2026-01-15');

    const table = await screen.findByTestId('transaction-table-stub');
    expect(table).toHaveAttribute('data-transaction-ids', '2,3');
    expect(table).toHaveAttribute('data-view-transaction-ids', '2,3');
    expect(table).toHaveAttribute('data-view-transaction-ids-ready', 'true');
    expect(table).toHaveAttribute('data-bank-options', 'Bank A,Bank B');
    expect(table).toHaveAttribute('data-account-options', 'checking,savings');
    expect(table).toHaveAttribute(
      'data-filters',
      JSON.stringify({
        globalFilter: '',
        dateFilter: { from: '2026-01-15', to: null },
        bankNameFilter: null,
        accountIdFilter: null,
        typeFilter: null,
        amountFilter: { min: null, max: null },
        amountCurrency: null,
      }),
    );
  });

  it('filters on the quantized display amount and reports otherwise-matching unavailable rows', async () => {
    transactionData.push(
      {
        id: 10,
        accountId: 'checking',
        bankName: 'Bank',
        date: '2026-01-01',
        currencyIsoCode: 'USD',
        amount: 10.004,
        type: 'DEBIT',
        description: 'Quantized edge',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 11,
        accountId: 'checking',
        bankName: 'Bank',
        date: '2026-01-01',
        currencyIsoCode: 'USD',
        amount: 9.994,
        type: 'DEBIT',
        description: 'Below edge',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 12,
        accountId: 'checking',
        bankName: 'Bank',
        date: '2026-01-01',
        currencyIsoCode: 'GBP',
        amount: 10,
        type: 'DEBIT',
        description: 'No rate',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    );
    mockUsePermission.mockReturnValue(false);

    renderPage('/transactions?minAmount=10&maxAmount=10&amountCurrency=USD');

    const table = await screen.findByTestId('transaction-table-stub');
    expect(table).toHaveAttribute('data-transaction-ids', '10');
    expect(table).toHaveAttribute('data-view-transaction-ids', '10');
    expect(table).toHaveAttribute('data-unavailable-count', '1');
  });

  it('synchronizes a valid deep-link amount currency before applying its range', async () => {
    transactionData.push({
      id: 20,
      accountId: 'checking',
      bankName: 'Bank',
      date: '2026-01-01',
      currencyIsoCode: 'EUR',
      amount: 10,
      type: 'DEBIT',
      description: 'Euro row',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    currencyHookState.enabledCurrencies = [{ currencyCode: 'EUR' }];
    mockUsePermission.mockReturnValue(false);

    const { store } = renderPage('/transactions?minAmount=10&maxAmount=10&amountCurrency=EUR');

    await waitFor(() => expect(store.getState().ui.displayCurrency).toBe('EUR'));
    expect(
      transactionTableMock.mock.calls.some(
        ([props]) => (props as { isAmountFilterLoading: boolean }).isAmountFilterLoading,
      ),
    ).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId('transaction-table-stub')).toHaveAttribute(
        'data-amount-loading',
        'false',
      );
      expect(screen.getByTestId('transaction-table-stub')).toHaveAttribute(
        'data-transaction-ids',
        '20',
      );
    });
  });

  it.each(['EURO', 'GBP'])(
    'ignores amount bounds and shows recovery feedback for invalid or disabled currency %s',
    async (amountCurrency) => {
      transactionData.push({
        id: 30,
        accountId: 'checking',
        bankName: 'Bank',
        date: '2026-01-01',
        currencyIsoCode: 'USD',
        amount: 1,
        type: 'DEBIT',
        description: 'Below ignored range',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });
      currencyHookState.enabledCurrencies = [{ currencyCode: 'EUR' }];
      mockUsePermission.mockReturnValue(false);

      renderPage(`/transactions?minAmount=10&amountCurrency=${amountCurrency}`);

      expect(
        await screen.findByText(
          'Amount filter ignored because its currency is invalid or disabled. Clear it and enter a new range.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByTestId('transaction-table-stub')).toHaveAttribute(
        'data-transaction-ids',
        '30',
      );
    },
  );

  it('keeps an active amount range unresolved while required rates load', async () => {
    transactionData.push({
      id: 40,
      accountId: 'checking',
      bankName: 'Bank',
      date: '2026-01-01',
      currencyIsoCode: 'USD',
      amount: 20,
      type: 'DEBIT',
      description: 'Loading amount',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });
    currencyHookState.isExchangeRatesLoading = true;
    mockUsePermission.mockReturnValue(false);

    renderPage('/transactions?minAmount=10&amountCurrency=USD');

    expect(await screen.findByTestId('transaction-table-stub')).toHaveAttribute(
      'data-amount-loading',
      'true',
    );
    expect(screen.getByTestId('transaction-table-stub')).toHaveAttribute(
      'data-view-transaction-ids-ready',
      'false',
    );
  });
});
