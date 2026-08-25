import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewPage } from '@/features/views/pages/ViewPage';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { useCurrencies, useExchangeRatesMap } from '@/hooks/useCurrencies';
import { useMissingCurrencies } from '@/hooks/useMissingCurrencies';
import {
  createRemoveViewTransactionsRequest,
  useUpdateViewTransactions,
  useView,
  useViewTransactions,
} from '@/hooks/useViews';
import { renderWithProviders } from '@/testing/test-utils';
import { ApiError } from '@/types/apiError';
import type { Transaction } from '@/types/transaction';
import type { SavedViewMetadata } from '@/types/view';

const saveAsProps = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('@/hooks/useViews');
vi.mock('@/hooks/useCurrencies');
vi.mock('@/hooks/useMissingCurrencies');
vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/components/SaveAsViewButton', () => ({
  SaveAsViewButton: (props: {
    transactionIds: number[];
    isTransactionIdsReady: boolean;
    label?: string;
  }) => {
    saveAsProps.current = props;
    return (
      <button type="button" disabled={!props.isTransactionIdsReady}>
        {props.label}
      </button>
    );
  },
}));

const mockUseView = vi.mocked(useView);
const mockUseViewTransactions = vi.mocked(useViewTransactions);
const mockUseUpdateViewTransactions = vi.mocked(useUpdateViewTransactions);
const mockCreateRemoveViewTransactionsRequest = vi.mocked(createRemoveViewTransactionsRequest);
const mockUseCurrencies = vi.mocked(useCurrencies);
const mockUseExchangeRatesMap = vi.mocked(useExchangeRatesMap);
const mockUseMissingCurrencies = vi.mocked(useMissingCurrencies);
const mockUsePermission = vi.mocked(usePermission);
const viewId = '11111111-1111-4111-8111-111111111111';

