import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
import uiReducer from '@/store/uiSlice';

const mockUsePermission = vi.mocked(usePermission);

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

function renderTable() {
  const store = configureStore({ reducer: { ui: uiReducer } });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/transactions']}>
          <TransactionTable
            transactions={transactions}
            displayCurrency="USD"
            exchangeRatesMap={new Map()}
            isExchangeRatesLoading={false}
            availableBankNames={['Test Bank']}
            availableAccountIds={['acct-1']}
          />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
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
