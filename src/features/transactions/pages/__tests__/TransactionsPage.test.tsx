import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/hooks/useTransactions', () => ({
  useTransactions: () => ({
    data: [],
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
const transactionTableMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/transactions/components/TransactionTable', () => ({
  TransactionTable: (props: { viewCriteria?: unknown }) => {
    transactionTableMock(props);
    return (
      <div
        data-testid="transaction-table-stub"
        data-criteria={JSON.stringify(props.viewCriteria)}
      />
    );
  },
}));
vi.mock('@/features/transactions/components/ImportButton', () => ({
  ImportButton: () => <button type="button">Import Transactions</button>,
}));

import { usePermission } from '@/features/auth/hooks/usePermission';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import uiReducer from '@/store/uiSlice';

const mockUsePermission = vi.mocked(usePermission);

function renderPage(initialEntry = '/transactions') {
  const store = configureStore({ reducer: { ui: uiReducer } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <TransactionsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

beforeEach(() => {
  mockUsePermission.mockReset();
  transactionTableMock.mockReset();
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
    renderPage('/transactions?dateFrom=2026-01-01&dateTo=2026-01-31&type=DEBIT&q=coffee');

    const table = await screen.findByTestId('transaction-table-stub');

    await waitFor(() => {
      expect(table).toHaveAttribute(
        'data-criteria',
        JSON.stringify({
          dateFrom: '2026-01-01',
          dateTo: '2026-01-31',
          searchText: 'coffee',
          type: 'DEBIT',
        }),
      );
    });
  });
});
