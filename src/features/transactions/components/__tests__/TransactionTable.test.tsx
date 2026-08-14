import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';

const transactionHookMocks = vi.hoisted(() => ({
  deleteMutate: vi.fn(),
  updateMutate: vi.fn(),
}));

const viewHookState = vi.hoisted(() => ({
  isLoading: false,
  isPinning: false,
  pinMutate: vi.fn(),
  views: [] as unknown[],
}));

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/hooks/useTransactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useTransactions')>();
  return {
    ...actual,
    useUpdateTransaction: () => ({ mutate: transactionHookMocks.updateMutate, isPending: false }),
    useDeleteTransaction: () => ({ mutate: transactionHookMocks.deleteMutate, isPending: false }),
  };
});
vi.mock('@/hooks/useViews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useViews')>();
  return {
    ...actual,
    useViews: () => ({ data: viewHookState.views, isLoading: viewHookState.isLoading }),
    usePinTransaction: () => ({
      mutate: viewHookState.pinMutate,
      isPending: viewHookState.isPinning,
    }),
  };
});

import { usePermission } from '@/features/auth/hooks/usePermission';
import { TransactionTable } from '@/features/transactions/components/TransactionTable';
import { Transaction } from '@/types/transaction';
import type { ExchangeRateResponse } from '@/types/currency';
import { renderWithProviders } from '@/testing/test-utils';
import { buildExchangeRateMap } from '@/utils/currency';
import type { SavedView } from '@/types/view';

const mockUsePermission = vi.mocked(usePermission);
const noop = vi.fn();

const transactions: Transaction[] = [
  {
    id: 1,
    accountId: 'acct-1',
    bankName: 'Test Bank',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: 100,
    type: 'DEBIT',
    description: 'Coffee',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 2,
    accountId: 'acct-1',
    bankName: 'Test Bank',
    date: '2026-01-16',
    currencyIsoCode: 'USD',
    amount: 200,
    type: 'CREDIT',
    description: 'Salary',
    createdAt: '2026-01-16T00:00:00Z',
    updatedAt: '2026-01-16T00:00:00Z',
  },
];

