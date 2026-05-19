import { describe, expect, it } from 'vitest';
import { filterTransactionsByCriteria } from '@/utils/filterTransactions';
import type { Transaction } from '@/types/transaction';
import type { ViewCriteriaApi } from '@/types/view';

function transaction(overrides: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  const { id, ...rest } = overrides;

  return {
    id,
    accountId: 'checking',
    bankName: 'Alpha Bank',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: -25,
    type: 'DEBIT',
    description: `Transaction ${id}`,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    ...rest,
  };
}

const transactions: Transaction[] = [
  transaction({
    id: 1,
    accountId: 'checking',
    bankName: 'Alpha Bank',
    date: '2026-01-01',
    currencyIsoCode: 'USD',
    amount: -12.5,
    type: 'DEBIT',
    description: 'Morning coffee',
  }),
  transaction({
    id: 2,
    accountId: 'savings',
    bankName: 'Beta Bank',
    date: '2026-01-31',
    currencyIsoCode: 'EUR',
    amount: 2500,
    type: 'CREDIT',
    description: 'Salary deposit',
  }),
  transaction({
    id: 3,
    accountId: 'checking',
    bankName: 'Alpha Bank',
    date: '2026-02-01',
    currencyIsoCode: 'USD',
    amount: -75,
    type: 'DEBIT',
    description: 'Grocery market',
  }),
];

function idsFor(criteria: ViewCriteriaApi) {
  return filterTransactionsByCriteria(transactions, criteria).map((row) => row.id);
}

describe('filterTransactionsByCriteria', () => {
  it('applies inclusive LocalDate boundaries', () => {
    expect(idsFor({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })).toEqual([1, 2]);
  });

  it('matches saved-view search text against descriptions only', () => {
    expect(idsFor({ searchText: 'alpha coffee' })).toEqual([1]);
    expect(idsFor({ searchText: 'Beta' })).toEqual([]);
  });

  it('filters by bank, account, currency, and transaction type', () => {
    expect(
      idsFor({
        bankNames: ['Alpha Bank'],
        accountIds: ['checking'],
        currencyIsoCodes: ['USD'],
        type: 'DEBIT',
      }),
    ).toEqual([1, 3]);
  });

  it('filters amount ranges by absolute transaction amount', () => {
    expect(idsFor({ minAmount: 50, maxAmount: 100 })).toEqual([3]);
    expect(idsFor({ minAmount: 2000 })).toEqual([2]);
  });

  it('combines criteria with AND semantics across filter groups', () => {
    expect(
      idsFor({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        searchText: 'coffee market',
        bankNames: ['Alpha Bank'],
        accountIds: ['checking'],
        currencyIsoCodes: ['USD'],
        minAmount: 10,
        maxAmount: 20,
        type: 'DEBIT',
      }),
    ).toEqual([1]);
  });
});
