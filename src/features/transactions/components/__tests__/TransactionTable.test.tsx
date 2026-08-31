import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';

const saveAsViewButtonProps = vi.hoisted(() => ({
  current: undefined as { transactionIds: number[]; isTransactionIdsReady: boolean } | undefined,
}));

vi.mock('@/features/auth/hooks/usePermission');
vi.mock('@/components/SaveAsViewButton', () => ({
  SaveAsViewButton: (props: { transactionIds: number[]; isTransactionIdsReady: boolean }) => {
    saveAsViewButtonProps.current = props;
    return (
      <button type="button" disabled={!props.isTransactionIdsReady}>
        Save as View
      </button>
    );
  },
}));
import { usePermission } from '@/features/auth/hooks/usePermission';
import { TransactionTable } from '@/features/transactions/components/TransactionTable';
import { useTransactions } from '@/hooks/useTransactions';
import { Transaction } from '@/types/transaction';
import type { ExchangeRateResponse } from '@/types/currency';
import { renderWithProviders } from '@/testing/test-utils';
import { buildExchangeRateMap } from '@/utils/currency';
import { projectDisplayAmount } from '@/utils/displayAmount';
import { server } from '@/testing/mocks/server';
import { transactionKeys, viewKeys } from '@/queryKeys';

const mockUsePermission = vi.mocked(usePermission);
const noop = vi.fn();

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

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

type ExchangeRatesMap = Map<string, Map<string, ExchangeRateResponse>>;

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function createTable(
  rows: Transaction[],
  exchangeRatesMap: ExchangeRatesMap,
  displayCurrency = 'USD',
  options: {
    isAmountFilterLoading?: boolean;
    unavailableAmountFilterCount?: number;
    includeViewAction?: boolean;
    amountMin?: number;
    addMode?: {
      memberTransactionIds: number[];
      onCancel?: () => void;
      onSuccess?: () => void;
    };
  } = {},
) {
  const displayAmounts = new Map(
    rows.map((transaction) => [
      transaction.id,
      projectDisplayAmount(transaction, displayCurrency, exchangeRatesMap),
    ]),
  );

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
          amountFilter: {
            min: options.amountMin ?? null,
            max: null,
          },
          amountCurrency: options.amountMin !== undefined ? displayCurrency : null,
        }}
        onDateFilterChange={noop}
        onSearchChange={noop}
        onBankNameFilterChange={noop}
        onAccountIdFilterChange={noop}
        onTypeFilterChange={noop}
        onAmountFilterChange={noop}
        onClearAllFilters={noop}
        displayCurrency={displayCurrency}
        displayAmounts={displayAmounts}
        isDisplayAmountLoading={false}
        isAmountFilterLoading={options.isAmountFilterLoading ?? false}
        unavailableAmountFilterCount={options.unavailableAmountFilterCount ?? 0}
        availableBankNames={['Test Bank']}
        availableAccountIds={['acct-1']}
        viewTransactionIds={options.includeViewAction ? rows.map(({ id }) => id) : undefined}
        isViewTransactionIdsReady={!options.isAmountFilterLoading}
        selectionPurpose={
          options.addMode
            ? {
                type: 'add-to-view',
                viewId: '11111111-1111-4111-8111-111111111111',
                viewName: 'Static collection',
                memberTransactionIds: options.addMode.memberTransactionIds,
                onCancel: options.addMode.onCancel ?? noop,
                onSuccess: options.addMode.onSuccess ?? noop,
              }
            : { type: 'delete' }
        }
      />
      <LocationProbe />
    </>
  );
}

function renderTable({
  rows = transactions,
  exchangeRatesMap = new Map(),
  displayCurrency = 'USD',
  options,
}: {
  rows?: Transaction[];
  exchangeRatesMap?: ExchangeRatesMap;
  displayCurrency?: string;
  options?: Parameters<typeof createTable>[3];
} = {}) {
  return renderWithProviders(createTable(rows, exchangeRatesMap, displayCurrency, options), {
    initialEntries: ['/transactions'],
  });
}

function QueryBackedTable() {
  const { data } = useTransactions();

  return data ? createTable(data, new Map()) : <div>Loading transactions...</div>;
}