const savedViews: SavedView[] = [
  {
    id: 'monthly-view',
    name: 'Monthly Review',
    criteria: {},
    openEnded: false,
    pinnedCount: 0,
    excludedCount: 0,
    transactionCount: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

type ExchangeRatesMap = Map<string, Map<string, ExchangeRateResponse>>;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function createTable(rows: Transaction[], exchangeRatesMap: ExchangeRatesMap) {
  return (
    <>
      <TransactionTable
        transactions={rows}
        filters={{
          globalFilter: '',
          dateFilter: { from: null, to: null },
          bankNameFilter: null,
          accountIdFilter: null,
          typeFilter: null,
          amountFilter: { min: null, max: null },
        }}
        onDateFilterChange={noop}
        onSearchChange={noop}
        onBankNameFilterChange={noop}
        onAccountIdFilterChange={noop}
        onTypeFilterChange={noop}
        onAmountFilterChange={noop}
        onClearAllFilters={noop}
        displayCurrency="USD"
        exchangeRatesMap={exchangeRatesMap}
        isExchangeRatesLoading={false}
        availableBankNames={['Test Bank']}
        availableAccountIds={['acct-1']}
      />
      <LocationProbe />
    </>
  );
}

function renderTable({
  rows = transactions,
  exchangeRatesMap = new Map(),
}: {
  rows?: Transaction[];
  exchangeRatesMap?: ExchangeRatesMap;
} = {}) {
  return renderWithProviders(createTable(rows, exchangeRatesMap), {
    initialEntries: ['/transactions'],
  });
}

function expectDescriptionOrder(expectedDescriptions: string[]) {
  const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);

  expectedDescriptions.forEach((description, index) => {
    expect(within(rows[index]).getByText(description)).toBeInTheDocument();
  });
}

async function openFirstRowMenu() {
  const user = userEvent.setup();
  const triggers = screen.getAllByRole('button', { name: /open menu/i });
  await user.click(triggers[0]);
}

function expectNoRuntimeStyles(styleCount: number, ...elements: HTMLElement[]) {
  expect(document.querySelectorAll('style')).toHaveLength(styleCount);
  elements.forEach((element) => {
    expect(element).not.toHaveAttribute('style');
    expect(element.querySelector('[style]')).toBeNull();
  });
}

beforeEach(() => {
  mockUsePermission.mockReset();
  transactionHookMocks.deleteMutate.mockReset();
  transactionHookMocks.updateMutate.mockReset();
  viewHookState.isLoading = false;
  viewHookState.isPinning = false;
  viewHookState.pinMutate.mockReset();
  viewHookState.views = [];
});

describe('TransactionTable permission gating', () => {
  it('shows the select column and Edit + Delete row actions when all permissions are granted', async () => {
    mockUsePermission.mockReturnValue(true);
    renderTable();

    // Header checkbox + one checkbox per row
    expect(screen.getAllByRole('checkbox')).toHaveLength(transactions.length + 1);

    await openFirstRowMenu();
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Add to View/ })).toBeInTheDocument();
  });

  it('hides the select column and the Delete action when transactions:delete is missing', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:write');
    renderTable();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    await openFirstRowMenu();
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Add to View/ })).toBeInTheDocument();
  });

  it('hides the Edit action but keeps the select column when transactions:write is missing', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:delete');
    renderTable();

    expect(screen.getAllByRole('checkbox')).toHaveLength(transactions.length + 1);

    await openFirstRowMenu();
    expect(screen.queryByRole('menuitem', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Add to View/ })).toBeInTheDocument();
  });

  it('leaves only the Add to View action and removes the select column when neither permission is granted', async () => {
    mockUsePermission.mockReturnValue(false);
    renderTable();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    await openFirstRowMenu();
    expect(screen.queryByRole('menuitem', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Add to View/ })).toBeInTheDocument();
  });

  it('renders the table headers without the select column when transactions:delete is missing', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:write');
    renderTable();

    const table = screen.getByRole('table');
    const headerRow = within(table).getAllByRole('row')[0];
    // Date, Description, Bank, Account, Type, Amount, Actions = 7 columns. No select.
    expect(within(headerRow).getAllByRole('columnheader')).toHaveLength(7);
  });

  it('includes the select column header when transactions:delete is granted', () => {
    mockUsePermission.mockReturnValue(true);
    renderTable();

    const table = screen.getByRole('table');
    const headerRow = within(table).getAllByRole('row')[0];
    // Select + Date, Description, Bank, Account, Type, Amount, Actions = 8 columns.
    expect(within(headerRow).getAllByRole('columnheader')).toHaveLength(8);
  });
});

