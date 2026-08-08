import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { act, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/hooks/useTransactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useTransactions')>();
  return {
    ...actual,
    useUpdateTransaction: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  };
});
vi.mock('@/hooks/useViews', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useViews')>();
  return {
    ...actual,
    useViews: () => ({ data: [], isLoading: false }),
    usePinTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

import { usePermission } from '@/features/auth/hooks/usePermission';
import { TransactionTable } from '@/features/transactions/components/TransactionTable';
import { Transaction } from '@/types/transaction';
import type { ExchangeRateResponse } from '@/types/currency';
import { renderWithProviders } from '@/testing/test-utils';
import { buildExchangeRateMap } from '@/utils/currency';

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

beforeAll(() => {
  // Radix DropdownMenu needs these on Element.prototype but jsdom doesn't ship them.
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

type ExchangeRatesMap = Map<string, Map<string, ExchangeRateResponse>>;

function createTable(rows: Transaction[], exchangeRatesMap: ExchangeRatesMap) {
  return (
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

function openFirstRowMenu() {
  const triggers = screen.getAllByRole('button', { name: /open menu/i });
  // Radix DropdownMenu opens on Enter via its keyDown handler. We avoid
  // pointerDown because jsdom doesn't propagate `button` on PointerEvent.
  triggers[0].focus();
  fireEvent.keyDown(triggers[0], { key: 'Enter' });
}

beforeEach(() => {
  mockUsePermission.mockReset();
});

describe('TransactionTable permission gating', () => {
  it('shows the select column and Edit + Delete row actions when all permissions are granted', () => {
    mockUsePermission.mockReturnValue(true);
    renderTable();

    // Header checkbox + one checkbox per row
    expect(screen.getAllByRole('checkbox')).toHaveLength(transactions.length + 1);

    openFirstRowMenu();
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Add to View/ })).toBeInTheDocument();
  });

  it('hides the select column and the Delete action when transactions:delete is missing', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:write');
    renderTable();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    openFirstRowMenu();
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Add to View/ })).toBeInTheDocument();
  });

  it('hides the Edit action but keeps the select column when transactions:write is missing', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:delete');
    renderTable();

    expect(screen.getAllByRole('checkbox')).toHaveLength(transactions.length + 1);

    openFirstRowMenu();
    expect(screen.queryByRole('menuitem', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Add to View/ })).toBeInTheDocument();
  });

  it('leaves only the Add to View action and removes the select column when neither permission is granted', () => {
    mockUsePermission.mockReturnValue(false);
    renderTable();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    openFirstRowMenu();
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