function renderQueryBackedTable() {
  return renderWithProviders(<QueryBackedTable />, {
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

beforeEach(() => {
  mockUsePermission.mockReset();
  saveAsViewButtonProps.current = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
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
    expect(screen.queryByRole('menuitem', { name: /Add to View/ })).not.toBeInTheDocument();
  });

  it('hides the select column and the Delete action when transactions:delete is missing', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:write');
    renderTable();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    await openFirstRowMenu();
    expect(screen.getByRole('menuitem', { name: /Edit/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Add to View/ })).not.toBeInTheDocument();
  });

  it('hides the Edit action but keeps the select column when transactions:write is missing', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'transactions:delete');
    renderTable();

    expect(screen.getAllByRole('checkbox')).toHaveLength(transactions.length + 1);

    await openFirstRowMenu();
    expect(screen.queryByRole('menuitem', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Delete/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Add to View/ })).not.toBeInTheDocument();
  });

  it('removes saved-view and transaction actions when permissions are denied', async () => {
    mockUsePermission.mockReturnValue(false);
    renderTable({ options: { includeViewAction: true } });

    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Save as View' })).not.toBeInTheDocument();

    await openFirstRowMenu();
    expect(screen.queryByRole('menuitem', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Add to View/ })).not.toBeInTheDocument();
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

  it('passes only the selected-currency projection to row deletion confirmation', async () => {
    const eurTransaction = {
      ...transactions[0],
      currencyIsoCode: 'EUR',
      amount: 100,
    };
    const exchangeRatesMap = buildExchangeRateMap([
      {
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        date: eurTransaction.date,
        publishedDate: eurTransaction.date,
        rate: 0.5,
      },
    ]);
    const user = userEvent.setup();
    mockUsePermission.mockReturnValue(true);
    renderTable({ rows: [eurTransaction], exchangeRatesMap });

    await openFirstRowMenu();
    await user.click(screen.getByRole('menuitem', { name: /Delete/ }));

    const dialog = screen.getByRole('dialog', { name: 'Delete transaction' });
    expect(within(dialog).getByText('$200.00')).toBeInTheDocument();
    expect(within(dialog).queryByText('€100.00')).not.toBeInTheDocument();
  });
});

