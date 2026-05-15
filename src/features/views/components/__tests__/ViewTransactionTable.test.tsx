import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ViewTransactionTable } from '@/features/views/components/ViewTransactionTable';
import { ViewTransaction } from '@/types/view';

vi.mock('@/hooks/useViews', () => ({
  usePinTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useUnpinTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useExcludeTransaction: () => ({ mutate: vi.fn(), isPending: false }),
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
  searchText = '',
  onSearchChange = vi.fn(),
}: {
  rows?: ViewTransaction[];
  searchText?: string;
  onSearchChange?: (query: string) => void;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/views/view-1']}>
        <ViewTransactionTable
          transactions={rows}
          viewId="view-1"
          searchText={searchText}
          onSearchChange={onSearchChange}
          displayCurrency="USD"
          exchangeRatesMap={new Map()}
          isExchangeRatesLoading={false}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { onSearchChange };
}

describe('ViewTransactionTable search', () => {
  it('submits the typed search text when Enter is pressed', () => {
    const onSearchChange = vi.fn();
    renderViewTransactionTable({ onSearchChange });

    const searchInput = screen.getByPlaceholderText('"exact phrase" term1 term2 ↵');
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
});
