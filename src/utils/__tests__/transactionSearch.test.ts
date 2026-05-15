import { describe, expect, it } from 'vitest';
import { filterTransactionsByTableSearch } from '@/utils/transactionSearch';

const transactions = [
  {
    id: 1,
    description: 'Coffee shop purchase',
    bankName: 'Alpha Bank',
  },
  {
    id: 2,
    description: 'Grocery market',
    bankName: 'Coffee Credit Union',
  },
  {
    id: 3,
    description: 'Monthly train pass',
    bankName: 'Transit Bank',
  },
  {
    id: 4,
    description: 'Whole Foods Market',
    bankName: 'Beta Bank',
  },
];

describe('filterTransactionsByTableSearch', () => {
  it('matches bare terms against descriptions', () => {
    expect(filterTransactionsByTableSearch(transactions, 'train')).toEqual([transactions[2]]);
  });

  it('matches bare terms against bank names', () => {
    expect(filterTransactionsByTableSearch(transactions, 'credit')).toEqual([transactions[1]]);
  });

  it('matches quoted phrases', () => {
    expect(filterTransactionsByTableSearch(transactions, '"whole foods"')).toEqual([
      transactions[3],
    ]);
  });

  it('ORs multiple terms together', () => {
    expect(filterTransactionsByTableSearch(transactions, 'train coffee')).toEqual([
      transactions[0],
      transactions[1],
      transactions[2],
    ]);
  });

  it('returns all rows for blank input', () => {
    expect(filterTransactionsByTableSearch(transactions, '   ')).toBe(transactions);
  });
});