describe('TransactionTable bulk deletion', () => {
  it.each([
    {
      resultName: 'full deletion',
      response: { deletedCount: 2, notFoundIds: [] },
    },
    {
      resultName: 'partial deletion',
      response: { deletedCount: 1, notFoundIds: [2] },
    },
    {
      resultName: 'all selected transactions already absent',
      response: { deletedCount: 0, notFoundIds: [1, 2] },
    },
  ])(
    'clears selection and converges on the refreshed table after $resultName',
    async ({ response }) => {
      let bulkDeleteCompleted = false;
      let transactionRequestCount = 0;
      let requestBody: unknown;
      server.use(
        http.get('/api/v1/transactions', () => {
          transactionRequestCount += 1;
          return HttpResponse.json(bulkDeleteCompleted ? [] : transactions);
        }),
        http.post('/api/v1/transactions/bulk-delete', async ({ request }) => {
          requestBody = await request.json();
          bulkDeleteCompleted = true;
          return HttpResponse.json(response);
        }),
      );
      const user = userEvent.setup();
      mockUsePermission.mockReturnValue(true);
      renderQueryBackedTable();

      await screen.findByText('Salary');
      await user.click(
        screen.getByRole('checkbox', {
          name: 'Select transactions on this page for deletion',
        }),
      );
      expect(screen.getByText('2 transactions selected')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      const dialog = screen.getByRole('dialog', { name: 'Delete transactions' });
      await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(transactionRequestCount).toBeGreaterThan(1);
        expect(screen.queryByText('Coffee')).not.toBeInTheDocument();
        expect(screen.queryByText('Salary')).not.toBeInTheDocument();
      });
      expect(requestBody).toEqual({ ids: [1, 2] });
      await waitFor(() => {
        expect(screen.queryByText('2 transactions selected')).not.toBeInTheDocument();
      });
      expect(
        screen.queryByRole('heading', { name: 'Delete transactions' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    },
  );
});

describe('TransactionTable inline editing', () => {
  it('keeps both drafts and a full-width row alert after failure, then supports dismissal and cancellation', async () => {
    let requestBody: unknown;
    server.use(
      http.get('/api/v1/transactions', () => HttpResponse.json(transactions)),
      http.patch('/api/v1/transactions/:id', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          { type: 'SERVICE_UNAVAILABLE', message: 'Inline update unavailable' },
          { status: 503 },
        );
      }),
    );
    const user = userEvent.setup();
    mockUsePermission.mockReturnValue(true);
    renderQueryBackedTable();

    await screen.findByText('Salary');
    await openFirstRowMenu();
    await user.click(screen.getByRole('menuitem', { name: /Edit/ }));
    const descriptionInput = screen.getByDisplayValue('Salary');
    const accountInput = screen.getByDisplayValue('acct-1');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Rejected salary update');
    await user.clear(accountInput);
    await user.type(accountInput, 'acct-2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Inline update unavailable');
    expect(requestBody).toEqual({
      description: 'Rejected salary update',
      accountId: 'acct-2',
    });
    expect(descriptionInput).toHaveValue('Rejected salary update');
    expect(accountInput).toHaveValue('acct-2');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    const editedRow = descriptionInput.closest('tr');
    const alertRow = alert.closest('tr');
    const alertCell = alert.closest('td') as HTMLTableCellElement;
    const headerCells = within(screen.getByRole('table')).getAllByRole('columnheader');
    expect(editedRow?.nextElementSibling).toBe(alertRow);
    expect(alertCell.colSpan).toBe(headerCells.length);

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(descriptionInput).toHaveValue('Rejected salary update');
    expect(accountInput).toHaveValue('acct-2');

    await user.click(accountInput);
    await user.keyboard('{Escape}');
    expect(screen.queryByDisplayValue('Rejected salary update')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('acct-2')).not.toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
  });

  it('clears the alert before retry and closes only after accepted server data arrives', async () => {
    const retryResponse = createDeferredPromise();
    const requestBodies: unknown[] = [];
    let requestCount = 0;
    const acceptedTransaction = {
      ...transactions[1],
      description: 'Accepted salary update',
      accountId: 'acct-2',
      updatedAt: '2026-01-17T00:00:00Z',
    };
    server.use(
      http.get('/api/v1/transactions', () => HttpResponse.json(transactions)),
      http.patch('/api/v1/transactions/:id', async ({ request }) => {
        requestCount += 1;
        requestBodies.push(await request.json());

        if (requestCount === 1) {
          return HttpResponse.json(
            { type: 'SERVICE_UNAVAILABLE', message: 'Try the inline update again' },
            { status: 503 },
          );
        }

        await retryResponse.promise;
        return HttpResponse.json(acceptedTransaction);
      }),
    );
    const user = userEvent.setup();
    mockUsePermission.mockReturnValue(true);
    renderQueryBackedTable();

    await screen.findByText('Salary');
    await openFirstRowMenu();
    await user.click(screen.getByRole('menuitem', { name: /Edit/ }));
    const descriptionInput = screen.getByDisplayValue('Salary');
    const accountInput = screen.getByDisplayValue('acct-1');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Accepted salary update');
    await user.clear(accountInput);
    await user.type(accountInput, 'acct-2');

    const saveButton = screen.getByRole('button', { name: 'Save' });
    saveButton.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Try the inline update again');
    expect(descriptionInput).toHaveValue('Accepted salary update');
    expect(accountInput).toHaveValue('acct-2');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(requestCount).toBe(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(descriptionInput).toHaveValue('Accepted salary update');
    expect(accountInput).toHaveValue('acct-2');
    expect(descriptionInput).toBeDisabled();
    expect(accountInput).toBeDisabled();

    await act(async () => retryResponse.resolve());

    expect(await screen.findByText('Accepted salary update')).toBeInTheDocument();
    expect(screen.getByText('acct-2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(requestBodies).toEqual([
      { description: 'Accepted salary update', accountId: 'acct-2' },
      { description: 'Accepted salary update', accountId: 'acct-2' },
    ]);
  });

  it('closes a no-change edit without making an update request', async () => {
    const updateRequest = vi.fn();
    server.use(
      http.get('/api/v1/transactions', () => HttpResponse.json(transactions)),
      http.patch('/api/v1/transactions/:id', () => {
        updateRequest();
        return HttpResponse.json(transactions[1]);
      }),
    );
    const user = userEvent.setup();
    mockUsePermission.mockReturnValue(true);
    renderQueryBackedTable();

    await screen.findByText('Salary');
    await openFirstRowMenu();
    await user.click(screen.getByRole('menuitem', { name: /Edit/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByText('Salary')).toBeInTheDocument();
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
      publishedDate: transactions[0].date,
      rate: 100,
    },
  ]);

  it('sorts signed mixed-currency amounts by selected-currency values in both directions', async () => {
    mockUsePermission.mockReturnValue(false);
    renderTable({ rows: mixedCurrencyTransactions, exchangeRatesMap });

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['JPY debit', 'USD debit']);

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['USD debit', 'JPY debit']);
  });

  it('recalculates an active Amount sort when exchange rates arrive', async () => {
    mockUsePermission.mockReturnValue(false);
    const rows = mixedCurrencyTransactions;
    const { rerender } = renderTable({ rows });

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['USD debit', 'JPY debit']);

    await act(async () => {
      rerender(createTable(rows, exchangeRatesMap));
    });

    expectDescriptionOrder(['JPY debit', 'USD debit']);
  });

  it('reorders an active Amount sort when the selected currency changes by date', async () => {
    mockUsePermission.mockReturnValue(false);
    const rows = [
      { ...transactions[0], id: 20, amount: 100, description: 'Older USD' },
      { ...transactions[1], id: 21, amount: 150, description: 'Newer USD' },
    ];
    const datedRates = buildExchangeRateMap([
      {
        baseCurrency: 'USD',
        targetCurrency: 'JPY',
        date: rows[0].date,
        publishedDate: rows[0].date,
        rate: 2,
      },
      {
        baseCurrency: 'USD',
        targetCurrency: 'JPY',
        date: rows[1].date,
        publishedDate: rows[1].date,
        rate: 0.5,
      },
    ]);
    const { rerender } = renderTable({ rows, exchangeRatesMap: datedRates });

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['Older USD', 'Newer USD']);

    await act(async () => {
      rerender(createTable(rows, datedRates, 'JPY'));
    });
    expectDescriptionOrder(['Newer USD', 'Older USD']);
  });

  it('uses LocalDate and ID tie-breakers for equal displayed values', async () => {
    mockUsePermission.mockReturnValue(false);
    const rows = [
      { ...transactions[0], id: 31, date: '2026-01-16', amount: 10, description: 'Later high ID' },
      { ...transactions[0], id: 29, date: '2026-01-15', amount: 10, description: 'Earlier' },
      { ...transactions[0], id: 30, date: '2026-01-16', amount: 10, description: 'Later low ID' },
    ];
    renderTable({ rows });

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['Earlier', 'Later low ID', 'Later high ID']);

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['Later high ID', 'Later low ID', 'Earlier']);
  });

  it('keeps unavailable display amounts last in both directions', async () => {
    mockUsePermission.mockReturnValue(false);
    const rows = [
      { ...transactions[0], id: 40, amount: 10, description: 'Available low' },
      {
        ...transactions[0],
        id: 41,
        amount: 500,
        currencyIsoCode: 'GBP',
        description: 'Unavailable',
      },
      { ...transactions[0], id: 42, amount: 20, description: 'Available high' },
    ];
    renderTable({ rows });

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['Available low', 'Available high', 'Unavailable']);

    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expectDescriptionOrder(['Available high', 'Available low', 'Unavailable']);
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

describe('TransactionTable presentation pagination and amount readiness', () => {
  it('paginates for presentation while select-all matching retains the complete row set', async () => {
    mockUsePermission.mockReturnValue(true);
    const rows = Array.from({ length: 11 }, (_, index) => ({
      ...transactions[0],
      id: index + 1,
      description: `Transaction ${index + 1}`,
    }));
    const user = userEvent.setup();
    renderTable({ rows });

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11);
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(
      screen.getByRole('button', { name: 'Select all 11 transactions matching this filter' }),
    );

    expect(screen.getByText('11 transactions selected')).toBeInTheDocument();
  });

  it('shows amount loading, unavailable exclusions, and disables saving while unresolved', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    const rendered = renderTable({
      options: { isAmountFilterLoading: true, includeViewAction: true, amountMin: 10 },
    });

    expect(screen.getByText('Loading filtered amounts...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as View' })).toBeDisabled();

    rendered.unmount();
    renderTable({
      options: {
        unavailableAmountFilterCount: 2,
        includeViewAction: true,
        amountMin: 10,
      },
    });
    expect(
      screen.getByText('2 transactions were excluded because conversion to USD is unavailable.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as View' })).toBeEnabled();
  });

  it('shows saving for a settled unfiltered snapshot and passes its exact ids', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    renderTable({ options: { includeViewAction: true } });

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as View' })).toBeEnabled();
    expect(saveAsViewButtonProps.current).toEqual({
      transactionIds: [1, 2],
      isTransactionIdsReady: true,
    });
  });

  it('passes an initially empty settled snapshot to the creation action', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    renderTable({ rows: [], options: { includeViewAction: true } });

    expect(screen.getByRole('button', { name: 'Save as View' })).toBeEnabled();
    expect(saveAsViewButtonProps.current).toEqual({
      transactionIds: [],
      isTransactionIdsReady: true,
    });
  });
});

