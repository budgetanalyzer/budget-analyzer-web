import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransferRefundReviewDialog } from '@/features/views/components/TransferRefundReviewDialog';
import type { TransferRefundCandidate } from '@/features/views/types/transferRefundReview';
import { ApiError } from '@/types/apiError';

const hookMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/hooks/useViews', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useViews')>()),
  useUpdateViewTransactions: () => ({
    mutate: hookMocks.mutate,
    isPending: hookMocks.isPending,
  }),
}));

vi.mock('@/hooks/useToast', () => ({ toast: toastMocks }));

const candidate: TransferRefundCandidate = {
  key: 'TRANSFER:1:2',
  kind: 'TRANSFER',
  debit: {
    id: 1,
    accountId: 'checking',
    bankName: 'Alpha Bank',
    date: '2026-01-03',
    currencyIsoCode: 'USD',
    amount: 100,
    type: 'DEBIT',
    description: 'Transfer to savings',
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  },
  credit: {
    id: 2,
    accountId: 'savings',
    bankName: 'Beta Bank',
    date: '2026-01-04',
    currencyIsoCode: 'USD',
    amount: 100,
    type: 'CREDIT',
    description: 'Transfer from checking',
    createdAt: '2026-01-04T00:00:00Z',
    updatedAt: '2026-01-04T00:00:00Z',
  },
  absoluteDayDistance: 1,
  amountDifferenceBasisPoints: 0,
  sharedDescriptionTokens: ['transfer'],
  eligibleRemovalTransactionIds: [1],
};

const defaultProps = {
  viewId: 'view-1',
  viewName: 'Monthly activity',
  candidates: [candidate],
  isLoading: false,
  error: null,
  onRetry: vi.fn(),
  onClose: vi.fn(),
  onComplete: vi.fn(),
};

type DialogProps = React.ComponentProps<typeof TransferRefundReviewDialog>;
type MutationOptions = {
  onSuccess: () => void;
  onError: (error: Error) => void;
};

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props = {
    ...defaultProps,
    onRetry: vi.fn(),
    onClose: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<TransferRefundReviewDialog {...props} />) };
}

function mutationOptions(): MutationOptions {
  return hookMocks.mutate.mock.calls[0][1] as MutationOptions;
}

beforeEach(() => {
  hookMocks.mutate.mockReset();
  hookMocks.isPending = false;
  toastMocks.success.mockReset();
  toastMocks.error.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.classList.remove('overflow-hidden');
});

describe('TransferRefundReviewDialog', () => {
  it('shows nonmember evidence without presenting it as removal history or a selectable row', () => {
    renderDialog();

    const transfer = screen.getByRole('region', { name: 'Possible transfer' });
    expect(transfer).toHaveTextContent('Not currently in this view; shown as supporting evidence');
    expect(within(transfer).getAllByRole('checkbox')).toHaveLength(1);
    expect(
      screen.getByRole('checkbox', { name: 'Remove debit transaction 1 from this view' }),
    ).toBeChecked();
    expect(
      screen.queryByRole('checkbox', { name: 'Remove credit transaction 2 from this view' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/previous/i)).not.toBeInTheDocument();
  });

  it('submits only selected current member IDs in an atomic removal delta', async () => {
    renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Remove 1 from this view' }));

    expect(hookMocks.mutate).toHaveBeenCalledWith(
      {
        viewId: 'view-1',
        request: { addTransactionIds: [], removeTransactionIds: [1] },
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('allows cancellation without issuing a membership delta', async () => {
    const { props } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onClose).toHaveBeenCalledOnce();
    expect(hookMocks.mutate).not.toHaveBeenCalled();
  });

  it('retains the dialog and selection after a mutation failure', async () => {
    const { props } = renderDialog();
    const error = new ApiError(500, {
      type: 'INTERNAL_ERROR',
      message: 'Membership could not be updated',
    });

    await userEvent.click(screen.getByRole('button', { name: 'Remove 1 from this view' }));
    mutationOptions().onError(error);

    expect(toastMocks.error).toHaveBeenCalledWith('Membership could not be updated');
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onComplete).not.toHaveBeenCalled();
    expect(
      screen.getByRole('checkbox', { name: 'Remove debit transaction 1 from this view' }),
    ).toBeChecked();
  });

  it('closes and completes after bodyless mutation success', async () => {
    const { props } = renderDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Remove 1 from this view' }));
    mutationOptions().onSuccess();

    expect(toastMocks.success).toHaveBeenCalledWith('Removed 1 transaction from this view');
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onComplete).toHaveBeenCalledOnce();
  });

  it('blocks stale candidates during loading and retries discovery errors', async () => {
    const loading = renderDialog({ isLoading: true });
    expect(screen.getByText('Finding possible transfers and refunds...')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Possible transfer' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove 1 from this view' })).toBeDisabled();

    loading.unmount();
    const onRetry = vi.fn();
    renderDialog({ candidates: [], error: new Error('Discovery failed'), onRetry });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('explains an empty candidate result with removal language', () => {
    renderDialog({ candidates: [] });

    expect(screen.getByText('No possible transfers or refunds were found.')).toBeInTheDocument();
    expect(screen.getByText(/manually remove transactions from this view/)).toBeInTheDocument();
  });
});
