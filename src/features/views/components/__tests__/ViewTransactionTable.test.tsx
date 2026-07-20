import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewTransactionTable } from '@/features/views/components/ViewTransactionTable';
import { renderWithProviders } from '@/testing/test-utils';
import { ViewTransaction } from '@/types/view';
import type { TransactionFilterValues } from '@/types/transactionFilters';

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

const emptyFilters: TransactionFilterValues = {
  globalFilter: '',
  dateFilter: { from: null, to: null },
  bankNameFilter: null,
  accountIdFilter: null,
  typeFilter: null,
  amountFilter: { min: null, max: null },
};

const paginatedTransactions: ViewTransaction[] = Array.from({ length: 21 }, (_, index) => ({
  ...transactions[0],
  id: index + 1,
  description: `Transaction ${index + 1}`,
}));

function renderViewTransactionTable({
  rows = transactions,
  viewId = 'view-1',
  filters = emptyFilters,
  availableBankNames = ['Alpha Bank', 'Beta Bank', 'Coffee Credit Union'],
  availableAccountIds = ['account-1', 'account-2', 'account-3'],
  onSearchChange = vi.fn(),
  onDateFilterChange = vi.fn(),
  onBankNameFilterChange = vi.fn(),
  onAccountIdFilterChange = vi.fn(),
  onTypeFilterChange = vi.fn(),
  onAmountFilterChange = vi.fn(),
  onClearAllFilters = vi.fn(),
}: {
  rows?: ViewTransaction[];
  viewId?: string;
  filters?: TransactionFilterValues;
  availableBankNames?: string[];
  availableAccountIds?: string[];
  onSearchChange?: (query: string) => void;
  onDateFilterChange?: (from: string | null, to: string | null) => void;
  onBankNameFilterChange?: (bankName: string | null) => void;
  onAccountIdFilterChange?: (accountId: string | null) => void;
  onTypeFilterChange?: (type: 'DEBIT' | 'CREDIT' | null) => void;
  onAmountFilterChange?: (min: number | null, max: number | null) => void;
  onClearAllFilters?: () => void;
} = {}) {
  const result = renderWithProviders(
    <ViewTransactionTable
      transactions={rows}
      viewId={viewId}
      filters={filters}
      availableBankNames={availableBankNames}
      availableAccountIds={availableAccountIds}
      onSearchChange={onSearchChange}
      onDateFilterChange={onDateFilterChange}
      onBankNameFilterChange={onBankNameFilterChange}
      onAccountIdFilterChange={onAccountIdFilterChange}
      onTypeFilterChange={onTypeFilterChange}
      onAmountFilterChange={onAmountFilterChange}
      onClearAllFilters={onClearAllFilters}
      displayCurrency="USD"
      exchangeRatesMap={new Map()}
      isExchangeRatesLoading={false}
    />,
    { initialEntries: [`/views/${viewId}`] },
  );

  return {
    onSearchChange,
    onDateFilterChange,
    onBankNameFilterChange,
    onAccountIdFilterChange,
    onTypeFilterChange,
    onAmountFilterChange,
    onClearAllFilters,
    ...result,
  };
}

beforeEach(() => {
  Object.values(mutationMocks).forEach((mock) => mock.mockReset());
});