describe('TransactionTable add-to-view selection', () => {
  it('uses views:write independently and disables existing members', () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    renderTable({ options: { addMode: { memberTransactionIds: [1] } } });

    expect(
      screen.getByRole('checkbox', { name: 'Transaction 1 is already in Static collection' }),
    ).toBeDisabled();
    expect(screen.getByText('Already in view')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: 'Select transaction 2 to add to Static collection',
      }),
    ).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('keeps page and all-matching selection limited to interleaved nonmembers', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    const rows = Array.from({ length: 12 }, (_, index) => ({
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
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderTable({
      rows,
      options: { addMode: { memberTransactionIds: [2, 7], onSuccess } },
    });

    await user.click(
      screen.getByRole('checkbox', { name: 'Select eligible transactions on this page' }),
    );
    expect(
      screen.getByText('All 8 eligible transactions on this page are selected.'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Select all 10 eligible transactions matching this filter',
      }),
    );
    expect(screen.getByText('10 transactions selected to add')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(requestBody).toEqual({
      addTransactionIds: [1, 3, 4, 5, 6, 8, 9, 10, 11, 12],
      removeTransactionIds: [],
    });
  });

  it('disables an empty or unresolved submission and supports cancel', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderTable({
      options: {
        addMode: { memberTransactionIds: [], onCancel },
        isAmountFilterLoading: true,
      },
    });

    const submit = screen.getByRole('button', { name: 'Add transactions' });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('retains selection after a stale addition and requires a selection review', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    server.use(
      http.patch('/api/v1/views/:id/transactions', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            code: 'SAVED_VIEW_MEMBERSHIP_STALE',
            message: 'Snapshot changed',
          },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTable({ options: { addMode: { memberTransactionIds: [1] } } });

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select transaction 2 to add to Static collection',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));

    expect(
      await screen.findByText(/Membership and transactions were refreshed; review your selection/),
    ).toBeInTheDocument();
    expect(screen.getByText('1 transaction selected to add')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeDisabled();

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select transaction 2 to add to Static collection',
      }),
    );
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeDisabled();
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select transaction 2 to add to Static collection',
      }),
    );
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeEnabled();
  });

  it('keeps stale recovery attached when selection changes during delayed refreshes', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    const rows = [
      ...transactions,
      {
        ...transactions[0],
        id: 3,
        description: 'Transaction 3',
      },
    ];
    const transactionRefresh = createDeferredPromise();
    const membershipRefresh = createDeferredPromise();
    server.use(
      http.patch('/api/v1/views/:id/transactions', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            code: 'SAVED_VIEW_MEMBERSHIP_STALE',
            message: 'Snapshot changed',
          },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    const { queryClient } = renderTable({
      rows,
      options: { addMode: { memberTransactionIds: [1] } },
    });
    const invalidateSpy = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockImplementation((filters) => {
        const queryKey = filters?.queryKey;
        if (queryKey === transactionKeys.list()) {
          return transactionRefresh.promise;
        }
        if (
          JSON.stringify(queryKey) ===
          JSON.stringify(viewKeys.membership('11111111-1111-4111-8111-111111111111'))
        ) {
          return membershipRefresh.promise;
        }
        return Promise.resolve();
      });

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select transaction 2 to add to Static collection',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(4));

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select transaction 3 to add to Static collection',
      }),
    );
    expect(screen.getByText('2 transactions selected to add')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled();

    await act(async () => transactionRefresh.resolve());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adding...' })).toBeDisabled());

    await act(async () => membershipRefresh.resolve());
    expect(
      await screen.findByText(/Membership and transactions were refreshed; review your selection/),
    ).toBeInTheDocument();
    expect(screen.getByText('2 transactions selected to add')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeDisabled();

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select transaction 3 to add to Static collection',
      }),
    );
    expect(screen.getByText('1 transaction selected to add')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeEnabled();
  });

  it('surfaces another mutation error without dropping the selection', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    server.use(
      http.patch('/api/v1/views/:id/transactions', () =>
        HttpResponse.json(
          { type: 'SERVICE_UNAVAILABLE', message: 'Try again later' },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTable({ options: { addMode: { memberTransactionIds: [1] } } });

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select transaction 2 to add to Static collection',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Add transactions' }));

    expect(await screen.findByText('Try again later')).toBeInTheDocument();
    expect(screen.getByText('1 transaction selected to add')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add transactions' })).toBeEnabled();
  });
});
