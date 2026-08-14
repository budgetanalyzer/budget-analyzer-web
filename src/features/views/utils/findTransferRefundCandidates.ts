import type { ExchangeRateResponse } from '@/types/currency';
import type { Transaction } from '@/types/transaction';
import type { ViewTransaction } from '@/types/view';
import type {
  TransferRefundCandidate,
  TransferRefundCandidateKind,
} from '@/features/views/types/transferRefundReview';
import { findNearestExchangeRate } from '@/utils/currency';
import { compareLocalDates, getDaysBetween } from '@/utils/dates';

type ExchangeRateMap = Map<string, Map<string, ExchangeRateResponse>>;
type AccountRelationship = 'SAME' | 'DIFFERENT' | 'AMBIGUOUS';

interface NormalizedTransaction {
  transaction: Transaction;
  amountUsdCents: number;
  descriptionTokens: Set<string>;
}

interface CandidateEdge {
  kind: TransferRefundCandidateKind;
  debit: NormalizedTransaction;
  credit: NormalizedTransaction;
  absoluteDayDistance: number;
  amountDifferenceUsdCents: number;
  amountDifferenceBasisPoints: number;
  sharedDescriptionTokens: string[];
}

const USD_CENTS_PER_UNIT = 100;

const REFUND_MAX_DAYS = 90;
const REFUND_PERCENT_TOLERANCE = 0.03;
const REFUND_FIXED_TOLERANCE_USD_CENTS = 100;

const TRANSFER_MAX_DAYS = 7;
const TRANSFER_PERCENT_TOLERANCE = 0.05;
const TRANSFER_FIXED_TOLERANCE_USD_CENTS = 500;

// These describe statement mechanics rather than a merchant or employer. Transfer terms are
// intentionally retained because they can help explain a transfer candidate without gating it.
const DESCRIPTION_BOILERPLATE_TOKENS = new Set([
  'card',
  'credit',
  'debit',
  'payment',
  'pending',
  'posted',
  'purchase',
  'refund',
  'transaction',
]);

function normalizeIdentity(value: string | null | undefined): string | null {
  const normalized = value?.normalize('NFKC').trim().toLocaleLowerCase();
  return normalized ? normalized : null;
}

function getAccountRelationship(debit: Transaction, credit: Transaction): AccountRelationship {
  const debitBank = normalizeIdentity(debit.bankName);
  const creditBank = normalizeIdentity(credit.bankName);

  if (!debitBank || !creditBank) {
    return 'AMBIGUOUS';
  }

  if (debitBank !== creditBank) {
    return 'DIFFERENT';
  }

  const debitAccount = normalizeIdentity(debit.accountId);
  const creditAccount = normalizeIdentity(credit.accountId);

  if (!debitAccount || !creditAccount) {
    return 'AMBIGUOUS';
  }

  return debitAccount === creditAccount ? 'SAME' : 'DIFFERENT';
}

function getMeaningfulDescriptionTokens(description: string): Set<string> {
  const normalizedDescription = description.normalize('NFKC').toLocaleLowerCase();
  const tokens = normalizedDescription.match(/[\p{L}\p{N}]+/gu) ?? [];

  return new Set(
    tokens.filter((token) => token.length > 1 && !DESCRIPTION_BOILERPLATE_TOKENS.has(token)),
  );
}

function getSharedDescriptionTokens(debit: Set<string>, credit: Set<string>): string[] {
  return [...debit].filter((token) => credit.has(token)).sort();
}

function normalizeAmountToUsdCents(
  transaction: Transaction,
  exchangeRates: ExchangeRateMap,
): number | null {
  const absoluteAmount = Math.abs(transaction.amount);

  if (!Number.isFinite(absoluteAmount) || absoluteAmount === 0) {
    return null;
  }

  const currency = transaction.currencyIsoCode.trim().toLocaleUpperCase();
  let amountUsd = absoluteAmount;

  if (currency !== 'USD') {
    const exchangeRate = findNearestExchangeRate(transaction.date, currency, exchangeRates);
    if (
      !exchangeRate ||
      normalizeIdentity(exchangeRate.baseCurrency) !== 'usd' ||
      normalizeIdentity(exchangeRate.targetCurrency) !== currency.toLocaleLowerCase() ||
      !Number.isFinite(exchangeRate.rate) ||
      exchangeRate.rate <= 0
    ) {
      return null;
    }

    amountUsd = absoluteAmount / exchangeRate.rate;
  }

  if (!Number.isFinite(amountUsd)) {
    return null;
  }

  const amountUsdCents = Math.round(amountUsd * USD_CENTS_PER_UNIT);
  return Number.isFinite(amountUsdCents) && amountUsdCents > 0 ? amountUsdCents : null;
}

function normalizeTransactions(
  transactions: Transaction[],
  exchangeRates: ExchangeRateMap,
): NormalizedTransaction[] {
  return transactions.flatMap((transaction) => {
    const amountUsdCents = normalizeAmountToUsdCents(transaction, exchangeRates);
    if (amountUsdCents === null) {
      return [];
    }

    return [
      {
        transaction,
        amountUsdCents,
        descriptionTokens: getMeaningfulDescriptionTokens(transaction.description),
      },
    ];
  });
}

function isAmountWithinTolerance(
  amountDifferenceUsdCents: number,
  referenceAmountUsdCents: number,
  percentTolerance: number,
  fixedToleranceUsdCents: number,
): boolean {
  return (
    amountDifferenceUsdCents <=
    Math.max(referenceAmountUsdCents * percentTolerance, fixedToleranceUsdCents)
  );
}

