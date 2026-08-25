import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MonthlySpendingGrid } from '@/features/analytics/components/MonthlySpendingGrid';
import { YearlySpendingGrid } from '@/features/analytics/components/YearlySpendingGrid';
import { renderWithProviders } from '@/testing/test-utils';

describe('analytics spending grids', () => {
  it('labels a mixed monthly total partial while retaining the full transaction count', () => {
    renderWithProviders(
      <MonthlySpendingGrid
        monthlyData={[
          {
            year: 2026,
            month: 1,
            monthLabel: 'Jan 2026',
            totalSpending: 25,
            transactionCount: 2,
            unavailableAmountCount: 1,
          },
        ]}
        currency="USD"
        viewMode="monthly"
        transactionType="debit"
        analyticsScope="all"
      />,
      { initialEntries: ['/analytics'] },
    );

    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getByText('Partial total · 1 unavailable')).toBeInTheDocument();
    expect(screen.getByText('2 transactions')).toBeInTheDocument();
  });

  it('shows an all-unavailable yearly total instead of a numeric zero', () => {
    renderWithProviders(
      <YearlySpendingGrid
        yearlyData={[
          {
            year: 2026,
            yearLabel: '2026',
            totalSpending: null,
            transactionCount: 2,
            unavailableAmountCount: 2,
          },
        ]}
        currency="USD"
        viewMode="yearly"
        transactionType="debit"
        analyticsScope="all"
      />,
      { initialEntries: ['/analytics'] },
    );

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('All 2 amounts unavailable')).toBeInTheDocument();
    expect(screen.getByText('2 transactions')).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });
});
