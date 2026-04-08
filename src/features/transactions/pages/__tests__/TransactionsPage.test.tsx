import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
vi.mock('@/features/transactions/components/TransactionTable', () => ({
  TransactionTable: () => <div data-testid="transaction-table-stub" />,
}));
vi.mock('@/features/transactions/components/ImportButton', () => ({
  ImportButton: () => <button type="button">Import Transactions</button>,
}));

import { usePermission } from '@/features/auth/hooks/usePermission';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import uiReducer from '@/store/uiSlice';

const mockUsePermission = vi.mocked(usePermission);

function renderPage() {
  const store = configureStore({ reducer: { ui: uiReducer } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/transactions']}>
          <TransactionsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

beforeEach(() => {
  mockUsePermission.mockReset();
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
