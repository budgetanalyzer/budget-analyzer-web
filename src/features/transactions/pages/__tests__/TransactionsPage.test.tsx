import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Transaction } from '@/types/transaction';
import { Route, Routes, useLocation, useNavigate } from 'react-router';

const { transactionTableMock, transactionData, currencyHookState, viewHookMocks } = vi.hoisted(
  () => ({
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
    viewHookMocks: {
      useView: vi.fn(),
      useViewMembership: vi.fn(),
    },
  }),
);

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
vi.mock('@/hooks/useViews', () => ({
  useView: viewHookMocks.useView,
  useViewMembership: viewHookMocks.useViewMembership,
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
    selectionPurpose:
      | { type: 'delete' }
      | {
          type: 'add-to-view';
          viewName: string;
          memberTransactionIds: number[];
          onCancel: () => void;
          onSuccess: () => void;
        };
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
        data-selection-purpose={props.selectionPurpose.type}
        data-member-ids={
          props.selectionPurpose.type === 'add-to-view'
            ? props.selectionPurpose.memberTransactionIds.join(',')
            : undefined
        }
      >
        {props.selectionPurpose.type === 'add-to-view' && (
          <>
            <button type="button" onClick={props.selectionPurpose.onCancel}>
              Cancel add mode
            </button>
            <button type="button" onClick={props.selectionPurpose.onSuccess}>
              Complete add mode
            </button>
          </>
        )}
      </div>
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
import type { useView, useViewMembership } from '@/hooks/useViews';

const mockUsePermission = vi.mocked(usePermission);

const viewId = '11111111-1111-4111-8111-111111111111';

function HistoryProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="page-location">{`${location.pathname}${location.search}`}</div>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
      <button type="button" onClick={() => navigate(1)}>
        Browser forward
      </button>
    </>
  );
}

function renderPage(initialEntry: string | string[] = '/transactions') {
  return renderWithProviders(<TransactionsPage />, {
    initialEntries: typeof initialEntry === 'string' ? [initialEntry] : initialEntry,
  });
}

function renderPageWithHistory(initialEntries: string[]) {
  return renderWithProviders(
    <>
      <TransactionsPage />
      <HistoryProbe />
    </>,
    { initialEntries },
  );
}

function addModeUrl(returnTo = `/views/${viewId}`) {
  const params = new URLSearchParams({
    addToView: viewId,
    addToViewReturnTo: returnTo,
  });
  return `/?${params.toString()}`;
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
  viewHookMocks.useView.mockReset();
  viewHookMocks.useViewMembership.mockReset();
  viewHookMocks.useView.mockReturnValue({
    data: {
      id: viewId,
      name: 'Static collection',
      transactionCount: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useView>);
  viewHookMocks.useViewMembership.mockReturnValue({
    data: { transactionIds: [1] },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useViewMembership>);
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

describe('TransactionsPage add-to-view navigation mode', () => {
  it('resolves metadata and membership only for a valid, permitted mode', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    transactionData.push({
      id: 2,
      accountId: 'checking',
      bankName: 'Bank',
      date: '2026-01-01',
      currencyIsoCode: 'USD',
      amount: 10,
      type: 'DEBIT',
      description: 'Coffee',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    renderPage(`${addModeUrl()}&q=coffee`);

    const table = await screen.findByTestId('transaction-table-stub');
    expect(viewHookMocks.useView).toHaveBeenCalledWith(viewId);
    expect(viewHookMocks.useViewMembership).toHaveBeenCalledWith(viewId);
    expect(table).toHaveAttribute('data-selection-purpose', 'add-to-view');
    expect(table).toHaveAttribute('data-member-ids', '1');
    expect(
      screen.getByRole('heading', { name: 'Add transactions to Static collection' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import Transactions/ })).not.toBeInTheDocument();
  });

  it('passes only rows from a settled active amount filter to add selection', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    transactionData.push(
      {
        id: 2,
        accountId: 'checking',
        bankName: 'Bank',
        date: '2026-01-01',
        currencyIsoCode: 'USD',
        amount: 5,
        type: 'DEBIT',
        description: 'Below range',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 3,
        accountId: 'checking',
        bankName: 'Bank',
        date: '2026-01-01',
        currencyIsoCode: 'USD',
        amount: 20,
        type: 'DEBIT',
        description: 'Inside range',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    );

    renderPage(`${addModeUrl()}&minAmount=10&amountCurrency=USD`);

    const table = await screen.findByTestId('transaction-table-stub');
    expect(table).toHaveAttribute('data-selection-purpose', 'add-to-view');
    expect(table).toHaveAttribute('data-transaction-ids', '3');
    expect(table).toHaveAttribute('data-amount-loading', 'false');
  });

  it('does not mount target queries or a selectable table for a denied deep link', () => {
    mockUsePermission.mockReturnValue(false);
    renderWithProviders(
      <Routes>
        <Route path="/" element={<TransactionsPage />} />
        <Route path="/unauthorized" element={<div>Unauthorized route</div>} />
      </Routes>,
      { initialEntries: [addModeUrl()] },
    );

    expect(viewHookMocks.useView).not.toHaveBeenCalled();
    expect(viewHookMocks.useViewMembership).not.toHaveBeenCalled();
    expect(screen.queryByTestId('transaction-table-stub')).not.toBeInTheDocument();
    expect(screen.getByText('Unauthorized route')).toBeInTheDocument();
  });

  it('cleans malformed or external mode state before rendering ordinary transactions', async () => {
    mockUsePermission.mockReturnValue(false);
    const externalParams = new URLSearchParams({
      q: 'coffee',
      addToView: viewId,
      addToViewReturnTo: 'https://example.com/views/anything',
    });
    renderPageWithHistory([`/?${externalParams.toString()}`]);

    const table = await screen.findByTestId('transaction-table-stub');
    expect(table).toHaveAttribute('data-selection-purpose', 'delete');
    expect(screen.getByTestId('page-location')).toHaveTextContent('/?q=coffee');
    expect(viewHookMocks.useView).not.toHaveBeenCalled();
    expect(viewHookMocks.useViewMembership).not.toHaveBeenCalled();
  });

  it.each([
    ['cancel', 'Cancel add mode'],
    ['success', 'Complete add mode'],
  ])('returns to a clean source view after %s', async (_outcome, buttonName) => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    const returnTo = `/views/${viewId}?q=coffee`;
    renderPageWithHistory([addModeUrl(returnTo)]);

    await userEvent.click(await screen.findByRole('button', { name: buttonName }));

    expect(screen.getByTestId('page-location')).toHaveTextContent(returnTo);
    expect(screen.getByTestId('page-location')).not.toHaveTextContent('addToView');
  });

  it('tracks add mode through browser back and forward navigation', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    const user = userEvent.setup();
    renderPageWithHistory([`/views/${viewId}`, addModeUrl()]);

    expect(await screen.findByTestId('transaction-table-stub')).toHaveAttribute(
      'data-selection-purpose',
      'add-to-view',
    );
    await user.click(screen.getByRole('button', { name: 'Browser back' }));
    await waitFor(() =>
      expect(screen.getByTestId('page-location')).toHaveTextContent(`/views/${viewId}`),
    );
    expect(screen.getByTestId('transaction-table-stub')).toHaveAttribute(
      'data-selection-purpose',
      'delete',
    );

    await user.click(screen.getByRole('button', { name: 'Browser forward' }));
    await waitFor(() =>
      expect(screen.getByTestId('transaction-table-stub')).toHaveAttribute(
        'data-selection-purpose',
        'add-to-view',
      ),
    );
  });
});