describe('TransactionTable Add to View submenu', () => {
  it('pins from pointer interaction without triggering row, edit, or delete behavior', async () => {
    mockUsePermission.mockReturnValue(true);
    viewHookState.views = savedViews;
    const user = userEvent.setup();
    const styleCount = document.querySelectorAll('style').length;
    renderTable();

    const row = screen.getByText('Salary').closest('tr');
    expect(row).not.toBeNull();
    const trigger = within(row as HTMLTableRowElement).getByRole('button', { name: 'Open menu' });
    await user.click(trigger);
    const parentMenu = screen.getByRole('menu');
    await user.hover(screen.getByRole('menuitem', { name: 'Add to View' }));
    const submenu = screen.getAllByRole('menu')[1];
    await user.click(screen.getByRole('menuitem', { name: 'Monthly Review' }));

    expect(viewHookState.pinMutate).toHaveBeenCalledOnce();
    expect(viewHookState.pinMutate).toHaveBeenCalledWith(
      { viewId: 'monthly-view', txnId: 2 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/transactions');
    expect(screen.queryByRole('heading', { name: 'Delete Transaction' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(transactionHookMocks.updateMutate).not.toHaveBeenCalled();
    expect(transactionHookMocks.deleteMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expectNoRuntimeStyles(styleCount, trigger, parentMenu, submenu);
  });

  it('opens with ArrowRight and pins the selected view exactly once by keyboard', async () => {
    mockUsePermission.mockReturnValue(false);
    viewHookState.views = savedViews;
    const user = userEvent.setup();
    renderTable();

    const trigger = screen.getAllByRole('button', { name: 'Open menu' })[0];
    trigger.focus();
    await user.keyboard('{Enter}');
    const addToView = screen.getByRole('menuitem', { name: 'Add to View' });
    expect(addToView).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menuitem', { name: 'Monthly Review' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(viewHookState.pinMutate).toHaveBeenCalledOnce();
    expect(viewHookState.pinMutate).toHaveBeenCalledWith(
      { viewId: 'monthly-view', txnId: 2 },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/transactions');
  });

  it.each([
    { label: 'views are loading', isLoading: true, isPinning: false },
    { label: 'a pin is pending', isLoading: false, isPinning: true },
  ])('does not activate the submenu when $label', async ({ isLoading, isPinning }) => {
    mockUsePermission.mockReturnValue(false);
    viewHookState.views = savedViews;
    viewHookState.isLoading = isLoading;
    viewHookState.isPinning = isPinning;
    const user = userEvent.setup();
    renderTable();

    const trigger = screen.getAllByRole('button', { name: 'Open menu' })[0];
    await user.click(trigger);
    const addToView = screen.getByRole('menuitem', { name: 'Add to View' });
    expect(addToView).toBeDisabled();
    addToView.focus();
    await user.keyboard('{ArrowRight}{Enter}');

    expect(screen.queryByRole('menuitem', { name: 'Monthly Review' })).not.toBeInTheDocument();
    expect(viewHookState.pinMutate).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/transactions');
  });
});

describe('TransactionTable sorting', () => {
  const mixedCurrencyTransactions: Transaction[] = [
    {
      ...transactions[0],
      id: 10,
      amount: -1_000,
      currencyIsoCode: 'JPY',
      description: 'JPY debit',
    },
    {
      ...transactions[1],
      id: 11,
      date: transactions[0].date,
      amount: -20,
      currencyIsoCode: 'USD',
      type: 'DEBIT',
      description: 'USD debit',
    },
  ];
  const exchangeRatesMap = buildExchangeRateMap([
    {
      baseCurrency: 'USD',
      targetCurrency: 'JPY',
      date: transactions[0].date,
      rate: 100,
    },
  ]);

  it('sorts signed mixed-currency amounts by USD equivalents in both directions', async () => {
    mockUsePermission.mockReturnValue(false);
    renderTable({ rows: mixedCurrencyTransactions, exchangeRatesMap });

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['USD debit', 'JPY debit']);

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['JPY debit', 'USD debit']);
  });

  it('recalculates an active Amount sort when exchange rates arrive', async () => {
    mockUsePermission.mockReturnValue(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = renderTable({ rows: mixedCurrencyTransactions });

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['JPY debit', 'USD debit']);

    await act(async () => {
      rerender(createTable(mixedCurrencyTransactions, exchangeRatesMap));
    });

    expectDescriptionOrder(['USD debit', 'JPY debit']);
    warnSpy.mockRestore();
  });

  it('returns to the first page when the current sort direction changes', async () => {
    mockUsePermission.mockReturnValue(false);
    const paginatedTransactions = Array.from({ length: 11 }, (_, index) => ({
      ...transactions[0],
      id: index + 1,
      amount: index + 1,
      description: `Transaction ${index + 1}`,
    }));
    renderTable({ rows: paginatedTransactions });

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Showing 11 to 11 of 11 transactions')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Date/ }));

    expect(screen.getByText('Showing 1 to 10 of 11 transactions')).toBeInTheDocument();
  });
});
