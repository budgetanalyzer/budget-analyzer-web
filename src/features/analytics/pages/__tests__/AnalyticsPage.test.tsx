import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { Transaction } from '@/types/transaction';
import type { SavedViewMetadata } from '@/types/view';
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { renderWithProviders } from '@/testing/test-utils';

vi.mock('@/features/auth/hooks/useAuth');

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

const currencyHookState = vi.hoisted(() => ({
  exchangeRatesMap: new Map(),
}));

const mockUseAuth = vi.mocked(useAuth);

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
    exchangeRatesMap: currencyHookState.exchangeRatesMap,
    pendingCurrencies: [],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useMissingCurrencies', () => ({
  useMissingCurrencies: () => [],
}));

const groceriesView: SavedViewMetadata = {
  id: 'view-1',
  name: 'Groceries',
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

function mockPermissions(permissions: string[]) {
  mockUseAuth.mockReturnValue({
    user: {
      sub: 'user-1',
      email: 'user@example.com',
      authenticated: true,
      roles: ['USER'],
      permissions,
    },
    error: null,
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    refetch: vi.fn(),
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(initialEntry: string) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/analytics"
        element={
          <>
            <AnalyticsPage />
            <LocationProbe />
          </>
        }
      />
      <Route path="/" element={<LocationProbe />} />
      <Route path="/views/:id" element={<LocationProbe />} />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

beforeEach(() => {
  mockUseAuth.mockReset();
  hookMocks.useTransactions.mockReset();
  hookMocks.useViews.mockReset();
  hookMocks.useView.mockReset();
  hookMocks.useViewTransactions.mockReset();
  currencyHookState.exchangeRatesMap = new Map();

  mockPermissions(['views:read']);

  hookMocks.useTransactions.mockReturnValue(queryResult([transaction({ amount: 100 })]));
  hookMocks.useViews.mockReturnValue(queryResult([groceriesView]));
  hookMocks.useView.mockReturnValue(queryResult(groceriesView));
  hookMocks.useViewTransactions.mockReturnValue(
    queryResult<Transaction[]>([transaction({ id: 2, amount: 25, description: 'Saved grocery' })]),
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

  it('canonicalizes a denied saved-view deep link without mounting saved-view queries', async () => {
    mockPermissions([]);

    renderPage(
      '/analytics?scope=view&viewId=view-1&viewMode=monthly&transactionType=debit&year=2026',
    );

    expect(await screen.findByText('Monthly spending breakdown for 2026')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.queryByText('$25.00')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Source' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026',
    );
    expect(hookMocks.useTransactions).toHaveBeenCalledWith({ enabled: true });
    expect(hookMocks.useViews).not.toHaveBeenCalled();
    expect(hookMocks.useView).not.toHaveBeenCalled();
    expect(hookMocks.useViewTransactions).not.toHaveBeenCalled();
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

    await userEvent.click(screen.getByRole('button', { name: 'Source' }));
    await userEvent.click(screen.getByRole('button', { name: 'Groceries' }));

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

    await userEvent.click(screen.getByRole('button', { name: 'Source' }));
    await userEvent.click(screen.getByRole('button', { name: 'All transactions' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026',
      );
    });
  });

  it('routes an all-scope monthly drilldown to the filtered transactions page', async () => {
    renderPage('/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026');

    await userEvent.click(screen.getByRole('link', { name: /Jan 2026/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/?dateFrom=2026-01-01&dateTo=2026-01-31&type=DEBIT&returnTo=%2Fanalytics%3Fscope%3Dall%26viewMode%3Dmonthly%26transactionType%3Ddebit%26year%3D2026&breadcrumbLabel=Jan%202026',
      );
    });
  });

  it('routes a view-scoped monthly drilldown to the filtered view detail page', async () => {
    renderPage(
      '/analytics?scope=view&viewId=view-1&viewMode=monthly&transactionType=debit&year=2026',
    );

    await userEvent.click(screen.getByRole('link', { name: /Jan 2026/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&type=DEBIT&returnTo=%2Fanalytics%3Fscope%3Dview%26viewId%3Dview-1%26viewMode%3Dmonthly%26transactionType%3Ddebit%26year%3D2026&breadcrumbLabel=Jan%202026',
      );
    });
  });

  it('routes a credit analytics drilldown to the credit-only view detail page', async () => {
    hookMocks.useViewTransactions.mockReturnValue(
      queryResult<Transaction[]>([
        transaction({ id: 2, amount: 25, type: 'CREDIT', description: 'Refund' }),
      ]),
    );

    renderPage(
      '/analytics?scope=view&viewId=view-1&viewMode=monthly&transactionType=credit&year=2026',
    );

    await userEvent.click(screen.getByRole('link', { name: /Jan 2026/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&type=CREDIT&returnTo=%2Fanalytics%3Fscope%3Dview%26viewId%3Dview-1%26viewMode%3Dmonthly%26transactionType%3Dcredit%26year%3D2026&breadcrumbLabel=Jan%202026',
      );
    });
  });

  it('defaults monthly analytics to the latest year with transactions', async () => {
    hookMocks.useTransactions.mockReturnValue(
      queryResult([
        transaction({ id: 1, date: '2024-03-10', amount: 40 }),
        transaction({ id: 2, date: '2025-05-12', amount: 25 }),
      ]),
    );

    renderPage('/analytics?scope=all&viewMode=monthly&transactionType=debit');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2025',
      );
    });

    expect(await screen.findByText('Monthly spending breakdown for 2025')).toBeInTheDocument();
    expect(await screen.findByText('$25.00')).toBeInTheDocument();
  });

  it('redirects a monthly year before the transaction range to the earliest year', async () => {
    hookMocks.useTransactions.mockReturnValue(
      queryResult([
        transaction({ id: 1, date: '2024-03-10', amount: 40 }),
        transaction({ id: 2, date: '2025-05-12', amount: 25 }),
      ]),
    );

    renderPage('/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2020');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2024',
      );
    });

    expect(screen.getByText('Monthly spending breakdown for 2024')).toBeInTheDocument();
    expect(await screen.findByText('$40.00')).toBeInTheDocument();
  });

  it('renders yearly debit totals and routes yearly drilldown to year date bounds', async () => {
    hookMocks.useTransactions.mockReturnValue(
      queryResult([
        transaction({ id: 1, date: '2025-02-03', amount: -40 }),
        transaction({ id: 2, date: '2026-03-04', amount: 100 }),
        transaction({ id: 3, date: '2026-04-05', amount: 250, type: 'CREDIT' }),
      ]),
    );

    renderPage('/analytics?scope=all&viewMode=yearly&transactionType=debit');

    expect(screen.getByText('Yearly spending overview')).toBeInTheDocument();
    expect(screen.getByText('$40.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.queryByText('$250.00')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: /2025/ }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/?dateFrom=2025-01-01&dateTo=2025-12-31&type=DEBIT&returnTo=%2Fanalytics%3Fscope%3Dall%26viewMode%3Dyearly%26transactionType%3Ddebit&breadcrumbLabel=2025',
      );
    });
  });

  it('shows the yearly empty state when the selected transaction type has no data', () => {
    hookMocks.useTransactions.mockReturnValue(
      queryResult([transaction({ id: 1, date: '2026-03-04', amount: 100 })]),
    );

    renderPage('/analytics?scope=all&viewMode=yearly&transactionType=credit');

    expect(screen.getByText('No yearly analytics for credit transactions.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /2026/ })).not.toBeInTheDocument();
  });

  it('labels a mixed selected-currency total partial and counts every transaction', () => {
    hookMocks.useTransactions.mockReturnValue(
      queryResult([
        transaction({ id: 1, amount: 100 }),
        transaction({ id: 2, currencyIsoCode: 'GBP', amount: 80 }),
      ]),
    );

    renderPage('/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026');

    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('Partial total · 1 unavailable')).toBeInTheDocument();
    expect(screen.getByText('2 transactions')).toBeInTheDocument();
  });

  it('shows all-unavailable selected-currency totals as unavailable', () => {
    hookMocks.useTransactions.mockReturnValue(
      queryResult([transaction({ currencyIsoCode: 'GBP', amount: 80 })]),
    );

    renderPage('/analytics?scope=all&viewMode=yearly&transactionType=debit');

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('All 1 amount unavailable')).toBeInTheDocument();
    expect(screen.queryByText('$80.00')).not.toBeInTheDocument();
  });
});
