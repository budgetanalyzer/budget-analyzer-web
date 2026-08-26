// src/utils/reconcileViewTransactions.ts
import type { Transaction } from '@/types/transaction';
import type { ViewMembershipResponse } from '@/types/view';

export interface ReconciledViewTransactions {
  transactions: Transaction[];
  missingTransactionIds: number[];
}

/**
 * Intersect ordered saved-view membership with one complete active transaction snapshot.
 * Missing IDs represent independently fetched cache skew and are diagnostic only.
 */
export function reconcileViewTransactions(
  membership: ViewMembershipResponse,
  transactions: Transaction[],
): ReconciledViewTransactions {
  const transactionById = new Map(
    transactions.map((transaction) => [transaction.id, transaction] as const),
  );
  const reconciledTransactions: Transaction[] = [];
  const missingTransactionIds: number[] = [];

  membership.transactionIds.forEach((transactionId) => {
    const transaction = transactionById.get(transactionId);

    if (transaction) {
      reconciledTransactions.push(transaction);
    } else {
      missingTransactionIds.push(transactionId);
    }
  });

  return {
    transactions: reconciledTransactions,
    missingTransactionIds,
  };
}