const view: SavedViewMetadata = {
  id: viewId,
  name: 'Static collection',
  transactionCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const transactions: Transaction[] = [
  {
    id: 1,
    accountId: 'checking',
    bankName: 'Example Bank',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: 10,
    type: 'DEBIT',
    description: 'Coffee',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 2,
    accountId: 'checking',
    bankName: 'Example Bank',
    date: '2026-01-16',
    currencyIsoCode: 'USD',
    amount: 20,
    type: 'DEBIT',
    description: 'Groceries',
    createdAt: '2026-01-16T00:00:00Z',
    updatedAt: '2026-01-16T00:00:00Z',
  },
];

function renderPage(initialEntry = `/views/${viewId}`) {
  return renderWithProviders(<ViewPage />, { initialEntries: [initialEntry] });
}

beforeEach(() => {
  saveAsProps.current = undefined;
  mockUsePermission.mockReset();
  mockUsePermission.mockReturnValue(true);
  mockCreateRemoveViewTransactionsRequest.mockImplementation((transactionIds) => ({
    addTransactionIds: [],
    removeTransactionIds: [...new Set(transactionIds)],
  }));
  mockUseUpdateViewTransactions.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateViewTransactions>);
  mockUseMissingCurrencies.mockReturnValue([]);
  mockUseCurrencies.mockReturnValue({
    data: [{ currencyCode: 'USD' }],
    isLoading: false,
  } as unknown as ReturnType<typeof useCurrencies>);
  mockUseExchangeRatesMap.mockReturnValue({
    exchangeRatesMap: new Map(),
    exchangeRatesData: [],
    pendingCurrencies: [],
    failedCurrencies: [],
    isLoading: false,
    error: undefined,
  });
  mockUseView.mockReturnValue({
    data: view,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useView>);
  mockUseViewTransactions.mockReturnValue({
    data: transactions,
    allTransactions: transactions,
    memberTransactionIds: [1, 2],
    missingTransactionIds: [],
    isLoading: false,
    isPending: false,
    isFetching: false,
    isError: false,
    isSuccess: true,
    error: null,
    refetch: vi.fn(),
  });
});

describe('ViewPage static collections', () => {
  it('renders static metadata and write-gated member removal controls', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Static collection' })).toBeInTheDocument();
    expect(screen.getByText('2 transactions')).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Find Transfers & Refunds' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add transactions' })).toHaveAttribute(
      'href',
      expect.stringContaining(`addToView=${viewId}`),
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Remove from view' })).toHaveLength(2);
  });

  it('supports an empty static collection', () => {
    mockUseView.mockReturnValue({
      data: { ...view, transactionCount: 0 },
      isLoading: false,
      error: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useView>);
    mockUseViewTransactions.mockReturnValue({
      data: [],
      allTransactions: transactions,
      memberTransactionIds: [],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();
    expect(screen.getByText('0 transactions')).toBeInTheDocument();
    expect(screen.getByText('No transactions in this view.')).toBeInTheDocument();
  });

  it('passes the exact locally filtered ids to an independent clone action', () => {
    renderPage(`/views/${viewId}?q=coffee`);

    expect(saveAsProps.current).toEqual({
      transactionIds: [1],
      isTransactionIdsReady: true,
      label: 'Clone View',
    });
    expect(saveAsProps.current).not.toHaveProperty('sourceViewId');
  });

  it('builds a filtered add-mode link with an explicit clean return destination', () => {
    renderPage(`/views/${viewId}?q=coffee&bankName=Example+Bank`);

    const href = screen.getByRole('link', { name: 'Add transactions' }).getAttribute('href');
    const url = new URL(href!, 'https://budgetanalyzer.invalid');
    expect(url.pathname).toBe('/');
    expect(url.searchParams.get('q')).toBe('coffee');
    expect(url.searchParams.get('bankName')).toBe('Example Bank');
    expect(url.searchParams.get('addToView')).toBe(viewId);
    expect(url.searchParams.get('addToViewReturnTo')).toBe(
      `/views/${viewId}?q=coffee&bankName=Example+Bank`,
    );
  });

  it('uses settled selected-currency amount filtering for clone ids', () => {
    renderPage(`/views/${viewId}?minAmount=15&amountCurrency=USD`);
    expect(saveAsProps.current).toEqual(
      expect.objectContaining({ transactionIds: [2], isTransactionIdsReady: true }),
    );
  });

  it('uses the shared projection for native disclosure and partial saved-view totals', () => {
    const mixedTransactions = [
      transactions[0],
      { ...transactions[1], currencyIsoCode: 'GBP', amount: 20 },
    ];
    mockUseViewTransactions.mockReturnValue({
      data: mixedTransactions,
      allTransactions: mixedTransactions,
      memberTransactionIds: [1, 2],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Sum of visible debits · Partial; 1 unavailable')).toBeInTheDocument();
    expect(screen.getByText('£20.00')).toBeInTheDocument();
    expect(screen.getByText('Conversion to USD unavailable')).toBeInTheDocument();
    expect(saveAsProps.current).toEqual(
      expect.objectContaining({ transactionIds: [1, 2], isTransactionIdsReady: true }),
    );
  });

  it('renders an all-unavailable saved-view spend total as unavailable', () => {
    const unavailableTransactions = transactions.map((item) => ({
      ...item,
      currencyIsoCode: 'GBP',
    }));
    mockUseViewTransactions.mockReturnValue({
      data: unavailableTransactions,
      allTransactions: unavailableTransactions,
      memberTransactionIds: [1, 2],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });

    renderPage();

    expect(screen.getByText('Conversion unavailable for all 2 transactions')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('disables cloning while an active amount filter is unresolved', () => {
    mockUseExchangeRatesMap.mockReturnValue({
      exchangeRatesMap: new Map(),
      exchangeRatesData: [],
      pendingCurrencies: ['GBP'],
      failedCurrencies: [],
      isLoading: true,
      error: undefined,
    });
    renderPage(`/views/${viewId}?minAmount=15&amountCurrency=USD`);

    expect(screen.getByRole('button', { name: 'Clone View' })).toBeDisabled();
    expect(saveAsProps.current).toEqual(expect.objectContaining({ isTransactionIdsReady: false }));
  });

  it('reports stale snapshot memberships without fetching rows itself', () => {
    mockUseViewTransactions.mockReturnValue({
      data: [transactions[0]],
      allTransactions: transactions,
      memberTransactionIds: [1, 99],
      missingTransactionIds: [99],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/1 membership is not available/)).toBeInTheDocument();
  });

  it('gates clone, rename, and delete actions with their independent permissions', () => {
    mockUsePermission.mockReturnValue(false);
    renderPage();

    expect(screen.queryByRole('button', { name: 'Clone View' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Add transactions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View settings' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Find Transfers & Refunds' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove from view' })).not.toBeInTheDocument();
  });

  it('keeps membership selection independent from transaction deletion permission', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:delete');
    const deletionOnly = renderPage();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove from view' })).not.toBeInTheDocument();

    deletionOnly.unmount();
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    renderPage();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Remove from view' })).toHaveLength(2);
  });

  it('uses nonmembers only as transfer/refund evidence', async () => {
    const outsideCredit: Transaction = {
      ...transactions[0],
      id: 3,
      date: '2026-01-16',
      type: 'CREDIT',
      description: 'Coffee refund',
    };
    mockUseViewTransactions.mockReturnValue({
      data: [transactions[0]],
      allTransactions: [transactions[0], outsideCredit],
      memberTransactionIds: [1],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: false,
      isSuccess: true,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Find Transfers & Refunds' }));

    expect(await screen.findByRole('region', { name: 'Possible refund' })).toBeInTheDocument();
    expect(
      screen.getByText('Not currently in this view; shown as supporting evidence'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Remove debit transaction 1 from this view' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Remove credit transaction 3 from this view' }),
    ).not.toBeInTheDocument();
  });

  it('combines loading and error presentation from metadata and membership', () => {
    mockUseViewTransactions.mockReturnValue({
      data: undefined,
      allTransactions: undefined,
      memberTransactionIds: [],
      missingTransactionIds: [],
      isLoading: true,
      isPending: true,
      isFetching: true,
      isError: false,
      isSuccess: false,
      error: null,
      refetch: vi.fn(),
    });
    const loading = renderPage();
    expect(screen.getByText('Loading view...')).toBeInTheDocument();

    loading.unmount();
    mockUseViewTransactions.mockReturnValue({
      data: undefined,
      allTransactions: undefined,
      memberTransactionIds: [],
      missingTransactionIds: [],
      isLoading: false,
      isPending: false,
      isFetching: false,
      isError: true,
      isSuccess: false,
      error: new ApiError(503, { type: 'SERVICE_UNAVAILABLE', message: 'Members unavailable' }),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getAllByText('Members unavailable')).toHaveLength(2);
  });
});
