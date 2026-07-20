import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransactionFilterBar } from '@/components/TransactionFilterBar';
import type { TransactionFilterValues } from '@/types/transactionFilters';

const emptyFilters: TransactionFilterValues = {
  globalFilter: '',
  dateFilter: { from: null, to: null },
  bankNameFilter: null,
  accountIdFilter: null,
  typeFilter: null,
  amountFilter: { min: null, max: null },
};

function createProps(
  overrides: Partial<ComponentProps<typeof TransactionFilterBar>> = {},
): ComponentProps<typeof TransactionFilterBar> {
  return {
    filters: emptyFilters,
    availableBankNames: ['Bank A'],
    availableAccountIds: ['checking'],
    onDateFilterChange: vi.fn(),
    onSearchChange: vi.fn(),
    onBankNameFilterChange: vi.fn(),
    onAccountIdFilterChange: vi.fn(),
    onTypeFilterChange: vi.fn(),
    onAmountFilterChange: vi.fn(),
    onClearAllFilters: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('TransactionFilterBar', () => {
  it('submits description search on Enter and clears it immediately', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<TransactionFilterBar {...createProps({ onSearchChange })} />);

    const searchInput = screen.getByPlaceholderText('Search descriptions ↵');
    await user.type(searchInput, 'coffee');
    expect(onSearchChange).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onSearchChange).toHaveBeenCalledWith('coffee');

    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(searchInput).toHaveValue('');
    expect(onSearchChange).toHaveBeenLastCalledWith('');
  });

  it('resets search and amount drafts when their applied values change', () => {
    const initialProps = createProps({
      filters: {
        ...emptyFilters,
        globalFilter: 'coffee',
        amountFilter: { min: 10, max: 20 },
      },
    });
    const { rerender } = render(<TransactionFilterBar {...initialProps} />);

    fireEvent.change(screen.getByPlaceholderText('Search descriptions ↵'), {
      target: { value: 'uncommitted' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum amount' }), {
      target: { value: '15' },
    });

    rerender(
      <TransactionFilterBar
        {...initialProps}
        filters={{
          ...emptyFilters,
          globalFilter: 'salary',
          amountFilter: { min: 25, max: 30 },
        }}
      />,
    );

    expect(screen.getByPlaceholderText('Search descriptions ↵')).toHaveValue('salary');
    expect(screen.getByRole('spinbutton', { name: 'Minimum amount' })).toHaveValue(25);
    expect(screen.getByRole('spinbutton', { name: 'Maximum amount' })).toHaveValue(30);
  });

  it('shows bank and account selectors only for multiple options', () => {
    const props = createProps();
    const { rerender } = render(<TransactionFilterBar {...props} />);

    expect(screen.queryByRole('button', { name: 'Filter by bank' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filter by account' })).not.toBeInTheDocument();

    rerender(
      <TransactionFilterBar
        {...props}
        availableBankNames={['Bank A', 'Bank B']}
        availableAccountIds={['checking', 'savings']}
      />,
    );

    expect(screen.getByRole('button', { name: 'Filter by bank' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filter by account' })).toBeInTheDocument();
  });

  it('commits bank, account, and transaction type selections', async () => {
    const user = userEvent.setup();
    const onBankNameFilterChange = vi.fn();
    const onAccountIdFilterChange = vi.fn();
    const onTypeFilterChange = vi.fn();
    render(
      <TransactionFilterBar
        {...createProps({
          availableBankNames: ['Bank A', 'Bank B'],
          availableAccountIds: ['checking', 'savings'],
          onBankNameFilterChange,
          onAccountIdFilterChange,
          onTypeFilterChange,
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Filter by bank' }));
    await user.click(screen.getByRole('button', { name: 'Bank B' }));
    expect(onBankNameFilterChange).toHaveBeenCalledWith('Bank B');

    await user.click(screen.getByRole('button', { name: 'Filter by account' }));
    await user.click(screen.getByRole('button', { name: 'savings' }));
    expect(onAccountIdFilterChange).toHaveBeenCalledWith('savings');

    await user.click(screen.getByRole('button', { name: 'Filter by transaction type' }));
    await user.click(screen.getByRole('button', { name: 'Credit' }));
    expect(onTypeFilterChange).toHaveBeenCalledWith('CREDIT');
  });

  it('commits date changes through the controlled date range', () => {
    const onDateFilterChange = vi.fn();
    const { container } = render(<TransactionFilterBar {...createProps({ onDateFilterChange })} />);
    const [fromInput] = container.querySelectorAll<HTMLInputElement>('input[type="date"]');

    fireEvent.change(fromInput, { target: { value: '2026-01-15' } });

    expect(onDateFilterChange).toHaveBeenCalledWith('2026-01-15', null);
  });

  it('debounces amount changes for 400 ms and commits both drafts together', () => {
    vi.useFakeTimers();
    const onAmountFilterChange = vi.fn();
    render(<TransactionFilterBar {...createProps({ onAmountFilterChange })} />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum amount' }), {
      target: { value: '12.50' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum amount' }), {
      target: { value: '45' },
    });

    act(() => vi.advanceTimersByTime(399));
    expect(onAmountFilterChange).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onAmountFilterChange).toHaveBeenCalledWith(12.5, 45);
  });

  it('shows Clear and the contextual action only while a filter is active', async () => {
    const user = userEvent.setup();
    const onClearAllFilters = vi.fn();
    const props = createProps({
      onClearAllFilters,
      contextualAction: <button type="button">Save current filters</button>,
    });
    const { rerender } = render(<TransactionFilterBar {...props} />);

    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save current filters' })).not.toBeInTheDocument();

    rerender(
      <TransactionFilterBar {...props} filters={{ ...emptyFilters, bankNameFilter: 'Bank A' }} />,
    );

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClearAllFilters).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Save current filters' })).toBeInTheDocument();
  });
});
