import type { Transaction } from '@/types/transaction';

export type TransferRefundCandidateKind = 'REFUND' | 'TRANSFER';

interface TransferRefundCandidateBase {
  key: string;
  debit: Transaction;
  credit: Transaction;
  absoluteDayDistance: number;
  amountDifferenceBasisPoints: number;
  sharedDescriptionTokens: string[];
  eligibleRemovalTransactionIds: number[];
}

export interface RefundCandidate extends TransferRefundCandidateBase {
  kind: 'REFUND';
}

export interface TransferCandidate extends TransferRefundCandidateBase {
  kind: 'TRANSFER';
}

export type TransferRefundCandidate = RefundCandidate | TransferCandidate;
