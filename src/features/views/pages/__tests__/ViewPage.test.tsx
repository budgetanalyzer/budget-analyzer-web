import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewPage } from '@/features/views/pages/ViewPage';
import { SavedView, ViewTransaction } from '@/types/view';
import { renderWithProviders } from '@/testing/test-utils';

const hookMocks = vi.hoisted(() => ({
  useView: vi.fn(),
  useViewTransactions: vi.fn(),
}));

const mutationMocks = vi.hoisted(() => ({
  updateView: vi.fn(),
  pin: vi.fn(),
  unpin: vi.fn(),
  exclude: vi.fn(),
}));

vi.mock('@/hooks/useViews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useViews')>();

  return {
    ...actual,
    useView: hookMocks.useView,
    useViewTransactions: hookMocks.useViewTransactions,
    useUpdateView: () => ({ mutate: mutationMocks.updateView, isPending: false }),
    usePinTransaction: () => ({ mutate: mutationMocks.pin, isPending: false }),
    useUnpinTransaction: () => ({ mutate: mutationMocks.unpin, isPending: false }),
    useExcludeTransaction: () => ({ mutate: mutationMocks.exclude, isPending: false }),
    useBulkPinTransactions: () => ({ mutate: vi.fn(), isPending: false }),
    useBulkExcludeTransactions: () => ({ mutate: vi.fn(), isPending: false }),
    useExcludedViewTransactions: () => ({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
    useUnexcludeTransaction: () => ({ mutate: vi.fn(), isPending: false }),
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
  transactionCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const transactions: ViewTransaction[] = [
  {
    id: 1,
    accountId: 'checking',
    bankName: 'Alpha Bank',
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
    accountId: 'savings',
    bankName: 'Beta Bank',
    date: '2026-02-15',
    currencyIsoCode: 'USD',
    amount: -50,
    type: 'DEBIT',
    description: 'February grocery',
    membershipType: 'MATCHED',
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    id: 3,
    accountId: 'savings',
    bankName: 'Alpha Bank',
    date: '2026-01-20',
    currencyIsoCode: 'USD',
    amount: 200,
    type: 'CREDIT',
    description: 'January salary',
    membershipType: 'MATCHED',
    createdAt: '2026-01-20T00:00:00Z',
    updatedAt: '2026-01-20T00:00:00Z',
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

function renderPage(initialEntry = '/views/view-1', viewOverride: Partial<SavedView> = {}) {
  hookMocks.useView.mockReturnValue(queryResult({ ...view, ...viewOverride }));
  hookMocks.useViewTransactions.mockReturnValue(queryResult(transactions));

  return renderWithProviders(
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
      <Route path="/transactions/:id" element={<LocationProbe />} />
    </Routes>,
    { initialEntries: [initialEntry] },
  );
}

beforeEach(() => {
  Object.values(mutationMocks).forEach((mock) => mock.mockReset());
});

describe('ViewPage analytics entry point', () => {
  it('opens analytics scoped to the active view', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('link', { name: 'Analyze View' }));

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
    expect(screen.getByText('January salary')).toBeInTheDocument();
    expect(screen.queryByText('February grocery')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&returnTo=%2Fanalytics%3Fscope%3Dview%26viewId%3Dview-1%26viewMode%3Dmonthly%26transactionType%3Ddebit%26year%3D2026&breadcrumbLabel=Jan%202026',
    );
  });

  it('clears view detail filters and analytics breadcrumb URL context together', async () => {
    renderPage(
      '/views/view-1?dateFrom=2026-01-01&dateTo=2026-01-31&returnTo=%2Fanalytics%3Fscope%3Dview%26viewId%3Dview-1%26viewMode%3Dmonthly%26transactionType%3Ddebit%26year%3D2026&breadcrumbLabel=Jan%202026',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1');
    });
    expect(screen.getByText('Pinned grocery')).toBeInTheDocument();
    expect(screen.getByText('February grocery')).toBeInTheDocument();
    expect(screen.getByText('January salary')).toBeInTheDocument();
  });

  it('opens the restore excluded modal from the criteria excluded badge', async () => {
    renderPage('/views/view-1', { excludedCount: 33 });

    await userEvent.click(screen.getByRole('button', { name: 'Restore 33 excluded transactions' }));

    expect(
      screen.getByRole('heading', { name: 'Restore Excluded Transactions' }),
    ).toBeInTheDocument();
  });
});

describe('ViewPage temporary transaction filters', () => {
  it('filters credits through the URL and recalculates rows and stats without mutations', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Filter by transaction type' }));
    await userEvent.click(screen.getByRole('button', { name: 'Credit' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1?type=CREDIT');
    });
    expect(screen.getByText('January salary')).toBeInTheDocument();
    expect(screen.queryByText('Pinned grocery')).not.toBeInTheDocument();
    expect(screen.queryByText('February grocery')).not.toBeInTheDocument();

    const totalTransactionsCard =
      screen.getByText('Total Transactions').parentElement?.parentElement;
    const pinnedCard = screen.getByText('Pinned').parentElement?.parentElement;
    expect(totalTransactionsCard).not.toBeNull();
    expect(pinnedCard).not.toBeNull();
    expect(within(totalTransactionsCard!).getByText('1')).toBeInTheDocument();
    expect(within(pinnedCard!).getByText('0')).toBeInTheDocument();

    expect(mutationMocks.updateView).not.toHaveBeenCalled();
    expect(mutationMocks.pin).not.toHaveBeenCalled();
    expect(mutationMocks.unpin).not.toHaveBeenCalled();
    expect(mutationMocks.exclude).not.toHaveBeenCalled();
  });

  it.each([
    ['bank', '/views/view-1?bankName=Beta%20Bank', 'February grocery'],
    ['account', '/views/view-1?accountId=checking', 'Pinned grocery'],
    ['amount', '/views/view-1?minAmount=40&maxAmount=100', 'February grocery'],
  ])('applies the %s filter to visible membership and stats', (_name, url, expectedRow) => {
    renderPage(url);

    expect(screen.getByText(expectedRow)).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    const totalTransactionsCard =
      screen.getByText('Total Transactions').parentElement?.parentElement;
    expect(totalTransactionsCard).not.toBeNull();
    expect(within(totalTransactionsCard!).getByText('1')).toBeInTheDocument();
  });

  it('applies combined filters while retaining options from full canonical membership', async () => {
    renderPage(
      '/views/view-1?bankName=Alpha%20Bank&accountId=savings&type=CREDIT&minAmount=150&maxAmount=250',
    );

    expect(screen.getByText('January salary')).toBeInTheDocument();
    expect(screen.queryByText('Pinned grocery')).not.toBeInTheDocument();
    expect(screen.queryByText('February grocery')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Filter by bank' }));
    expect(screen.getByRole('button', { name: 'Beta Bank' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', { name: 'Filter by account' }));
    expect(screen.getByRole('button', { name: 'checking' })).toBeInTheDocument();
  });

  it('preserves every temporary filter when navigating to transaction detail', async () => {
    renderPage(
      '/views/view-1?bankName=Alpha%20Bank&accountId=savings&type=CREDIT&minAmount=150&maxAmount=250',
    );

    await userEvent.click(screen.getByText('January salary'));

    await waitFor(() => {
      const locationText = screen.getByTestId('location').textContent ?? '';
      const detailSearch = locationText.split('?')[1];
      const detailParams = new URLSearchParams(detailSearch);
      expect(locationText).toContain('/transactions/3?');
      expect(detailParams.get('returnTo')).toBe(
        '/views/view-1?bankName=Alpha%20Bank&accountId=savings&type=CREDIT&minAmount=150&maxAmount=250',
      );
    });
  });
});
