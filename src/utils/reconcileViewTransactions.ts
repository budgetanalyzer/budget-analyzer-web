// src/utils/reconcileViewTransactions.ts
import { Transaction } from '@/types/transaction';
import { ViewTransaction, ViewMembershipResponse } from '@/types/view';

/**
 * Reconcile view membership response with cached transactions.
 *
 * @param membership - Response from view membership API (transaction IDs)
 * @param cachedTransactions - All transactions from React Query cache
 * @returns Object with ViewTransactions and missing IDs
 */
export function reconcileViewTransactions(
  membership: ViewMembershipResponse,
  cachedTransactions: Transaction[] | undefined,
): {
  viewTransactions: ViewTransaction[];
  missingIds: number[];
} {
  if (!cachedTransactions) {
    // Cache not ready - all IDs are missing
    const allIds = [...membership.matched, ...membership.pinned];
    return {
      viewTransactions: [],
      missingIds: allIds,
    };
  }

  // Build lookup map for O(1) access
  const transactionMap = new Map<number, Transaction>();
  cachedTransactions.forEach((t) => {
    transactionMap.set(t.id, t);
  });

  const viewTransactions: ViewTransaction[] = [];
  const missingIds: number[] = [];

  // Process matched transactions
  membership.matched.forEach((id) => {
    const txn = transactionMap.get(id);
    if (txn) {
      viewTransactions.push({
        ...txn,
        membershipType: 'MATCHED',
      });
    } else {
      missingIds.push(id);
    }
  });

  // Process pinned transactions
  membership.pinned.forEach((id) => {
    const txn = transactionMap.get(id);
    if (txn) {
      viewTransactions.push({
        ...txn,
        membershipType: 'PINNED',
      });
    } else {
      missingIds.push(id);
    }
  });

  return { viewTransactions, missingIds };
}