afterEach(() => {
  vi.useRealTimers();
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
    renderViewTransactionTable({
      rows: [],
      filters: { ...emptyFilters, globalFilter: 'coffee' },
    });

    expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument();
    expect(screen.queryByText('No transactions in this view.')).not.toBeInTheDocument();
  });

  it('clears the applied search when the clear button is clicked', async () => {
    const onSearchChange = vi.fn();
    renderViewTransactionTable({
      filters: { ...emptyFilters, globalFilter: 'coffee' },
      onSearchChange,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('resets the draft search input when the view changes', async () => {
    const onSearchChange = vi.fn();
    const { rerender } = renderViewTransactionTable({
      filters: { ...emptyFilters, globalFilter: 'coffee' },
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
        filters={emptyFilters}
        availableBankNames={['Alpha Bank', 'Beta Bank', 'Coffee Credit Union']}
        availableAccountIds={['account-1', 'account-2', 'account-3']}
        onSearchChange={onSearchChange}
        onDateFilterChange={vi.fn()}
        onBankNameFilterChange={vi.fn()}
        onAccountIdFilterChange={vi.fn()}
        onTypeFilterChange={vi.fn()}
        onAmountFilterChange={vi.fn()}
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
      filters: {
        ...emptyFilters,
        dateFilter: { from: '2026-01-01', to: '2026-01-31' },
      },
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
      filters: {
        ...emptyFilters,
        globalFilter: 'coffee',
        dateFilter: { from: '2026-01-01', to: '2026-01-31' },
      },
      onClearAllFilters,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onClearAllFilters).toHaveBeenCalled();
  });
});

describe('ViewTransactionTable shared filters', () => {
  it('passes bank, account, and type selections to the shared callbacks', async () => {
    const onBankNameFilterChange = vi.fn();
    const onAccountIdFilterChange = vi.fn();
    const onTypeFilterChange = vi.fn();
    renderViewTransactionTable({
      onBankNameFilterChange,
      onAccountIdFilterChange,
      onTypeFilterChange,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Filter by bank' }));
    await userEvent.click(screen.getByRole('button', { name: 'Beta Bank' }));
    expect(onBankNameFilterChange).toHaveBeenCalledWith('Beta Bank');

    await userEvent.click(screen.getByRole('button', { name: 'Filter by account' }));
    await userEvent.click(screen.getByRole('button', { name: 'account-2' }));
    expect(onAccountIdFilterChange).toHaveBeenCalledWith('account-2');

    await userEvent.click(screen.getByRole('button', { name: 'Filter by transaction type' }));
    await userEvent.click(screen.getByRole('button', { name: 'Credit' }));
    expect(onTypeFilterChange).toHaveBeenCalledWith('CREDIT');
  });

  it('uses every filter dimension for the filtered empty state without a contextual action', () => {
    renderViewTransactionTable({
      rows: [],
      filters: {
        ...emptyFilters,
        amountFilter: { min: 100, max: null },
      },
    });

    expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save as view/i })).not.toBeInTheDocument();
  });

  it('preserves unrelated search and amount drafts when an applied filter changes', () => {
    vi.useFakeTimers();
    const onAmountFilterChange = vi.fn();
    const { rerender } = renderViewTransactionTable({ onAmountFilterChange });

    fireEvent.change(screen.getByPlaceholderText('Search descriptions ↵'), {
      target: { value: 'unsubmitted draft' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum amount' }), {
      target: { value: '25' },
    });

    rerender(
      <ViewTransactionTable
        transactions={transactions}
        viewId="view-1"
        filters={{ ...emptyFilters, typeFilter: 'CREDIT' }}
        availableBankNames={['Alpha Bank', 'Beta Bank', 'Coffee Credit Union']}
        availableAccountIds={['account-1', 'account-2', 'account-3']}
        onSearchChange={vi.fn()}
        onDateFilterChange={vi.fn()}
        onBankNameFilterChange={vi.fn()}
        onAccountIdFilterChange={vi.fn()}
        onTypeFilterChange={vi.fn()}
        onAmountFilterChange={onAmountFilterChange}
        onClearAllFilters={vi.fn()}
        displayCurrency="USD"
        exchangeRatesMap={new Map()}
        isExchangeRatesLoading={false}
      />,
    );

    expect(screen.getByPlaceholderText('Search descriptions ↵')).toHaveValue('unsubmitted draft');
    expect(screen.getByRole('spinbutton', { name: 'Minimum amount' })).toHaveValue(25);

    act(() => vi.advanceTimersByTime(400));
    expect(onAmountFilterChange).toHaveBeenCalledWith(25, null);
  });

  it('resets pagination and bulk selection when an applied filter changes', async () => {
    const { rerender } = renderViewTransactionTable({ rows: paginatedTransactions });

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 21' }));
    expect(screen.getByText('Showing 21 to 21 of 21 transactions')).toBeInTheDocument();
    expect(screen.getByText('1 transaction selected')).toBeInTheDocument();

    rerender(
      <ViewTransactionTable
        transactions={paginatedTransactions}
        viewId="view-1"
        filters={{ ...emptyFilters, typeFilter: 'CREDIT' }}
        availableBankNames={['Alpha Bank', 'Beta Bank', 'Coffee Credit Union']}
        availableAccountIds={['account-1', 'account-2', 'account-3']}
        onSearchChange={vi.fn()}
        onDateFilterChange={vi.fn()}
        onBankNameFilterChange={vi.fn()}
        onAccountIdFilterChange={vi.fn()}
        onTypeFilterChange={vi.fn()}
        onAmountFilterChange={vi.fn()}
        onClearAllFilters={vi.fn()}
        displayCurrency="USD"
        exchangeRatesMap={new Map()}
        isExchangeRatesLoading={false}
      />,
    );

    expect(screen.getByText('Showing 1 to 20 of 21 transactions')).toBeInTheDocument();
    expect(screen.queryByText('1 transaction selected')).not.toBeInTheDocument();
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

describe('ViewTransactionTable row membership actions', () => {
  it('pins a matched transaction from the row actions menu', async () => {
    renderViewTransactionTable();

    await userEvent.click(screen.getAllByRole('button', { name: 'Actions' })[1]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Pin to View' }));

    expect(mutationMocks.pinMutate).toHaveBeenCalledWith({ viewId: 'view-1', txnId: 2 });
    expect(mutationMocks.unpinMutate).not.toHaveBeenCalled();
  });

  it('unpins a pinned transaction from the row actions menu', async () => {
    renderViewTransactionTable();

    await userEvent.click(screen.getAllByRole('button', { name: 'Actions' })[0]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Unpin' }));

    expect(mutationMocks.unpinMutate).toHaveBeenCalledWith({ viewId: 'view-1', txnId: 3 });
    expect(mutationMocks.pinMutate).not.toHaveBeenCalled();
  });

  it('excludes a visible transaction from the row actions menu', async () => {
    renderViewTransactionTable();

    await userEvent.click(screen.getAllByRole('button', { name: 'Actions' })[1]);
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Exclude' }));

    expect(mutationMocks.excludeMutate).toHaveBeenCalledWith({ viewId: 'view-1', txnId: 2 });
  });
});
