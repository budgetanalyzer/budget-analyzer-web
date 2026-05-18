import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ViewTransactionTable } from '@/features/views/components/ViewTransactionTable';
import { ViewTransaction } from '@/types/view';

const mutationMocks = vi.hoisted(() => ({
  pinMutate: vi.fn(),
  unpinMutate: vi.fn(),
  excludeMutate: vi.fn(),
  bulkPinMutate: vi.fn(),
  bulkExcludeMutate: vi.fn(),
}));

vi.mock('@/hooks/useViews', () => ({
  usePinTransaction: () => ({ mutate: mutationMocks.pinMutate, isPending: false }),
  useUnpinTransaction: () => ({ mutate: mutationMocks.unpinMutate, isPending: false }),
  useExcludeTransaction: () => ({ mutate: mutationMocks.excludeMutate, isPending: false }),
  useBulkPinTransactions: () => ({ mutate: mutationMocks.bulkPinMutate, isPending: false }),
  useBulkExcludeTransactions: () => ({
    mutate: mutationMocks.bulkExcludeMutate,
    isPending: false,
  }),
}));

const transactions: ViewTransaction[] = [
  {
    id: 1,
    accountId: 'account-1',
    bankName: 'Alpha Bank',
    date: '2026-01-03',
    currencyIsoCode: 'USD',
    amount: -14.25,
    type: 'DEBIT',
    description: 'Coffee shop purchase',
    membershipType: 'MATCHED',
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  },
  {
    id: 2,
    accountId: 'account-2',
    bankName: 'Coffee Credit Union',
    date: '2026-01-04',
    currencyIsoCode: 'USD',
    amount: -42,
    type: 'DEBIT',
    description: 'Hardware store',
    membershipType: 'MATCHED',
    createdAt: '2026-01-04T00:00:00Z',
    updatedAt: '2026-01-04T00:00:00Z',
  },
  {
    id: 3,
    accountId: 'account-3',
    bankName: 'Beta Bank',
    date: '2026-01-05',
    currencyIsoCode: 'USD',
    amount: -8.5,
    type: 'DEBIT',
    description: 'Grocery market',
    membershipType: 'PINNED',
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
  },
];

function renderViewTransactionTable({
  rows = transactions,
  viewId = 'view-1',
  searchText = '',
  onSearchChange = vi.fn(),
}: {
  rows?: ViewTransaction[];
  viewId?: string;
  searchText?: string;
  onSearchChange?: (query: string) => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/views/${viewId}`]}>
        <ViewTransactionTable
          transactions={rows}
          viewId={viewId}
          searchText={searchText}
          onSearchChange={onSearchChange}
          displayCurrency="USD"
          exchangeRatesMap={new Map()}
          isExchangeRatesLoading={false}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { onSearchChange, queryClient, ...result };
}

beforeEach(() => {
  Object.values(mutationMocks).forEach((mock) => mock.mockReset());
});

describe('ViewTransactionTable search', () => {
  it('submits the typed search text when Enter is pressed', () => {
    const onSearchChange = vi.fn();
    renderViewTransactionTable({ onSearchChange });

    const searchInput = screen.getByPlaceholderText('Search descriptions ↵');
    fireEvent.change(searchInput, { target: { value: 'coffee' } });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(onSearchChange).toHaveBeenCalledWith('coffee');
  });

  it('shows the filtered empty state when an applied search has no rows', () => {
    renderViewTransactionTable({ rows: [], searchText: 'coffee' });

    expect(screen.getByText('No transactions match this search.')).toBeInTheDocument();
    expect(screen.queryByText('No transactions in this view.')).not.toBeInTheDocument();
  });

  it('clears the applied search when the clear button is clicked', () => {
    const onSearchChange = vi.fn();
    renderViewTransactionTable({ searchText: 'coffee', onSearchChange });

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('resets the draft search input when the view changes', () => {
    const onSearchChange = vi.fn();
    const { queryClient, rerender } = renderViewTransactionTable({
      searchText: 'coffee',
      onSearchChange,
    });

    const searchInput = screen.getByPlaceholderText('Search descriptions ↵');
    fireEvent.change(searchInput, { target: { value: 'unsubmitted draft' } });

    expect(searchInput).toHaveValue('unsubmitted draft');

    rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/views/view-2']}>
          <ViewTransactionTable
            transactions={transactions}
            viewId="view-2"
            searchText=""
            onSearchChange={onSearchChange}
            displayCurrency="USD"
            exchangeRatesMap={new Map()}
            isExchangeRatesLoading={false}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByPlaceholderText('Search descriptions ↵')).toHaveValue('');
  });
});

describe('ViewTransactionTable bulk actions', () => {
  it('renders select checkboxes for the header and rows', () => {
    renderViewTransactionTable();

    expect(screen.getByRole('checkbox', { name: 'Select all rows on page' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select transaction 1' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select transaction 2' })).toBeInTheDocument();
  });

  it('shows and clears the bulk action bar when rows are selected', async () => {
    renderViewTransactionTable();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));

    expect(screen.getByText('1 transaction selected')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

    await waitFor(() => {
      expect(screen.queryByText('1 transaction selected')).not.toBeInTheDocument();
    });
  });

  it('opens the bulk pin confirmation modal', () => {
    renderViewTransactionTable();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));

    expect(screen.getByRole('heading', { name: 'Pin Transactions' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pin 1 transaction to this view? Pinned transactions stay in the view regardless of filters.',
      ),
    ).toBeInTheDocument();
  });

  it('confirms bulk pin with the view ID and selected IDs', () => {
    renderViewTransactionTable();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    const pinButtons = screen.getAllByRole('button', { name: 'Pin' });
    fireEvent.click(pinButtons[pinButtons.length - 1]);

    expect(mutationMocks.bulkPinMutate).toHaveBeenCalledWith(
      { viewId: 'view-1', ids: [1] },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('opens the bulk exclude confirmation modal', () => {
    renderViewTransactionTable();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exclude' }));

    expect(screen.getByRole('heading', { name: 'Exclude Transactions' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Exclude 1 transaction from this view? Excluded transactions can be restored from Manage Transactions.',
      ),
    ).toBeInTheDocument();
  });

  it('confirms bulk exclude with the view ID and selected IDs', () => {
    renderViewTransactionTable();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exclude' }));
    const excludeButtons = screen.getAllByRole('button', { name: 'Exclude' });
    fireEvent.click(excludeButtons[excludeButtons.length - 1]);

    expect(mutationMocks.bulkExcludeMutate).toHaveBeenCalledWith(
      { viewId: 'view-1', ids: [1] },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('clears selection after a successful bulk action', async () => {
    mutationMocks.bulkPinMutate.mockImplementation((_variables, options) => {
      options.onSuccess({ updatedCount: 1, notFoundIds: [] });
    });
    renderViewTransactionTable();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pin' }));
    const pinButtons = screen.getAllByRole('button', { name: 'Pin' });
    fireEvent.click(pinButtons[pinButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('1 transaction selected')).not.toBeInTheDocument();
    });
  });

  it('disables bulk pin when only already pinned rows are selected', () => {
    renderViewTransactionTable();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 3' }));

    expect(screen.getByRole('button', { name: 'Pin' })).toBeDisabled();
  });
});
