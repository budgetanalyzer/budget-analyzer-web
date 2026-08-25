import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExchangeRateInfo } from '@/features/transactions/components/ExchangeRateInfo';
import type { DisplayAmountRateLeg } from '@/types/displayAmount';

function rateLeg(publishedDate: string): DisplayAmountRateLeg {
  return {
    kind: 'SOURCE_TO_USD',
    exchangeRate: {
      baseCurrency: 'USD',
      targetCurrency: 'EUR',
      date: '2026-01-04',
      publishedDate,
      rate: 0.8,
    },
  };
}

describe('ExchangeRateInfo', () => {
  it('shows the effective and publication dates for a carried-forward rate leg', () => {
    render(<ExchangeRateInfo rateLeg={rateLeg('2026-01-02')} />);

    expect(screen.getByText('EUR to USD exchange-rate leg')).toBeInTheDocument();
    expect(screen.getByText('1 USD = 0.8000 EUR')).toBeInTheDocument();
    expect(
      screen.getByText('Effective for transaction date Jan 4, 2026 · Published Jan 2, 2026'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Currency Service carried forward the prior publication for a weekend or holiday.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/nearest/i)).not.toBeInTheDocument();
  });

  it('does not claim carry-forward when the publication and effective dates match', () => {
    render(<ExchangeRateInfo rateLeg={rateLeg('2026-01-04')} />);

    expect(screen.queryByText(/carried forward/i)).not.toBeInTheDocument();
  });
});
