import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useViews', () => ({
  usePinTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useUnpinTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useExcludeTransaction: () => ({ mutate: vi.fn(), isPending: false }),
  useUnexcludeTransaction: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { ManageViewTransactionsModal } from '@/features/views/components/ManageViewTransactionsModal';

describe('ManageViewTransactionsModal', () => {
  it('sorts transactions within the same membership status by LocalDate descending', () => {
    render(
      <ManageViewTransactionsModal
        open
        onClose={() => {}}
        view={{
          id: 'view-1',
          name: 'Recent',
          criteria: {},
          openEnded: true,
          pinnedCount: 0,
          excludedCount: 0,
          transactionCount: 3,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }}
        membership={{
          matched: [1, 2, 3],
          pinned: [],
          excluded: [],
        }}
        allTransactions={[
          {
            id: 1,
            accountId: 'acc-1',
            bankName: 'Alpha Bank',
            date: '2026-01-03',
            currencyIsoCode: 'USD',
            amount: -100,
            type: 'DEBIT',
            description: 'Middle transaction',
            createdAt: '2026-01-03T00:00:00Z',
            updatedAt: '2026-01-03T00:00:00Z',
          },
          {
            id: 2,
            accountId: 'acc-1',
            bankName: 'Alpha Bank',
            date: '2026-01-09',
            currencyIsoCode: 'USD',
            amount: -50,
            type: 'DEBIT',
            description: 'Newest transaction',
            createdAt: '2026-01-09T00:00:00Z',
            updatedAt: '2026-01-09T00:00:00Z',
          },
          {
            id: 3,
            accountId: 'acc-1',
            bankName: 'Alpha Bank',
            date: '2025-12-31',
            currencyIsoCode: 'USD',
            amount: -20,
            type: 'DEBIT',
            description: 'Oldest transaction',
            createdAt: '2025-12-31T00:00:00Z',
            updatedAt: '2025-12-31T00:00:00Z',
          },
        ]}
      />,
    );

    const rows = screen.getAllByRole('row').slice(1);

    expect(rows[0]).toHaveTextContent('Newest transaction');
    expect(rows[1]).toHaveTextContent('Middle transaction');
    expect(rows[2]).toHaveTextContent('Oldest transaction');
  });
});
