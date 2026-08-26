import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAnalyticsData } from '@/features/analytics/hooks/useAnalyticsData';
import type { ExchangeRateResponse } from '@/types/currency';
import type { Transaction } from '@/types/transaction';
import { buildExchangeRateMap } from '@/utils/currency';

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    accountId: 'checking',
    bankName: 'Test Bank',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: 1.4,
    type: 'DEBIT',
    description: 'Transaction',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...overrides,
  };
}

function rate(targetCurrency: string, value: number): ExchangeRateResponse {
  return {
    baseCurrency: 'USD',
    targetCurrency,
    date: '2026-01-15',
    publishedDate: '2026-01-15',
    rate: value,
  };
}

describe('useAnalyticsData', () => {
  it('sums per-transaction quantized values and counts unavailable qualifying transactions', () => {
    const transactions = [
      transaction({ id: 1 }),
      transaction({ id: 2 }),
      transaction({ id: 3, currencyIsoCode: 'GBP', amount: 20 }),
      transaction({ id: 4, type: 'CREDIT', amount: 50 }),
    ];
    const rates = buildExchangeRateMap([rate('JPY', 1)]);

    const { result } = renderHook(() =>
      useAnalyticsData(transactions, 'JPY', rates, 2026, 'debit'),
    );
    const january = result.current.monthlySpending[0];
    const year = result.current.yearlySpending[0];

    expect(january).toMatchObject({
      totalSpending: 2,
      transactionCount: 3,
      unavailableAmountCount: 1,
    });
    expect(year).toMatchObject({
      totalSpending: 2,
      transactionCount: 3,
      unavailableAmountCount: 1,
    });
  });

  it('distinguishes an all-unavailable period from an empty period with a real zero', () => {
    const transactions = [transaction({ currencyIsoCode: 'GBP', amount: 20 })];

    const { result } = renderHook(() =>
      useAnalyticsData(transactions, 'USD', new Map(), 2026, 'debit'),
    );

    expect(result.current.monthlySpending[0]).toMatchObject({
      totalSpending: null,
      transactionCount: 1,
      unavailableAmountCount: 1,
    });
    expect(result.current.monthlySpending[1]).toMatchObject({
      totalSpending: 0,
      transactionCount: 0,
      unavailableAmountCount: 0,
    });
    expect(result.current.yearlySpending[0]?.totalSpending).toBeNull();
  });

  it('preserves transaction-type and year selection', () => {
    const transactions = [
      transaction({ id: 1, date: '2025-01-15', amount: 10 }),
      transaction({ id: 2, date: '2026-01-15', amount: 20, type: 'CREDIT' }),
    ];

    const { result } = renderHook(() =>
      useAnalyticsData(transactions, 'USD', new Map(), 2026, 'credit'),
    );

    expect(result.current.monthlySpending[0]).toMatchObject({
      totalSpending: 20,
      transactionCount: 1,
    });
    expect(result.current.yearsWithTransactions).toEqual([2026]);
    expect(result.current.earliestYear).toBe(2025);
    expect(result.current.latestYear).toBe(2026);
  });
});
