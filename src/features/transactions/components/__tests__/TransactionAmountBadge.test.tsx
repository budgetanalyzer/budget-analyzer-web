import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TransactionAmountBadge } from '@/features/transactions/components/TransactionAmountBadge';
import type { DisplayAmount } from '@/types/displayAmount';

describe('TransactionAmountBadge', () => {
  it('renders the supplied selected-currency projection without reconverting it', () => {
    const displayAmount: DisplayAmount = {
      available: true,
      sourceMagnitude: 10,
      sourceCurrency: 'USD',
      targetCurrency: 'EUR',
      minorUnitCount: 2,
      value: 9.25,
      rateLegs: [],
    };

    render(<TransactionAmountBadge displayAmount={displayAmount} isCredit />);

    expect(screen.getByText('€9.25')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('discloses the native amount and unavailable target instead of relabeling it', () => {
    const displayAmount: DisplayAmount = {
      available: false,
      sourceMagnitude: 12.5,
      sourceCurrency: 'GBP',
      targetCurrency: 'EUR',
      reason: 'MISSING_SOURCE_RATE',
    };

    render(<TransactionAmountBadge displayAmount={displayAmount} isCredit={false} />);

    expect(screen.getByText('£12.50')).toBeInTheDocument();
    expect(screen.getByText('Conversion to EUR unavailable')).toBeInTheDocument();
    expect(screen.queryByText('€12.50')).not.toBeInTheDocument();
  });
});
