import { describe, expect, it } from 'vitest';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import type { Transaction } from '@/types/transaction';
import type { DisplayAmount } from '@/types/displayAmount';
import {
  filterTransactions,
  filterTransactionsByDisplayAmount,
  hasActiveTransactionFilters,
} from '@/utils/transactionFilters';

const transactions: Transaction[] = [
  {
    id: 1,
    accountId: 'checking',
    bankName: 'Bank B',
    date: '2026-01-01',
    currencyIsoCode: 'USD',
    amount: -5,
    type: 'DEBIT',
    description: 'Coffee shop',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 2,
    accountId: 'savings',
    bankName: 'Bank A',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: 100,
    type: 'CREDIT',
    description: 'Salary',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 3,
    accountId: 'checking',
    bankName: 'Bank A',
    date: '2026-02-01',
    currencyIsoCode: 'USD',
    amount: -250,
    type: 'DEBIT',
    description: 'Rent',
    createdAt: '2026-02-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 4,
    accountId: 'checking',
    bankName: 'Bank B',
    date: '2026-02-15',
    currencyIsoCode: 'USD',
    amount: 30,
    type: 'CREDIT',
    description: 'COFFEE refund',
    createdAt: '2026-02-15T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
];

const emptyFilters: TransactionFilterValues = {
  globalFilter: '',
  dateFilter: { from: null, to: null },
  bankNameFilter: null,
  accountIdFilter: null,
  typeFilter: null,
  amountFilter: { min: null, max: null },
  amountCurrency: null,
};

function ids(filters: TransactionFilterValues): number[] {
  return filterTransactions(transactions, filters).map((transaction) => transaction.id);
}

describe('filterTransactions', () => {
  it('preserves input order and identity without filters', () => {
    const result: Transaction[] = filterTransactions(transactions, emptyFilters);

    expect(result).toBe(transactions);
    expect(result.map((transaction) => transaction.id)).toEqual([1, 2, 3, 4]);
  });

  it('uses the case-insensitive description-only table search', () => {
    expect(ids({ ...emptyFilters, globalFilter: 'coffee' })).toEqual([1, 4]);
    expect(ids({ ...emptyFilters, globalFilter: 'bank b' })).toEqual([]);
  });

  it('applies an inclusive from date without requiring a to date', () => {
    expect(ids({ ...emptyFilters, dateFilter: { from: '2026-01-15', to: null } })).toEqual([
      2, 3, 4,
    ]);
  });

  it('applies an inclusive to date without requiring a from date', () => {
    expect(ids({ ...emptyFilters, dateFilter: { from: null, to: '2026-01-15' } })).toEqual([1, 2]);
  });

  it('matches bank names exactly', () => {
    expect(ids({ ...emptyFilters, bankNameFilter: 'Bank A' })).toEqual([2, 3]);
    expect(ids({ ...emptyFilters, bankNameFilter: 'bank a' })).toEqual([]);
  });

  it('matches account IDs exactly', () => {
    expect(ids({ ...emptyFilters, accountIdFilter: 'savings' })).toEqual([2]);
  });

  it('matches transaction types exactly', () => {
    expect(ids({ ...emptyFilters, typeFilter: 'DEBIT' })).toEqual([1, 3]);
  });

  it('compares minimum and maximum amounts against absolute values', () => {
    expect(ids({ ...emptyFilters, amountFilter: { min: 30, max: null } })).toEqual([2, 3, 4]);
    expect(ids({ ...emptyFilters, amountFilter: { min: null, max: 100 } })).toEqual([1, 2, 4]);
  });

  it('combines every active filter dimension', () => {
    expect(
      ids({
        globalFilter: 'coffee',
        dateFilter: { from: '2026-02-01', to: '2026-02-28' },
        bankNameFilter: 'Bank B',
        accountIdFilter: 'checking',
        typeFilter: 'CREDIT',
        amountFilter: { min: 20, max: 50 },
        amountCurrency: 'USD',
      }),
    ).toEqual([4]);
  });
});

describe('hasActiveTransactionFilters', () => {
  it('detects empty and active shared filter values', () => {
    expect(hasActiveTransactionFilters(emptyFilters)).toBe(false);
    expect(
      hasActiveTransactionFilters({
        ...emptyFilters,
        amountFilter: { min: 0, max: null },
      }),
    ).toBe(true);
  });
});

describe('filterTransactionsByDisplayAmount', () => {
  const available = (value: number): DisplayAmount => ({
    available: true,
    sourceMagnitude: value,
    sourceCurrency: 'USD',
    targetCurrency: 'USD',
    minorUnitCount: 2,
    value,
    rateLegs: [],
  });
  const unavailable: DisplayAmount = {
    available: false,
    sourceMagnitude: 30,
    sourceCurrency: 'GBP',
    targetCurrency: 'USD',
    reason: 'MISSING_SOURCE_RATE',
  };
  const displayAmounts = new Map<number, DisplayAmount>([
    [1, available(10)],
    [2, available(9.99)],
    [3, available(10.01)],
    [4, unavailable],
  ]);

  it('compares inclusive quantized display values after non-amount filters', () => {
    const result = filterTransactionsByDisplayAmount(
      transactions,
      {
        ...emptyFilters,
        globalFilter: 'coffee',
        amountFilter: { min: 10, max: 10 },
        amountCurrency: 'USD',
      },
      displayAmounts,
    );

    expect(result.transactions.map((transaction) => transaction.id)).toEqual([1]);
    expect(result.unavailableAmountCount).toBe(1);
  });

  it('retains unavailable conversions when no amount range is active', () => {
    const result = filterTransactionsByDisplayAmount(transactions, emptyFilters, displayAmounts);

    expect(result.transactions).toBe(transactions);
    expect(result.unavailableAmountCount).toBe(0);
  });
});
