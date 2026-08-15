import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TransferRefundReviewDialog } from '@/features/views/components/TransferRefundReviewDialog';
import type { TransferRefundCandidate } from '@/features/views/types/transferRefundReview';
import { ApiError } from '@/types/apiError';
import type { BulkViewTransactionResponse } from '@/types/view';

const hookMocks = vi.hoisted(() => ({
  bulkExclude: vi.fn(),
  isPending: false,
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/hooks/useViews', () => ({
  useBulkExcludeTransactions: () => ({
    mutate: hookMocks.bulkExclude,
    isPending: hookMocks.isPending,
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  toast: toastMocks,
}));

const refundCandidate: TransferRefundCandidate = {
  key: 'refund-101-102',
  kind: 'REFUND',
  debit: {
    id: 101,
    accountId: 'checking-1234',
    bankName: 'Alpha Bank',
    date: '2026-01-03',
    currencyIsoCode: 'EUR',
    amount: -89.5,
    type: 'DEBIT',
    description: 'Acme Market purchase',
    createdAt: '2026-01-03T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
  },
  credit: {
    id: 102,
    accountId: 'checking-1234',
    bankName: 'Alpha Bank',
    date: '2026-01-05',
    currencyIsoCode: 'EUR',
    amount: 89,
    type: 'CREDIT',
    description: 'Acme Market refund',
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-01-05T00:00:00Z',
  },
  absoluteDayDistance: 2,
  amountDifferenceBasisPoints: 56,
  sharedDescriptionTokens: ['acme', 'market'],
  explicitlyExcludedTransactionIds: [],
  eligibleExclusionTransactionIds: [101, 101, 102],
};

const transferCandidate: TransferRefundCandidate = {
  key: 'transfer-201-202',
  kind: 'TRANSFER',
  debit: {
    id: 201,
    accountId: 'savings-2468',
    bankName: 'Alpha Bank',
    date: '2026-02-10',
    currencyIsoCode: 'USD',
    amount: -250,
    type: 'DEBIT',
    description: 'Transfer to Beta',
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-02-10T00:00:00Z',
  },
  credit: {
    id: 202,
    accountId: 'daily-9876',
    bankName: 'Beta Bank',
    date: '2026-02-11',
    currencyIsoCode: 'CAD',
    amount: 347.25,
    type: 'CREDIT',
    description: 'Transfer from Alpha',
    createdAt: '2026-02-11T00:00:00Z',
    updatedAt: '2026-02-11T00:00:00Z',
  },
  absoluteDayDistance: 1,
  amountDifferenceBasisPoints: 28,
  sharedDescriptionTokens: ['transfer'],
  explicitlyExcludedTransactionIds: [],
  eligibleExclusionTransactionIds: [201],
};

const completionCandidate: TransferRefundCandidate = {
  ...transferCandidate,
  key: 'transfer-301-302',
  debit: {
    ...transferCandidate.debit,
    id: 301,
    description: 'Previously excluded transfer debit',
  },
  credit: {
    ...transferCandidate.credit,
    id: 302,
    description: 'Remaining related transfer credit',
  },
  explicitlyExcludedTransactionIds: [301],
  eligibleExclusionTransactionIds: [302],
};

const defaultProps = {
  viewId: 'view-1',
  viewName: 'Everyday spending',
  candidates: [refundCandidate, transferCandidate],
  isLoading: false,
  error: null,
  onRetry: vi.fn(),
  onClose: vi.fn(),
  onComplete: vi.fn(),
};

type DialogProps = React.ComponentProps<typeof TransferRefundReviewDialog>;

type MutationOptions = {
  onSuccess: (response: BulkViewTransactionResponse) => void;
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

function getMutationOptions(): MutationOptions {
  const call = hookMocks.bulkExclude.mock.calls[0] as [
    { viewId: string; ids: number[] },
    MutationOptions,
  ];
  return call[1];
}

beforeEach(() => {
  hookMocks.bulkExclude.mockReset();
  hookMocks.isPending = false;
  toastMocks.success.mockReset();
  toastMocks.warning.mockReset();
  toastMocks.error.mockReset();
});

afterEach(() => {
  cleanup();
  document.body.classList.remove('overflow-hidden');
});

describe('TransferRefundReviewDialog', () => {
  it('renders a new-only collection without an empty completion heading', () => {
    renderDialog({ candidates: [refundCandidate, transferCandidate] });

    expect(
      screen.getByRole('heading', { name: 'New possible transfers and refunds' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Complete previous exclusions' }),
    ).not.toBeInTheDocument();
  });

  it('renders completion-only evidence with precise membership status and eligible selection', async () => {
    const user = userEvent.setup();
    renderDialog({ candidates: [completionCandidate] });

    const completionGroup = screen.getByRole('region', {
      name: 'Complete previous exclusions',
    });
    expect(completionGroup).toHaveTextContent(
      'A possible related transaction remains in this view while another transaction is already excluded. Review whether to exclude the remaining transaction.',
    );
    expect(
      within(completionGroup).getByText('Previously excluded from this view'),
    ).toBeInTheDocument();
    expect(
      within(completionGroup).queryByText('Not currently in this view'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'New possible transfers and refunds' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {
        name: 'Exclude debit transaction 301 from this view',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', {
        name: 'Exclude credit transaction 302 from this view',
      }),
    ).toBeChecked();
    expect(screen.getByRole('button', { name: 'Exclude 1 from this view' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Exclude 1 from this view' }));

    expect(hookMocks.bulkExclude).toHaveBeenCalledWith(
      { viewId: 'view-1', ids: [302] },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('groups completion work first while preserving new-candidate order and eligible IDs', async () => {
    const user = userEvent.setup();
    renderDialog({ candidates: [refundCandidate, completionCandidate, transferCandidate] });

    const completionHeading = screen.getByRole('heading', {
      name: 'Complete previous exclusions',
    });
    const newHeading = screen.getByRole('heading', {
      name: 'New possible transfers and refunds',
    });
    expect(
      completionHeading.compareDocumentPosition(newHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const newGroup = screen.getByRole('region', { name: 'New possible transfers and refunds' });
    const newCandidateRegions = within(newGroup).getAllByRole('region');
    expect(newCandidateRegions[0]).toHaveAccessibleName('Possible refund');
    expect(newCandidateRegions[1]).toHaveAccessibleName('Possible transfer');
    expect(within(newGroup).getByText('Not currently in this view')).toBeInTheDocument();

    const checkboxNames = screen
      .getAllByRole('checkbox')
      .map((checkbox) => checkbox.getAttribute('aria-label'));
    expect(new Set(checkboxNames).size).toBe(checkboxNames.length);
    expect(screen.getByRole('button', { name: 'Exclude 4 from this view' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Exclude 4 from this view' }));

    expect(hookMocks.bulkExclude).toHaveBeenCalledWith(
      { viewId: 'view-1', ids: [101, 102, 302, 201] },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('shows candidate labels, explanations, details, and original-currency amounts', () => {
    renderDialog();

    const refund = screen.getByRole('region', { name: 'Possible refund' });
    const transfer = screen.getByRole('region', { name: 'Possible transfer' });

    expect(refund).toHaveTextContent('2 days apart');
    expect(refund).toHaveTextContent('Approximately 0.56% amount difference');
    expect(refund).toHaveTextContent('Related description evidence: acme, market');
    expect(refund).toHaveTextContent('Jan 3, 2026');
    expect(refund).toHaveTextContent('Acme Market purchase');
    expect(refund).toHaveTextContent('Alpha Bank');
    expect(refund).toHaveTextContent('checking-1234');
    expect(within(refund).getAllByText('€89.50')).toHaveLength(1);
    expect(within(refund).getAllByText('€89.00')).toHaveLength(1);
    expect(transfer).toHaveTextContent('1 day apart');
    expect(transfer).toHaveTextContent('Approximately 0.28% amount difference');
    expect(transfer).toHaveTextContent('$250.00');
    expect(transfer).toHaveTextContent('CA$347.25');
  });

  it('defaults eligible sides to selected and toggles debit and credit independently', async () => {
    const user = userEvent.setup();
    renderDialog();

    const debit = screen.getByRole('checkbox', {
      name: 'Exclude debit transaction 101 from this view',
    });
    const credit = screen.getByRole('checkbox', {
      name: 'Exclude credit transaction 102 from this view',
    });

    expect(debit).toBeChecked();
    expect(credit).toBeChecked();
    expect(screen.getByRole('button', { name: 'Exclude 3 from this view' })).toBeEnabled();

    await user.click(debit);

    expect(debit).not.toBeChecked();
    expect(credit).toBeChecked();
    expect(screen.getByRole('button', { name: 'Exclude 2 from this view' })).toBeEnabled();
    expect(hookMocks.bulkExclude).not.toHaveBeenCalled();

    await user.click(credit);

    expect(debit).not.toBeChecked();
    expect(credit).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Exclude 1 from this view' })).toBeEnabled();
  });

  it('shows outside-view evidence without an exclusion checkbox', () => {
    renderDialog();

    const transfer = screen.getByRole('region', { name: 'Possible transfer' });

    expect(within(transfer).getByText('Not currently in this view')).toBeInTheDocument();
    expect(within(transfer).getAllByRole('checkbox')).toHaveLength(1);
    expect(
      screen.queryByRole('checkbox', {
        name: 'Exclude credit transaction 202 from this view',
      }),
    ).not.toBeInTheDocument();
  });

  it('submits each selected current-view ID only once', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Exclude 3 from this view' }));

    expect(hookMocks.bulkExclude).toHaveBeenCalledWith(
      { viewId: 'view-1', ids: [101, 102, 201] },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('disables confirmation when all eligible transactions are unselected', async () => {
    const user = userEvent.setup();
    renderDialog();

    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }

    expect(screen.getByRole('button', { name: 'Exclude 0 from this view' })).toBeDisabled();
    expect(hookMocks.bulkExclude).not.toHaveBeenCalled();
  });

  it('shows an explicit discovery loading state', () => {
    renderDialog({ candidates: [], isLoading: true });

    expect(screen.getByText('Finding possible transfers and refunds...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exclude 0 from this view' })).toBeDisabled();
  });

  it('hides stale candidates and blocks confirmation while discovery is loading', async () => {
    const user = userEvent.setup();
    renderDialog({ isLoading: true });

    expect(screen.getByText('Finding possible transfers and refunds...')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Possible refund' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Possible transfer' })).not.toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Exclude 3 from this view' });
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);

    expect(hookMocks.bulkExclude).not.toHaveBeenCalled();
  });

  it('explains the empty state without classifying credits', () => {
    renderDialog({ candidates: [] });

    expect(screen.getByText('No possible transfers or refunds were found.')).toBeInTheDocument();
    expect(
      screen.getByText(/manually exclude transactions.*transaction table/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/income/i)).not.toBeInTheDocument();
  });

  it('shows discovery errors and retries through the supplied callback', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderDialog({ candidates: [], error: new Error('Discovery failed'), onRetry });

    expect(screen.getByText('Discovery failed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('hides stale candidates and blocks confirmation after discovery fails', async () => {
    const user = userEvent.setup();
    renderDialog({ error: new Error('Discovery failed') });

    expect(screen.getByText('Discovery failed')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Possible refund' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Possible transfer' })).not.toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: 'Exclude 3 from this view' });
    expect(confirmButton).toBeDisabled();
    await user.click(confirmButton);

    expect(hookMocks.bulkExclude).not.toHaveBeenCalled();
  });

  it('prevents every available dismissal while exclusion is pending', async () => {
    const user = userEvent.setup();
    hookMocks.isPending = true;
    const { props } = renderDialog();

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excluding...' })).toBeDisabled();
    expect(screen.getAllByRole('checkbox')[0]).toBeDisabled();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('closes, completes, and shows success feedback after a complete exclusion', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog({ candidates: [refundCandidate] });

    await user.click(screen.getByRole('button', { name: 'Exclude 2 from this view' }));
    getMutationOptions().onSuccess({ updatedCount: 2, notFoundIds: [] });

    expect(toastMocks.success).toHaveBeenCalledWith('Excluded 2 transactions');
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onComplete).toHaveBeenCalledOnce();
  });

  it('closes, completes, and shows warning feedback after partial success', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog({ candidates: [refundCandidate] });

    await user.click(screen.getByRole('button', { name: 'Exclude 2 from this view' }));
    getMutationOptions().onSuccess({ updatedCount: 1, notFoundIds: [102] });

    expect(toastMocks.warning).toHaveBeenCalledWith('Excluded 1 of 2. 1 not found or unavailable.');
    expect(props.onClose).toHaveBeenCalledOnce();
    expect(props.onComplete).toHaveBeenCalledOnce();
  });

  it('keeps the dialog open and shows error feedback after a zero update', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog({ candidates: [refundCandidate] });

    await user.click(screen.getByRole('button', { name: 'Exclude 2 from this view' }));
    getMutationOptions().onSuccess({ updatedCount: 0, notFoundIds: [101, 102] });

    expect(toastMocks.error).toHaveBeenCalledWith('Failed to exclude transactions');
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and formats API failure feedback', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog({ candidates: [refundCandidate] });
    const error = new ApiError(500, {
      type: 'INTERNAL_ERROR',
      message: 'The exclusions could not be saved',
    });

    await user.click(screen.getByRole('button', { name: 'Exclude 2 from this view' }));
    getMutationOptions().onError(error);

    expect(toastMocks.error).toHaveBeenCalledWith('The exclusions could not be saved');
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onComplete).not.toHaveBeenCalled();
  });

  it('does not create runtime style elements or DOM style attributes', async () => {
    const user = userEvent.setup();
    const styleElementCount = document.querySelectorAll('style').length;
    const { container } = renderDialog();

    await user.click(
      screen.getByRole('checkbox', {
        name: 'Exclude debit transaction 101 from this view',
      }),
    );

    expect(document.querySelectorAll('style')).toHaveLength(styleElementCount);
    expect(document.body).not.toHaveAttribute('style');
    expect(container.querySelector('[style]')).not.toBeInTheDocument();
  });

  it('resets default selection when the dialog is reopened through remount', async () => {
    const user = userEvent.setup();
    const firstRender = renderDialog({ candidates: [refundCandidate] });
    const debitName = 'Exclude debit transaction 101 from this view';

    await user.click(screen.getByRole('checkbox', { name: debitName }));
    expect(screen.getByRole('checkbox', { name: debitName })).not.toBeChecked();

    firstRender.unmount();
    renderDialog({ candidates: [refundCandidate] });

    expect(screen.getByRole('checkbox', { name: debitName })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Exclude 2 from this view' })).toBeEnabled();
  });
});
