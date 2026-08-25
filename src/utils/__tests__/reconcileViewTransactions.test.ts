import { describe, expect, it } from 'vitest';
import { reconcileViewTransactions } from '@/utils/reconcileViewTransactions';
import type { Transaction } from '@/types/transaction';

function transaction(id: number): Transaction {
  return {
    id,
    accountId: 'checking',
    bankName: 'Test Bank',
    date: '2026-01-01',
    currencyIsoCode: 'USD',
    amount: -10,
    type: 'DEBIT',
    description: `Transaction ${id}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('reconcileViewTransactions', () => {
  it('preserves deterministic membership order instead of transaction snapshot order', () => {
    const result = reconcileViewTransactions({ transactionIds: [3, 1, 2] }, [
      transaction(1),
      transaction(2),
      transaction(3),
    ]);

    expect(result.transactions.map(({ id }) => id)).toEqual([3, 1, 2]);
    expect(result.missingTransactionIds).toEqual([]);
  });

  it('skips missing active transactions and reports them diagnostically in membership order', () => {
    const result = reconcileViewTransactions({ transactionIds: [4, 1, 5, 2] }, [
      transaction(2),
      transaction(1),
    ]);

    expect(result.transactions.map(({ id }) => id)).toEqual([1, 2]);
    expect(result.missingTransactionIds).toEqual([4, 5]);
  });

  it('returns empty arrays for empty membership or an empty active snapshot', () => {
    expect(reconcileViewTransactions({ transactionIds: [] }, [transaction(1)])).toEqual({
      transactions: [],
      missingTransactionIds: [],
    });
    expect(reconcileViewTransactions({ transactionIds: [2, 1] }, [])).toEqual({
      transactions: [],
      missingTransactionIds: [2, 1],
    });
  });

  it('emits repeated membership IDs exactly as supplied by the authoritative response', () => {
    const result = reconcileViewTransactions({ transactionIds: [2, 2, 1] }, [
      transaction(1),
      transaction(2),
    ]);

    expect(result.transactions.map(({ id }) => id)).toEqual([2, 2, 1]);
  });
});
