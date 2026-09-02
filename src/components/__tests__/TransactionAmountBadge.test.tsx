import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TransactionAmountBadge } from '@/components/TransactionAmountBadge';
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
    expect(screen.queryByText('$10.00')).not.toBeInTheDocument();
    expect(screen.queryByText('USD')).not.toBeInTheDocument();
  });

  it('renders target-currency unavailability without disclosing the stored amount', () => {
    const displayAmount: DisplayAmount = {
      available: false,
      sourceMagnitude: 12.5,
      sourceCurrency: 'GBP',
      targetCurrency: 'EUR',
      reason: 'MISSING_SOURCE_RATE',
    };

    render(<TransactionAmountBadge displayAmount={displayAmount} isCredit={false} />);

    expect(screen.getByText('Amount in EUR unavailable')).toBeInTheDocument();
    expect(screen.queryByText('£12.50')).not.toBeInTheDocument();
    expect(screen.queryByText('GBP')).not.toBeInTheDocument();
    expect(screen.queryByText('€12.50')).not.toBeInTheDocument();
  });
});
