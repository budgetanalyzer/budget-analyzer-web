import { describe, expect, it } from 'vitest';
import type { TransactionFilterValues } from '@/types/transactionFilters';
import type { ViewTransaction } from '@/types/view';
import { filterTransactions, hasActiveTransactionFilters } from '@/utils/transactionFilters';

const transactions: ViewTransaction[] = [
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
    membershipType: 'MATCHED',
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
    membershipType: 'PINNED',
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
    membershipType: 'MATCHED',
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
    membershipType: 'PINNED',
  },
];

const emptyFilters: TransactionFilterValues = {
  globalFilter: '',
  dateFilter: { from: null, to: null },
  bankNameFilter: null,
  accountIdFilter: null,
  typeFilter: null,
  amountFilter: { min: null, max: null },
};

function ids(filters: TransactionFilterValues): number[] {
  return filterTransactions(transactions, filters).map((transaction) => transaction.id);
}

describe('filterTransactions', () => {
  it('preserves input order and a transaction subtype', () => {
    const result: ViewTransaction[] = filterTransactions(transactions, emptyFilters);

    expect(result).toBe(transactions);
    expect(result.map((transaction) => transaction.membershipType)).toEqual([
      'MATCHED',
      'PINNED',
      'MATCHED',
      'PINNED',
    ]);
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
