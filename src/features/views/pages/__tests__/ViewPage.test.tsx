import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';
import { ViewPage } from '@/features/views/pages/ViewPage';
import { SavedView, ViewTransaction } from '@/types/view';
import uiReducer from '@/store/uiSlice';

const hookMocks = vi.hoisted(() => ({
  useView: vi.fn(),
  useViewTransactions: vi.fn(),
}));

vi.mock('@/hooks/useViews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useViews')>();

  return {
    ...actual,
    useView: hookMocks.useView,
    useViewTransactions: hookMocks.useViewTransactions,
    usePinTransaction: () => ({ mutate: vi.fn(), isPending: false }),
    useUnpinTransaction: () => ({ mutate: vi.fn(), isPending: false }),
    useExcludeTransaction: () => ({ mutate: vi.fn(), isPending: false }),
    useBulkPinTransactions: () => ({ mutate: vi.fn(), isPending: false }),
    useBulkExcludeTransactions: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

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

const view: SavedView = {
  id: 'view-1',
  name: 'Groceries',
  criteria: {},
  openEnded: true,
  pinnedCount: 0,
  excludedCount: 0,
  transactionCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const transactions: ViewTransaction[] = [
  {
    id: 1,
    accountId: 'checking',
    bankName: 'Test Bank',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: -25,
    type: 'DEBIT',
    description: 'Pinned grocery',
    membershipType: 'PINNED',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 2,
    accountId: 'checking',
    bankName: 'Test Bank',
    date: '2026-02-15',
    currencyIsoCode: 'USD',
    amount: -50,
    type: 'DEBIT',
    description: 'February grocery',
    membershipType: 'MATCHED',
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
];

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

function renderPage(initialEntry = '/views/view-1') {
  hookMocks.useView.mockReturnValue(queryResult(view));
  hookMocks.useViewTransactions.mockReturnValue(queryResult(transactions));

  const store = configureStore({ reducer: { ui: uiReducer } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/views/:id"
              element={
                <>
                  <ViewPage />
                  <LocationProbe />
                </>
              }
            />
            <Route path="/analytics" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
}

describe('ViewPage analytics entry point', () => {
  it('opens analytics scoped to the active view', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('link', { name: 'Analyze View' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/analytics?scope=view&viewId=view-1&viewMode=monthly&transactionType=debit',
      );
    });
  });

  it('applies analytics drilldown date filters on the view detail landing page', () => {
    renderPage(
      '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&returnTo=%2Fanalytics%3Fscope%3Dview%26viewId%3Dview-1%26viewMode%3Dmonthly%26transactionType%3Ddebit%26year%3D2026&breadcrumbLabel=Jan%202026',
    );

    expect(screen.getByText('Pinned grocery')).toBeInTheDocument();
    expect(screen.queryByText('February grocery')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&returnTo=%2Fanalytics%3Fscope%3Dview%26viewId%3Dview-1%26viewMode%3Dmonthly%26transactionType%3Ddebit%26year%3D2026&breadcrumbLabel=Jan%202026',
    );
  });

  it('clears view detail filters and analytics breadcrumb URL context together', async () => {
    renderPage(
      '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&returnTo=%2Fanalytics%3Fscope%3Dview%26viewId%3Dview-1%26viewMode%3Dmonthly%26transactionType%3Ddebit%26year%3D2026&breadcrumbLabel=Jan%202026',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1');
    });
    expect(screen.getByText('Pinned grocery')).toBeInTheDocument();
    expect(screen.getByText('February grocery')).toBeInTheDocument();
  });
});
