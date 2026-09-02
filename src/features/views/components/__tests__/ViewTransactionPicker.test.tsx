import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ViewTransactionPicker } from '@/features/views/components/ViewTransactionPicker';
import { renderWithProviders } from '@/testing/test-utils';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';
import { projectDisplayAmount } from '@/utils/displayAmount';

const transactions: Transaction[] = Array.from({ length: 12 }, (_, index) => {
  const id = index + 1;

  return {
    id,
    accountId: id % 2 === 0 ? 'savings' : 'checking',
    bankName: id % 2 === 0 ? 'Second Bank' : 'Example Bank',
    date: `2026-01-${id.toString().padStart(2, '0')}`,
    currencyIsoCode: 'USD',
    amount: id * 10,
    type: id % 2 === 0 ? 'CREDIT' : 'DEBIT',
    description: id === 1 ? 'Coffee' : `Transaction ${id}`,
    createdAt: `2026-01-${id.toString().padStart(2, '0')}T00:00:00Z`,
    updatedAt: `2026-01-${id.toString().padStart(2, '0')}T00:00:00Z`,
  };
});

function createDisplayAmounts(rows: Transaction[]): ReadonlyMap<number, DisplayAmount> {
  return new Map(
    rows.map((transaction) => [
      transaction.id,
      projectDisplayAmount(transaction, 'USD', new Map()),
    ]),
  );
}

function renderPicker({
  rows = transactions,
  memberTransactionIds = [],
  onSubmit = vi.fn(),
}: {
  rows?: Transaction[];
  memberTransactionIds?: number[];
  onSubmit?: (transactionIds: number[]) => void;
} = {}) {
  return {
    onSubmit,
    ...renderWithProviders(
      <ViewTransactionPicker
        allTransactions={rows}
        memberTransactionIds={memberTransactionIds}
        viewName="Monthly activity"
        displayCurrency="USD"
        displayAmounts={createDisplayAmounts(rows)}
        isDisplayAmountLoading={false}
        isPending={false}
        errorMessage={null}
        submissionBlocked={false}
        onSelectionChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
      {
        initialEntries: ['/views/view-1?q=hidden&dateFrom=2025-01-01&bankName=Hidden&type=CREDIT'],
      },
    ),
  };
}

describe('ViewTransactionPicker', () => {
  it('starts with blank local filters and presents the complete supplied snapshot', async () => {
    const user = userEvent.setup();
    renderPicker();

    expect(screen.getByPlaceholderText('Search descriptions ↵')).toHaveValue('');
    for (const dateInput of document.querySelectorAll('input[type="date"]')) {
      expect(dateInput).toHaveValue('');
    }
    expect(screen.getByRole('spinbutton', { name: 'Minimum amount' })).toHaveValue(null);
    expect(screen.getByRole('spinbutton', { name: 'Maximum amount' })).toHaveValue(null);
    expect(screen.getByRole('button', { name: 'Filter by bank' })).toHaveTextContent('All Banks');
    expect(screen.getByRole('button', { name: 'Filter by account' })).toHaveTextContent(
      'All Accounts',
    );
    expect(screen.getByRole('button', { name: 'Filter by transaction type' })).toHaveTextContent(
      'all',
    );
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 to 10 of 12 transactions')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Showing 11 to 12 of 12 transactions')).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
  });

  it('filters locally and restores the full result when filters are cleared', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByPlaceholderText('Search descriptions ↵'), 'coffee{Enter}');

    expect(screen.getByText('Showing 1 to 1 of 1 transactions')).toBeInTheDocument();
    expect(screen.getByText('Coffee')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(screen.getByPlaceholderText('Search descriptions ↵')).toHaveValue('');
    expect(screen.getByText('Showing 1 to 10 of 12 transactions')).toBeInTheDocument();
  });

  it('shows existing members but disables and labels their selection controls', () => {
    renderPicker({ rows: transactions.slice(0, 2), memberTransactionIds: [2] });

    expect(
      screen.getByRole('checkbox', { name: 'Transaction 2 is already in Monthly activity' }),
    ).toBeDisabled();
    expect(screen.getByText('Already in view')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: 'Select transaction 1 to add to Monthly activity',
      }),
    ).toBeEnabled();
  });

  it('limits page and all-matching selection to eligible nonmembers', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderPicker({ memberTransactionIds: [7, 10], onSubmit });

    await user.click(
      screen.getByRole('checkbox', { name: 'Select eligible transactions on this page' }),
    );
    expect(
      screen.getByText('All 8 eligible transactions on this page are selected.'),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'Select all 10 eligible transactions matching these filters',
      }),
    );
    expect(screen.getByText('10 eligible transactions selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add transactions' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6, 8, 9, 11, 12]);

    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByText('0 eligible transactions selected')).toBeInTheDocument();
  });
});
