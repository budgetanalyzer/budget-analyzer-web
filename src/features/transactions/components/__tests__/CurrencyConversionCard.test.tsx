import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CurrencyConversionCard } from '@/features/transactions/components/CurrencyConversionCard';
import type { DisplayAmount } from '@/types/displayAmount';

const triangulatedAmount: DisplayAmount = {
  available: true,
  sourceMagnitude: 80,
  sourceCurrency: 'EUR',
  targetCurrency: 'GBP',
  minorUnitCount: 2,
  value: 50,
  rateLegs: [
    {
      kind: 'SOURCE_TO_USD',
      exchangeRate: {
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        date: '2026-01-04',
        publishedDate: '2026-01-02',
        rate: 0.8,
      },
    },
    {
      kind: 'USD_TO_TARGET',
      exchangeRate: {
        baseCurrency: 'USD',
        targetCurrency: 'GBP',
        date: '2026-01-04',
        publishedDate: '2026-01-02',
        rate: 0.5,
      },
    },
  ],
};

describe('CurrencyConversionCard', () => {
  it('shows the selected amount and both triangulation legs without repeating the stored amount', () => {
    render(<CurrencyConversionCard displayAmount={triangulatedAmount} transactionType="DEBIT" />);

    expect(screen.getByText('Amount in GBP')).toBeInTheDocument();
    expect(screen.getByText('£50.00')).toBeInTheDocument();
    expect(screen.queryByText('€80.00')).not.toBeInTheDocument();
    expect(screen.getByText('EUR to USD exchange-rate leg')).toBeInTheDocument();
    expect(screen.getByText('USD to GBP exchange-rate leg')).toBeInTheDocument();
    expect(screen.getAllByText(/Effective for transaction date Jan 4, 2026/)).toHaveLength(2);
    expect(screen.getAllByText(/Currency Service carried forward/)).toHaveLength(2);
  });

  it('renders selected-currency unavailability without repeating the stored amount', () => {
    const unavailableAmount: DisplayAmount = {
      available: false,
      sourceMagnitude: 80,
      sourceCurrency: 'EUR',
      targetCurrency: 'GBP',
      reason: 'MISSING_TARGET_RATE',
    };

    render(<CurrencyConversionCard displayAmount={unavailableAmount} transactionType="DEBIT" />);

    expect(screen.getByText('Amount in GBP')).toBeInTheDocument();
    expect(screen.getByText('Amount in GBP unavailable')).toBeInTheDocument();
    expect(screen.queryByText('€80.00')).not.toBeInTheDocument();
    expect(screen.queryByText('£80.00')).not.toBeInTheDocument();
    expect(screen.queryByText(/exchange-rate leg/)).not.toBeInTheDocument();
  });

  it('does not render a conversion card for a same-currency projection', () => {
    const sameCurrencyAmount: DisplayAmount = {
      available: true,
      sourceMagnitude: 10,
      sourceCurrency: 'USD',
      targetCurrency: 'USD',
      minorUnitCount: 2,
      value: 10,
      rateLegs: [],
    };

    render(<CurrencyConversionCard displayAmount={sameCurrencyAmount} transactionType="CREDIT" />);

    expect(screen.queryByText('Currency Conversion')).not.toBeInTheDocument();
  });
});
