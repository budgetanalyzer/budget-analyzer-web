import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RestoreExcludedTransactionsModal } from '@/features/views/components/RestoreExcludedTransactionsModal';
import type { SavedView } from '@/types/view';
import type { Transaction } from '@/types/transaction';

const hookMocks = vi.hoisted(() => ({
  excludedTransactions: [] as Transaction[],
  refetch: vi.fn(),
  restoreMutate: vi.fn(),
  isRestoring: false,
}));

vi.mock('@/hooks/useViews', () => ({
  useExcludedViewTransactions: () => ({
    data: hookMocks.excludedTransactions,
    isLoading: false,
    error: null,
    refetch: hookMocks.refetch,
  }),
  useUnexcludeTransaction: () => ({
    mutate: hookMocks.restoreMutate,
    isPending: hookMocks.isRestoring,
  }),
}));

const view: SavedView = {
  id: 'view-1',
  name: 'Recent',
  criteria: {},
  openEnded: true,
  pinnedCount: 0,
  excludedCount: 2,
  transactionCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const excludedTransactions: Transaction[] = [
  {
    id: 1,
    accountId: 'account-1',
    bankName: 'Alpha Bank',
    date: '2026-01-03',
    currencyIsoCode: 'USD',
    amount: -14.25,
    type: 'DEBIT',
    description: 'Older excluded transaction',
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  },
  {
    id: 2,
    accountId: 'account-2',
    bankName: 'Beta Bank',
    date: '2026-01-09',
    currencyIsoCode: 'USD',
    amount: -42,
    type: 'DEBIT',
    description: 'Newest excluded transaction',
    createdAt: '2026-01-09T00:00:00Z',
    updatedAt: '2026-01-09T00:00:00Z',
  },
];

function getFooterCloseButton() {
  const closeButtons = screen.getAllByRole('button', { name: 'Close' });
  const footerCloseButton = closeButtons[1];

  if (!footerCloseButton) {
    throw new Error('Footer close button not found');
  }

  return footerCloseButton;
}

function renderRestoreExcludedTransactionsModal(onClose = vi.fn()) {
  return render(<RestoreExcludedTransactionsModal open onClose={onClose} view={view} />);
}

beforeEach(() => {
  hookMocks.excludedTransactions = excludedTransactions;
  hookMocks.refetch.mockReset();
  hookMocks.restoreMutate.mockReset();
  hookMocks.isRestoring = false;
});

describe('RestoreExcludedTransactionsModal', () => {
  it('renders excluded rows ordered by LocalDate descending', () => {
    renderRestoreExcludedTransactionsModal();

    const rows = screen.getAllByRole('row').slice(1);

    expect(rows[0]).toHaveTextContent('Newest excluded transaction');
    expect(rows[1]).toHaveTextContent('Older excluded transaction');
  });

  it('restores an excluded transaction', async () => {
    renderRestoreExcludedTransactionsModal();

    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' });
    await userEvent.click(restoreButtons[0]);

    expect(hookMocks.restoreMutate).toHaveBeenCalledWith(
      { viewId: 'view-1', txnId: 2 },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('renders the empty excluded list state', () => {
    hookMocks.excludedTransactions = [];

    renderRestoreExcludedTransactionsModal();

    expect(screen.getByText('No excluded transactions.')).toBeInTheDocument();
  });

  it('renders a footer close button', async () => {
    const onClose = vi.fn();
    renderRestoreExcludedTransactionsModal(onClose);

    await userEvent.click(getFooterCloseButton());

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not close while a restore is pending', async () => {
    hookMocks.isRestoring = true;
    const onClose = vi.fn();
    renderRestoreExcludedTransactionsModal(onClose);

    const closeButton = getFooterCloseButton();
    expect(closeButton).toBeDisabled();

    await userEvent.click(closeButton);

    expect(onClose).not.toHaveBeenCalled();
  });
});
