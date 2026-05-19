import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useTransactionCount');

import { ConfirmDisableCurrencyDialog } from '@/features/admin/currencies/components/ConfirmDisableCurrencyDialog';
import { useTransactionCount } from '@/hooks/useTransactionCount';

const mockUseTransactionCount = vi.mocked(useTransactionCount);

describe('ConfirmDisableCurrencyDialog', () => {
  beforeEach(() => {
    mockUseTransactionCount.mockReset();
  });

  it('checks active transaction count only when open and blocks confirmation while loading', () => {
    mockUseTransactionCount.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useTransactionCount>);

    renderDialog({ isOpen: true });

    expect(mockUseTransactionCount).toHaveBeenCalledWith({ currencyIsoCode: 'GBP' }, true);
    expect(screen.getByText('Checking transactions...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable Anyway' })).toBeDisabled();
  });

  it('shows the active transaction warning and confirms the disable action', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    mockUseTransactionCount.mockReturnValue({
      data: 2,
      isLoading: false,
    } as ReturnType<typeof useTransactionCount>);

    renderDialog({ isOpen: true, onConfirm });

    expect(screen.getByRole('heading', { name: 'Disable GBP?' })).toBeInTheDocument();
    expect(screen.getByText(/There are 2 active transactions using GBP/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Disable Anyway' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows the no-active-transactions message and cancels without confirming', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    mockUseTransactionCount.mockReturnValue({
      data: 0,
      isLoading: false,
    } as ReturnType<typeof useTransactionCount>);

    renderDialog({ isOpen: true, onCancel, onConfirm });

    expect(screen.getByText('No active transactions use GBP.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

function renderDialog({
  isOpen,
  onConfirm = vi.fn(),
  onCancel = vi.fn(),
  isSubmitting = false,
}: {
  isOpen: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
}) {
  return render(
    <ConfirmDisableCurrencyDialog
      currencyCode="GBP"
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      isSubmitting={isSubmitting}
    />,
  );
}