function getAmountDifferenceBasisPoints(
  amountDifferenceUsdCents: number,
  debitAmountUsdCents: number,
): number {
  return Math.round((amountDifferenceUsdCents / debitAmountUsdCents) * 10_000);
}

function buildCandidateEdge(
  debit: NormalizedTransaction,
  credit: NormalizedTransaction,
): CandidateEdge | null {
  const accountRelationship = getAccountRelationship(debit.transaction, credit.transaction);
  if (accountRelationship === 'AMBIGUOUS') {
    return null;
  }

  const signedDayDistance = getDaysBetween(debit.transaction.date, credit.transaction.date);
  const absoluteDayDistance = Math.abs(signedDayDistance);
  const amountDifferenceUsdCents = Math.abs(debit.amountUsdCents - credit.amountUsdCents);
  const amountDifferenceBasisPoints = getAmountDifferenceBasisPoints(
    amountDifferenceUsdCents,
    debit.amountUsdCents,
  );
  const sharedDescriptionTokens = getSharedDescriptionTokens(
    debit.descriptionTokens,
    credit.descriptionTokens,
  );

  if (
    accountRelationship === 'SAME' &&
    signedDayDistance >= 0 &&
    signedDayDistance <= REFUND_MAX_DAYS &&
    sharedDescriptionTokens.length > 0 &&
    isAmountWithinTolerance(
      amountDifferenceUsdCents,
      debit.amountUsdCents,
      REFUND_PERCENT_TOLERANCE,
      REFUND_FIXED_TOLERANCE_USD_CENTS,
    )
  ) {
    return {
      kind: 'REFUND',
      debit,
      credit,
      absoluteDayDistance,
      amountDifferenceUsdCents,
      amountDifferenceBasisPoints,
      sharedDescriptionTokens,
    };
  }

  if (
    accountRelationship === 'DIFFERENT' &&
    absoluteDayDistance <= TRANSFER_MAX_DAYS &&
    isAmountWithinTolerance(
      amountDifferenceUsdCents,
      debit.amountUsdCents,
      TRANSFER_PERCENT_TOLERANCE,
      TRANSFER_FIXED_TOLERANCE_USD_CENTS,
    )
  ) {
    return {
      kind: 'TRANSFER',
      debit,
      credit,
      absoluteDayDistance,
      amountDifferenceUsdCents,
      amountDifferenceBasisPoints,
      sharedDescriptionTokens,
    };
  }

  return null;
}

function compareCandidateEdges(left: CandidateEdge, right: CandidateEdge): number {
  return (
    left.amountDifferenceUsdCents - right.amountDifferenceUsdCents ||
    left.absoluteDayDistance - right.absoluteDayDistance ||
    right.sharedDescriptionTokens.length - left.sharedDescriptionTokens.length ||
    left.debit.transaction.id - right.debit.transaction.id ||
    left.credit.transaction.id - right.credit.transaction.id
  );
}

function toCandidate(
  edge: CandidateEdge,
  visibleTransactionIds: Set<number>,
): TransferRefundCandidate {
  const debit = edge.debit.transaction;
  const credit = edge.credit.transaction;

  return {
    key: `${edge.kind}:${debit.id}:${credit.id}`,
    kind: edge.kind,
    debit,
    credit,
    absoluteDayDistance: edge.absoluteDayDistance,
    normalizedDebitAmountUsdCents: edge.debit.amountUsdCents,
    normalizedCreditAmountUsdCents: edge.credit.amountUsdCents,
    amountDifferenceBasisPoints: edge.amountDifferenceBasisPoints,
    sharedDescriptionTokens: edge.sharedDescriptionTokens,
    eligibleExclusionTransactionIds: [debit.id, credit.id].filter((transactionId) =>
      visibleTransactionIds.has(transactionId),
    ),
  };
}

/**
 * Finds possible one-to-one refunds and internal transfers using only the supplied transaction,
 * visible saved-view membership, and exchange-rate snapshots.
 */
export function findTransferRefundCandidates(
  transactions: Transaction[],
  visibleViewTransactions: ViewTransaction[],
  exchangeRates: ExchangeRateMap,
): TransferRefundCandidate[] {
  const visibleTransactionIds = new Set(
    visibleViewTransactions.map((transaction) => transaction.id),
  );
  const normalizedTransactions = normalizeTransactions(transactions, exchangeRates);
  const debits = normalizedTransactions.filter(({ transaction }) => transaction.type === 'DEBIT');
  const credits = normalizedTransactions.filter(({ transaction }) => transaction.type === 'CREDIT');
  const edges: CandidateEdge[] = [];

  for (const credit of credits) {
    for (const debit of debits) {
      if (
        !visibleTransactionIds.has(debit.transaction.id) &&
        !visibleTransactionIds.has(credit.transaction.id)
      ) {
        continue;
      }

      const edge = buildCandidateEdge(debit, credit);
      if (edge) {
        edges.push(edge);
      }
    }
  }

  edges.sort(compareCandidateEdges);

  const retainedTransactionIds = new Set<number>();
  const candidates: TransferRefundCandidate[] = [];

  for (const edge of edges) {
    const debitId = edge.debit.transaction.id;
    const creditId = edge.credit.transaction.id;
    if (retainedTransactionIds.has(debitId) || retainedTransactionIds.has(creditId)) {
      continue;
    }

    retainedTransactionIds.add(debitId);
    retainedTransactionIds.add(creditId);
    candidates.push(toCandidate(edge, visibleTransactionIds));
  }

  return candidates.sort(
    (left, right) =>
      compareLocalDates(right.credit.date, left.credit.date) || right.credit.id - left.credit.id,
  );
}
