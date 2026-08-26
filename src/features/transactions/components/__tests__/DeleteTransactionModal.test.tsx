import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { DeleteTransactionModal } from '@/features/transactions/components/DeleteTransactionModal';
import { toast } from '@/hooks/useToast';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';

const transaction: Transaction = {
  id: 7,
  accountId: 'checking',
  bankName: 'Test Bank',
  date: '2026-01-04',
  currencyIsoCode: 'EUR',
  amount: -80,
  type: 'DEBIT',
  description: 'Weekend purchase',
  createdAt: '2026-01-04T00:00:00Z',
  updatedAt: '2026-01-04T00:00:00Z',
};

const displayAmount: DisplayAmount = {
  available: true,
  sourceMagnitude: 80,
  sourceCurrency: 'EUR',
  targetCurrency: 'USD',
  minorUnitCount: 2,
  value: 100,
  rateLegs: [],
};

function renderModal(displayAmount: DisplayAmount) {
  return renderWithProviders(
    <DeleteTransactionModal
      transaction={transaction}
      displayAmount={displayAmount}
      isOpen
      onOpenChange={vi.fn()}
    />,
  );
}

function InteractiveModal({ onDeleted }: { onDeleted: () => void }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <DeleteTransactionModal
      transaction={transaction}
      displayAmount={displayAmount}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onDeleted={onDeleted}
    />
  );
}

describe('DeleteTransactionModal', () => {
  it('always discloses a positive native amount and shows an available selected amount', () => {
    renderModal(displayAmount);

    expect(screen.getByText('€80.00 EUR')).toBeInTheDocument();
    expect(screen.queryByText(/-€80\.00/)).not.toBeInTheDocument();
    expect(screen.getByText('$100.00 USD')).toBeInTheDocument();
  });

  it('shows an unavailable selected amount without substituting the native number', () => {
    renderModal({
      available: false,
      sourceMagnitude: 80,
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      reason: 'MISSING_SOURCE_RATE',
    });

    expect(screen.getByText('€80.00 EUR')).toBeInTheDocument();
    expect(screen.getByText('Conversion to USD unavailable')).toBeInTheDocument();
    expect(screen.queryByText('$80.00 USD')).not.toBeInTheDocument();
  });

  it('closes and runs the deletion callback without a redundant success notification', async () => {
    const successToast = vi.spyOn(toast, 'success');
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    server.use(
      http.delete('/api/v1/transactions/:id', () => new HttpResponse(null, { status: 204 })),
    );

    renderWithProviders(<InteractiveModal onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete Transaction' })).not.toBeInTheDocument();
    });
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(successToast).not.toHaveBeenCalled();
  });

  it('keeps the dialog open and surfaces failure feedback when deletion fails', async () => {
    const errorToast = vi.spyOn(toast, 'error');
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    server.use(
      http.delete('/api/v1/transactions/:id', () =>
        HttpResponse.json({ type: 'APPLICATION_ERROR', message: 'Delete failed' }, { status: 500 }),
      ),
    );

    renderWithProviders(<InteractiveModal onDeleted={onDeleted} />);

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(errorToast).toHaveBeenCalledWith('Delete failed'));
    expect(screen.getByRole('heading', { name: 'Delete Transaction' })).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
