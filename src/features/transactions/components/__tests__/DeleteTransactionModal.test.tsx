import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteTransactionModal } from '@/features/transactions/components/DeleteTransactionModal';
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

describe('DeleteTransactionModal', () => {
  it('always discloses a positive native amount and shows an available selected amount', () => {
    renderModal({
      available: true,
      sourceMagnitude: 80,
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      minorUnitCount: 2,
      value: 100,
      rateLegs: [],
    });

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
});
