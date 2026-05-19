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
  const excludedIds = new Set(membership.excluded);
  const membershipTypeById = new Map<number, 'MATCHED' | 'PINNED'>();

  membership.matched.forEach((id) => {
    if (!excludedIds.has(id) && !membershipTypeById.has(id)) {
      membershipTypeById.set(id, 'MATCHED');
    }
  });

  membership.pinned.forEach((id) => {
    if (!excludedIds.has(id)) {
      membershipTypeById.set(id, 'PINNED');
    }
  });

  const visibleIds = Array.from(membershipTypeById.keys());

  if (!cachedTransactions) {
    // Cache not ready - all visible IDs are missing
    return {
      viewTransactions: [],
      missingIds: visibleIds,
    };
  }

  // Build lookup map for O(1) access
  const transactionMap = new Map<number, Transaction>();
  cachedTransactions.forEach((t) => {
    transactionMap.set(t.id, t);
  });

  const viewTransactions: ViewTransaction[] = [];
  const missingIds: number[] = [];

  visibleIds.forEach((id) => {
    const txn = transactionMap.get(id);
    const membershipType = membershipTypeById.get(id);

    if (txn) {
      viewTransactions.push({
        ...txn,
        membershipType: membershipType!,
      });
    } else {
      missingIds.push(id);
    }
  });

  return { viewTransactions, missingIds };
}
