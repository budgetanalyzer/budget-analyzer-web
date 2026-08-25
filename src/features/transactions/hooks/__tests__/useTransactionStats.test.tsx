import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTransactionStats } from '@/features/transactions/hooks/useTransactionStats';
import {
  buildMainStatsConfig,
  buildMonthlyStatsConfig,
} from '@/features/transactions/components/statsConfig';
import type { DisplayAmount } from '@/types/displayAmount';
import type { Transaction } from '@/types/transaction';

const transactions: Transaction[] = [
  {
    id: 1,
    accountId: 'checking',
    bankName: 'Bank',
    date: '2026-01-01',
    currencyIsoCode: 'USD',
    amount: 10,
    type: 'CREDIT',
    description: 'Credit',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    accountId: 'checking',
    bankName: 'Bank',
    date: '2026-01-31',
    currencyIsoCode: 'USD',
    amount: 4,
    type: 'DEBIT',
    description: 'Debit',
    createdAt: '2026-01-31T00:00:00Z',
    updatedAt: '2026-01-31T00:00:00Z',
  },
  {
    id: 3,
    accountId: 'checking',
    bankName: 'Bank',
    date: '2026-01-15',
    currencyIsoCode: 'GBP',
    amount: 100,
    type: 'DEBIT',
    description: 'Unavailable debit',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
];

function available(value: number): DisplayAmount {
  return {
    available: true,
    sourceMagnitude: value,
    sourceCurrency: 'USD',
    targetCurrency: 'USD',
    minorUnitCount: 2,
    value,
    rateLegs: [],
  };
}

function unavailable(sourceCurrency: string): DisplayAmount {
  return {
    available: false,
    sourceMagnitude: 100,
    sourceCurrency,
    targetCurrency: 'USD',
    reason: 'MISSING_SOURCE_RATE',
  };
}

describe('useTransactionStats', () => {
  it('omits unavailable amounts while retaining counts and marks totals and averages partial', () => {
    const displayAmounts = new Map<number, DisplayAmount>([
      [1, available(10)],
      [2, available(4)],
      [3, unavailable('GBP')],
    ]);
    const { result } = renderHook(() => useTransactionStats({ transactions, displayAmounts }));

    expect(result.current.stats).toEqual({
      totalTransactions: 3,
      totalCredits: 10,
      totalDebits: 4,
      netBalance: 6,
      availableAmountCount: 2,
      unavailableAmountCount: 1,
      availableCreditAmountCount: 1,
      unavailableCreditAmountCount: 0,
      availableDebitAmountCount: 1,
      unavailableDebitAmountCount: 1,
      isPartial: true,
      earliestDate: '2026-01-01',
      latestDate: '2026-01-31',
    });
    expect(result.current.monthlyAverages).toMatchObject({
      avgTransactionsPerMonth: 3,
      avgCreditsPerMonth: 10,
      avgDebitsPerMonth: 4,
      avgNetBalancePerMonth: 6,
      unavailableAmountCount: 1,
      isPartial: true,
      dateRange: '30 days',
    });

    const mainConfig = buildMainStatsConfig(result.current.stats, 'USD');
    const monthlyConfig = buildMonthlyStatsConfig(result.current.monthlyAverages, 'USD');
    expect(mainConfig[1].description).toBe('Income received');
    expect(mainConfig[2].description).toContain('Partial; 1 unavailable');
    expect(monthlyConfig[1].description).toBe('Average monthly income');
    expect(monthlyConfig[2].description).toContain('Partial; 1 unavailable');
  });

  it('renders all-unavailable monetary totals and averages as unavailable instead of zero', () => {
    const displayAmounts = new Map<number, DisplayAmount>([
      [1, unavailable('EUR')],
      [2, unavailable('GBP')],
      [3, unavailable('GBP')],
    ]);
    const { result } = renderHook(() => useTransactionStats({ transactions, displayAmounts }));

    expect(result.current.stats).toMatchObject({
      totalTransactions: 3,
      totalCredits: null,
      totalDebits: null,
      netBalance: null,
      availableAmountCount: 0,
      unavailableAmountCount: 3,
      isPartial: false,
    });
    expect(result.current.monthlyAverages).toMatchObject({
      avgCreditsPerMonth: null,
      avgDebitsPerMonth: null,
      avgNetBalancePerMonth: null,
    });

    const mainConfig = buildMainStatsConfig(result.current.stats, 'USD');
    const monthlyConfig = buildMonthlyStatsConfig(result.current.monthlyAverages, 'USD');
    expect(mainConfig.slice(1).map((item) => item.value)).toEqual([
      'Unavailable',
      'Unavailable',
      'Unavailable',
    ]);
    expect(monthlyConfig.slice(1).map((item) => item.value)).toEqual([
      'Unavailable',
      'Unavailable',
      'Unavailable',
    ]);
  });
});
