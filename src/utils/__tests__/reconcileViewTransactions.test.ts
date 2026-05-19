import { describe, expect, it } from 'vitest';
import { reconcileViewTransactions } from '@/utils/reconcileViewTransactions';
import type { Transaction } from '@/types/transaction';
import type { ViewMembershipResponse } from '@/types/view';

function transaction(overrides: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  const { id, ...rest } = overrides;

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
    ...rest,
  };
}

describe('reconcileViewTransactions', () => {
  it('marks cached matched and pinned transactions with their membership type', () => {
    const membership: ViewMembershipResponse = {
      matched: [1],
      pinned: [2],
      excluded: [],
    };

    const result = reconcileViewTransactions(membership, [
      transaction({ id: 1 }),
      transaction({ id: 2 }),
    ]);

    expect(result.viewTransactions).toEqual([
      expect.objectContaining({ id: 1, membershipType: 'MATCHED' }),
      expect.objectContaining({ id: 2, membershipType: 'PINNED' }),
    ]);
    expect(result.missingIds).toEqual([]);
  });

  it('omits excluded transactions from visible rows and missing IDs', () => {
    const membership: ViewMembershipResponse = {
      matched: [1, 2],
      pinned: [3],
      excluded: [2, 3],
    };

    const result = reconcileViewTransactions(membership, [
      transaction({ id: 1 }),
      transaction({ id: 2 }),
      transaction({ id: 3 }),
    ]);

    expect(result.viewTransactions).toEqual([
      expect.objectContaining({ id: 1, membershipType: 'MATCHED' }),
    ]);
    expect(result.missingIds).toEqual([]);
  });

  it('includes restored transactions after they leave the excluded set', () => {
    const membership: ViewMembershipResponse = {
      matched: [1, 2],
      pinned: [],
      excluded: [],
    };

    const result = reconcileViewTransactions(membership, [
      transaction({ id: 1 }),
      transaction({ id: 2 }),
    ]);

    expect(result.viewTransactions.map((row) => row.id)).toEqual([1, 2]);
  });

  it('deduplicates duplicate membership IDs and keeps pinned membership precedence', () => {
    const membership: ViewMembershipResponse = {
      matched: [1, 1, 2],
      pinned: [2, 2],
      excluded: [],
    };

    const result = reconcileViewTransactions(membership, [
      transaction({ id: 1 }),
      transaction({ id: 2 }),
    ]);

    expect(result.viewTransactions).toEqual([
      expect.objectContaining({ id: 1, membershipType: 'MATCHED' }),
      expect.objectContaining({ id: 2, membershipType: 'PINNED' }),
    ]);
    expect(result.missingIds).toEqual([]);
  });

  it('returns missing visible transaction IDs when cache entries are absent', () => {
    const membership: ViewMembershipResponse = {
      matched: [1, 2],
      pinned: [3],
      excluded: [4],
    };

    const result = reconcileViewTransactions(membership, [transaction({ id: 1 })]);

    expect(result.viewTransactions).toEqual([
      expect.objectContaining({ id: 1, membershipType: 'MATCHED' }),
    ]);
    expect(result.missingIds).toEqual([2, 3]);
  });

  it('treats every visible membership ID as missing when the transaction cache is unavailable', () => {
    const membership: ViewMembershipResponse = {
      matched: [1, 2],
      pinned: [2, 3],
      excluded: [1],
    };

    const result = reconcileViewTransactions(membership, undefined);

    expect(result.viewTransactions).toEqual([]);
    expect(result.missingIds).toEqual([2, 3]);
  });
});
