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
  {
    id: 5,
    description: 'Withdrawal from CAPITAL ONE',
    bankName: 'National Checking',
  },
  {
    id: 6,
    description: 'Monthly utility bill',
    bankName: 'Capital One',
  },
  {
    id: 7,
    description: 'Withdrawal fee',
    bankName: 'Fee Bank',
  },
];

describe('filterTransactionsByTableSearch', () => {
  it('matches text against descriptions', () => {
    expect(filterTransactionsByTableSearch(transactions, 'train')).toEqual([transactions[2]]);
  });

  it('does not match bank names', () => {
    expect(filterTransactionsByTableSearch(transactions, 'credit')).toEqual([]);
  });

  it('matches the full search string instead of OR-ing individual words', () => {
    expect(filterTransactionsByTableSearch(transactions, 'Withdrawal from CAPITAL ONE')).toEqual([
      transactions[4],
    ]);
  });

  it('is case insensitive', () => {
    expect(filterTransactionsByTableSearch(transactions, 'withdrawal from capital one')).toEqual([
      transactions[4],
    ]);
  });

  it('returns all rows for blank input', () => {
    expect(filterTransactionsByTableSearch(transactions, '   ')).toBe(transactions);
  });
});
