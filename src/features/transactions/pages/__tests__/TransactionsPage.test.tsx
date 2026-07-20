import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import type { Transaction } from '@/types/transaction';

const { transactionTableMock, transactionData } = vi.hoisted(() => ({
  transactionTableMock: vi.fn(),
  transactionData: [] as Transaction[],
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
    exchangeRatesMap: new Map(),
    pendingCurrencies: [],
    isLoading: false,
  }),
  useCurrencies: () => ({ data: [] }),
}));
vi.mock('@/hooks/useMissingCurrencies', () => ({
  useMissingCurrencies: () => [],
}));

vi.mock('@/features/transactions/components/TransactionTable', () => ({
  TransactionTable: (props: {
    viewCriteria?: unknown;
    filters: unknown;
    transactions: Transaction[];
    availableBankNames: string[];
    availableAccountIds: string[];
  }) => {
    transactionTableMock(props);
    return (
      <div
        data-testid="transaction-table-stub"
        data-criteria={JSON.stringify(props.viewCriteria)}
        data-filters={JSON.stringify(props.filters)}
        data-transaction-ids={props.transactions.map((transaction) => transaction.id).join(',')}
        data-bank-options={props.availableBankNames.join(',')}
        data-account-options={props.availableAccountIds.join(',')}
      />
    );
  },
}));
vi.mock('@/features/transactions/components/ImportButton', () => ({
  ImportButton: () => <button type="button">Import Transactions</button>,
}));

import { usePermission } from '@/features/auth/hooks/usePermission';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import { renderWithProviders } from '@/testing/test-utils';

const mockUsePermission = vi.mocked(usePermission);

function renderPage(initialEntry = '/transactions') {
  return renderWithProviders(<TransactionsPage />, {
    initialEntries: [initialEntry],
  });
}

beforeEach(() => {
  mockUsePermission.mockReset();
  transactionTableMock.mockReset();
  transactionData.splice(0);
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
});

describe('TransactionsPage saved-view criteria', () => {
  it('builds saved-view criteria with dateFrom, dateTo, and transaction type from active filters', async () => {
    mockUsePermission.mockReturnValue(false);
    renderPage(
      '/transactions?dateFrom=2026-01-01&dateTo=2026-01-31&type=DEBIT&q=coffee&bankName=Test%20Bank&accountId=checking&minAmount=10&maxAmount=250',
    );

    const table = await screen.findByTestId('transaction-table-stub');

    await waitFor(() => {
      expect(table).toHaveAttribute(
        'data-criteria',
        JSON.stringify({
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
          searchText: 'coffee',
          bankNames: ['Test Bank'],
          accountIds: ['checking'],
          type: 'DEBIT',
          minAmount: 10,
          maxAmount: 250,
        }),
      );
    });
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
      }),
    );
  });
});
