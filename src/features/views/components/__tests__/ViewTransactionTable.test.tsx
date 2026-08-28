import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { ViewTransactionTable } from '@/features/views/components/ViewTransactionTable';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import { projectDisplayAmount } from '@/utils/displayAmount';

vi.mock('@/features/auth/hooks/usePermission');

const mockUsePermission = vi.mocked(usePermission);

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
    accountId: 'savings',
    bankName: 'Second Bank',
    date: '2026-01-16',
    currencyIsoCode: 'USD',
    amount: 20,
    type: 'CREDIT',
    description: 'Salary',
    createdAt: '2026-01-16T00:00:00Z',
    updatedAt: '2026-01-16T00:00:00Z',
  },
];

const emptyFilters: TransactionFilterValues = {
  globalFilter: '',
  dateFilter: { from: null, to: null },
  bankNameFilter: null,
  accountIdFilter: null,
  typeFilter: null,
  amountFilter: { min: null, max: null },
  amountCurrency: null,
};

const callbacks = {
  onSearchChange: vi.fn(),
  onDateFilterChange: vi.fn(),
  onBankNameFilterChange: vi.fn(),
  onAccountIdFilterChange: vi.fn(),
  onTypeFilterChange: vi.fn(),
  onAmountFilterChange: vi.fn(),
  onClearAllFilters: vi.fn(),
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderTable({
  rows = transactions,
  filters = emptyFilters,
  displayAmounts = new Map(
    rows.map((transaction) => [
      transaction.id,
      projectDisplayAmount(transaction, 'USD', new Map()),
    ]),
  ),
  isAmountFilterLoading = false,
  unavailableAmountFilterCount = 0,
}: {
  rows?: Transaction[];
  filters?: TransactionFilterValues;
  displayAmounts?: ReadonlyMap<number, DisplayAmount>;
  isAmountFilterLoading?: boolean;
  unavailableAmountFilterCount?: number;
} = {}) {
  return renderWithProviders(
    <>
      <ViewTransactionTable
        transactions={rows}
        viewId="view-1"
        filters={filters}
        availableBankNames={['Example Bank', 'Second Bank']}
        availableAccountIds={['checking', 'savings']}
        {...callbacks}
        displayCurrency="USD"
        displayAmounts={displayAmounts}
        isDisplayAmountLoading={false}
        isAmountFilterLoading={isAmountFilterLoading}
        unavailableAmountFilterCount={unavailableAmountFilterCount}
      />
      <LocationProbe />
    </>,
    { initialEntries: ['/views/view-1?q=coffee'] },
  );
}

describe('ViewTransactionTable', () => {
  beforeEach(() => {
    mockUsePermission.mockReset();
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
  });

  it('hides membership actions without views:write and preserves row navigation', async () => {
    mockUsePermission.mockReturnValue(false);
    renderTable();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove from view' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Coffee'));
    expect(screen.getByTestId('location')).toHaveTextContent('/transactions/1?');
    expect(screen.getByTestId('location')).toHaveTextContent(
      'returnTo=%2Fviews%2Fview-1%3Fq%3Dcoffee',
    );
  });

  it('shows non-destructive row and selection removal actions with views:write', async () => {
    renderTable();

    expect(
      screen.getByRole('checkbox', { name: 'Select all transactions on this page' }),
    ).toBeInTheDocument();
    const rowRemovalButtons = screen.getAllByRole('button', { name: 'Remove from view' });
    expect(rowRemovalButtons).toHaveLength(2);
    for (const button of rowRemovalButtons) {
      expect(button).toHaveClass('border', 'border-input', 'bg-background');
      expect(button).not.toHaveClass('bg-destructive', 'text-destructive');
    }

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    const removalBar = screen.getByText('1 transaction selected').parentElement;
    expect(removalBar).not.toBeNull();
    const bulkRemovalButton = within(removalBar!).getByRole('button', {
      name: 'Remove from view',
    });
    expect(bulkRemovalButton).toHaveClass('border', 'border-input', 'bg-background');
    expect(bulkRemovalButton).not.toHaveClass('bg-destructive', 'text-destructive');
  });

  it('removes all filtered members rather than only the visible page', async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      ...transactions[0],
      id: index + 1,
      description: `Transaction ${index + 1}`,
    }));
    let requestBody: unknown;
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request }) => {
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderTable({ rows });

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all transactions on this page' }),
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Select all 25 transactions matching this filter',
      }),
    );
    expect(
      screen.getByText('All 25 transactions matching this filter are selected.'),
    ).toBeInTheDocument();

    const removalBar = screen.getByText('25 transactions selected').parentElement;
    expect(removalBar).not.toBeNull();
    await userEvent.click(within(removalBar!).getByRole('button', { name: 'Remove from view' }));
    const dialog = screen.getByRole('heading', { name: 'Remove from view' }).parentElement
      ?.parentElement;
    expect(dialog).not.toBeNull();
    expect(within(dialog!).getByText(/Remove 25 transactions from this view/)).toBeInTheDocument();
    await userEvent.click(within(dialog!).getByRole('button', { name: 'Remove from view' }));

    await waitFor(() =>
      expect(requestBody).toEqual({
        addTransactionIds: [],
        removeTransactionIds: rows.map(({ id }) => id),
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByText('All 25 transactions matching this filter are selected.'),
      ).not.toBeInTheDocument(),
    );
  });

  it('opens row removal without navigating away', async () => {
    renderTable();

    await userEvent.click(screen.getAllByRole('button', { name: 'Remove from view' })[0]);

    expect(screen.getByTestId('location')).toHaveTextContent('/views/view-1?q=coffee');
    expect(screen.getByText(/Remove 1 transaction from this view/)).toBeInTheDocument();
  });

  it('retains bulk selection after cancellation and mutation failure', async () => {
    server.use(
      http.patch('/api/v1/views/:id/transactions', () =>
        HttpResponse.json(
          { type: 'INTERNAL_ERROR', message: 'Membership update failed' },
          { status: 500 },
        ),
      ),
    );
    renderTable();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Select transaction 1' }));
    const selectionStatus = screen.getByText('1 transaction selected');
    const removalBar = selectionStatus.parentElement;
    expect(removalBar).not.toBeNull();
    await userEvent.click(within(removalBar!).getByRole('button', { name: 'Remove from view' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(selectionStatus).toBeInTheDocument();

    await userEvent.click(within(removalBar!).getByRole('button', { name: 'Remove from view' }));
    const dialog = screen.getByRole('heading', { name: 'Remove from view' }).parentElement
      ?.parentElement;
    expect(dialog).not.toBeNull();
    await userEvent.click(within(dialog!).getByRole('button', { name: 'Remove from view' }));

    await waitFor(() =>
      expect(within(dialog!).getByRole('button', { name: 'Remove from view' })).toBeEnabled(),
    );
    expect(selectionStatus).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select transaction 1' })).toBeChecked();
  });

  it('renders empty collection and filtered-empty messages', () => {
    const first = renderTable({ rows: [] });
    expect(screen.getByText('No transactions in this view.')).toBeInTheDocument();

    first.unmount();
    renderTable({ rows: [], filters: { ...emptyFilters, globalFilter: 'missing' } });
    expect(screen.getByText('No transactions match these filters.')).toBeInTheDocument();
  });

  it('forwards local search changes', async () => {
    callbacks.onSearchChange.mockReset();
    renderTable();

    const search = screen.getByPlaceholderText('Search descriptions ↵');
    await userEvent.clear(search);
    await userEvent.type(search, 'salary{Enter}');
    expect(callbacks.onSearchChange).toHaveBeenLastCalledWith('salary');
  });

  it('shows unresolved and unavailable amount-filter states', () => {
    const loading = renderTable({ isAmountFilterLoading: true });
    expect(screen.getByText('Loading filtered amounts...')).toBeInTheDocument();

    loading.unmount();
    renderTable({ unavailableAmountFilterCount: 2 });
    expect(
      screen.getByText('2 transactions were excluded because conversion to USD is unavailable.'),
    ).toBeInTheDocument();
  });

  it('sorts unavailable selected-currency amounts last in both directions', async () => {
    const rows = [
      transactions[0],
      { ...transactions[1], id: 3, currencyIsoCode: 'GBP', description: 'Unavailable' },
      transactions[1],
    ];
    const displayAmounts = new Map(
      rows.map((transaction) => [
        transaction.id,
        projectDisplayAmount(transaction, 'USD', new Map()),
      ]),
    );
    renderTable({ rows, displayAmounts });

    await userEvent.click(screen.getByRole('button', { name: 'Amount' }));
    let tableRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(tableRows[tableRows.length - 1]).toHaveTextContent('Unavailable');

    await userEvent.click(screen.getByRole('button', { name: 'Amount' }));
    tableRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(tableRows[tableRows.length - 1]).toHaveTextContent('Unavailable');
  });
});
