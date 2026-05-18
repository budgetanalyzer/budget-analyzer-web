import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Transaction } from '@/types/transaction';
import { SavedView, ViewTransaction } from '@/types/view';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import uiReducer from '@/store/uiSlice';

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});

const hookMocks = vi.hoisted(() => ({
  useTransactions: vi.fn(),
  useViews: vi.fn(),
  useView: vi.fn(),
  useViewTransactions: vi.fn(),
}));

vi.mock('@/hooks/useTransactions', () => ({
  useTransactions: hookMocks.useTransactions,
}));

vi.mock('@/hooks/useViews', () => ({
  useViews: hookMocks.useViews,
  useView: hookMocks.useView,
  useViewTransactions: hookMocks.useViewTransactions,
}));

vi.mock('@/hooks/useCurrencies', () => ({
  useExchangeRatesMap: () => ({
    exchangeRatesMap: new Map(),
    pendingCurrencies: [],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useMissingCurrencies', () => ({
  useMissingCurrencies: () => [],
}));

const groceriesView: SavedView = {
  id: 'view-1',
  name: 'Groceries',
  criteria: {},
  openEnded: true,
  pinnedCount: 1,
  excludedCount: 1,
  transactionCount: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    accountId: 'checking',
    bankName: 'Test Bank',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: 100,
    type: 'DEBIT',
    description: 'Transaction',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

function queryResult<T>(data: T) {
  return {
    data,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(initialEntry: string) {
  const store = configureStore({ reducer: { ui: uiReducer } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AnalyticsPage />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

beforeEach(() => {
  hookMocks.useTransactions.mockReset();
  hookMocks.useViews.mockReset();
  hookMocks.useView.mockReset();
  hookMocks.useViewTransactions.mockReset();

  hookMocks.useTransactions.mockReturnValue(queryResult([transaction({ amount: 100 })]));
  hookMocks.useViews.mockReturnValue(queryResult([groceriesView]));
  hookMocks.useView.mockReturnValue(queryResult(groceriesView));
  hookMocks.useViewTransactions.mockReturnValue(
    queryResult<ViewTransaction[]>([
      {
        ...transaction({ id: 2, amount: 25, description: 'Pinned grocery' }),
        membershipType: 'PINNED',
      },
    ]),
  );
});

describe('AnalyticsPage source resolution', () => {
  it('uses all transactions for all-scope analytics', () => {
    renderPage('/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026');

    expect(screen.getByText('Monthly spending breakdown for 2026')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.queryByText('$25.00')).not.toBeInTheDocument();
    expect(hookMocks.useTransactions).toHaveBeenCalledWith({ enabled: true });
  });

  it('uses canonical view transactions for view-scoped analytics', () => {
    renderPage(
      '/analytics?scope=view&viewId=view-1&viewMode=monthly&transactionType=debit&year=2026',
    );

    expect(
      screen.getByText('Monthly spending breakdown for 2026 in Groceries'),
    ).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.queryByText('$100.00')).not.toBeInTheDocument();
    expect(hookMocks.useTransactions).toHaveBeenCalledWith({ enabled: false });
    expect(hookMocks.useView).toHaveBeenCalledWith('view-1');
    expect(hookMocks.useViewTransactions).toHaveBeenCalledWith('view-1');
  });

  it('updates the analytics URL when a saved view source is selected', async () => {
    renderPage('/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026');

    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/analytics?scope=view&viewMode=monthly&transactionType=debit&year=2026&viewId=view-1',
      );
    });
  });

  it('removes the view ID when all transactions is selected', async () => {
    renderPage(
      '/analytics?scope=view&viewId=view-1&viewMode=monthly&transactionType=debit&year=2026',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    fireEvent.click(screen.getByRole('button', { name: 'All transactions' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026',
      );
    });
  });
});
