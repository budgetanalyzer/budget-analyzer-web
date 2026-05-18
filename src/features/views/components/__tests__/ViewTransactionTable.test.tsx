import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewTransactionTable } from '@/features/views/components/ViewTransactionTable';
import { renderWithProviders } from '@/testing/test-utils';
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
  dateFilter = { from: null, to: null },
  hasActiveFilters = false,
  onSearchChange = vi.fn(),
  onDateFilterChange = vi.fn(),
  onClearAllFilters = vi.fn(),
}: {
  rows?: ViewTransaction[];
  viewId?: string;
  searchText?: string;
  dateFilter?: { from: string | null; to: string | null };
  hasActiveFilters?: boolean;
  onSearchChange?: (query: string) => void;
  onDateFilterChange?: (from: string | null, to: string | null) => void;
  onClearAllFilters?: () => void;
} = {}) {
  const result = renderWithProviders(
    <ViewTransactionTable
      transactions={rows}
      viewId={viewId}
      searchText={searchText}
      dateFilter={dateFilter}
      hasActiveFilters={hasActiveFilters}
      onSearchChange={onSearchChange}
      onDateFilterChange={onDateFilterChange}
      onClearAllFilters={onClearAllFilters}
      displayCurrency="USD"
      exchangeRatesMap={new Map()}
      isExchangeRatesLoading={false}
    />,
    { initialEntries: [`/views/${viewId}`] },
  );

  return { onSearchChange, onDateFilterChange, onClearAllFilters, ...result };
}

beforeEach(() => {
  Object.values(mutationMocks).forEach((mock) => mock.mockReset());
});

describe('ViewTransactionTable search', () => {
  it('submits the typed search text when Enter is pressed', async () => {
    const onSearchChange = vi.fn();
    renderViewTransactionTable({ onSearchChange });

    const searchInput = screen.getByPlaceholderText('Search descriptions ↵');
    await userEvent.type(searchInput, 'coffee{Enter}');

    expect(onSearchChange).toHaveBeenCalledWith('coffee');
  });

  it('shows the filtered empty state when an applied search has no rows', () => {
    renderViewTransactionTable({ rows: [], searchText: 'coffee', hasActiveFilters: true });

    expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument();
    expect(screen.queryByText('No transactions in this view.')).not.toBeInTheDocument();
  });

  it('clears the applied search when the clear button is clicked', async () => {
    const onSearchChange = vi.fn();
    renderViewTransactionTable({ searchText: 'coffee', onSearchChange });

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('resets the draft search input when the view changes', async () => {
    const onSearchChange = vi.fn();
    const { rerender } = renderViewTransactionTable({
      searchText: 'coffee',
      onSearchChange,
    });

    const searchInput = screen.getByPlaceholderText('Search descriptions ↵');
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'unsubmitted draft');

    expect(searchInput).toHaveValue('unsubmitted draft');

    rerender(
      <ViewTransactionTable
        transactions={transactions}
        viewId="view-2"
        searchText=""
        dateFilter={{ from: null, to: null }}
        hasActiveFilters={false}
        onSearchChange={onSearchChange}
        onDateFilterChange={vi.fn()}
        onClearAllFilters={vi.fn()}
        displayCurrency="USD"
        exchangeRatesMap={new Map()}
        isExchangeRatesLoading={false}
      />,
    );

    expect(screen.getByPlaceholderText('Search descriptions ↵')).toHaveValue('');
  });
});

describe('ViewTransactionTable date filters', () => {
  it('renders the active date filters', () => {
    renderViewTransactionTable({
      dateFilter: { from: '2026-01-01', to: '2026-01-31' },
      hasActiveFilters: true,
    });

    expect(screen.getByDisplayValue('2026-01-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-01-31')).toBeInTheDocument();
  });

  it('calls the date filter callback when a date changes', async () => {
    const onDateFilterChange = vi.fn();
    renderViewTransactionTable({ onDateFilterChange });

    await userEvent.type(screen.getByPlaceholderText('From date'), '2026-01-01');

    expect(onDateFilterChange).toHaveBeenCalledWith('2026-01-01', null);
  });

  it('clears search and date filters from the clear action', async () => {
    const onClearAllFilters = vi.fn();
    renderViewTransactionTable({
      searchText: 'coffee',
      dateFilter: { from: '2026-01-01', to: '2026-01-31' },
      hasActiveFilters: true,
      onClearAllFilters,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClearAllFilters).toHaveBeenCalled();
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

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));

    expect(screen.getByText('1 transaction selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

    await waitFor(() => {
      expect(screen.queryByText('1 transaction selected')).not.toBeInTheDocument();
    });
  });

  it('opens the bulk pin confirmation modal', async () => {
    renderViewTransactionTable();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pin' }));

    expect(screen.getByRole('heading', { name: 'Pin Transactions' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pin 1 transaction to this view? Pinned transactions stay in the view regardless of filters.',
      ),
    ).toBeInTheDocument();
  });

  it('confirms bulk pin with the view ID and selected IDs', async () => {
    renderViewTransactionTable();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pin' }));
    const pinButtons = screen.getAllByRole('button', { name: 'Pin' });
    await userEvent.click(pinButtons[pinButtons.length - 1]);

    expect(mutationMocks.bulkPinMutate).toHaveBeenCalledWith(
      { viewId: 'view-1', ids: [1] },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('opens the bulk exclude confirmation modal', async () => {
    renderViewTransactionTable();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Exclude' }));

    expect(screen.getByRole('heading', { name: 'Exclude Transactions' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Exclude 1 transaction from this view? Excluded transactions can be restored from the Restore Excluded action.',
      ),
    ).toBeInTheDocument();
  });

  it('confirms bulk exclude with the view ID and selected IDs', async () => {
    renderViewTransactionTable();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Exclude' }));
    const excludeButtons = screen.getAllByRole('button', { name: 'Exclude' });
    await userEvent.click(excludeButtons[excludeButtons.length - 1]);

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

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Pin' }));
    const pinButtons = screen.getAllByRole('button', { name: 'Pin' });
    await userEvent.click(pinButtons[pinButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('1 transaction selected')).not.toBeInTheDocument();
    });
  });

  it('disables bulk pin when only already pinned rows are selected', async () => {
    renderViewTransactionTable();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 3' }));

    expect(screen.getByRole('button', { name: 'Pin' })).toBeDisabled();
  });
});
