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
type CandidateEdgeMembership = 'ALL_VISIBLE' | 'USES_NON_VISIBLE';

interface PreparedTransaction {
  transaction: Transaction;
  currencyCode: string;
  absoluteAmount: number;
  descriptionTokens: Set<string>;
}

interface ComparisonAmounts {
  debitAmountCents: number;
  creditAmountCents: number;
  amountDifferenceCents: number;
}

interface CandidateEdge {
  kind: TransferRefundCandidateKind;
  debit: PreparedTransaction;
  credit: PreparedTransaction;
  absoluteDayDistance: number;
  amountDifferenceBasisPoints: number;
  sharedDescriptionTokens: string[];
  membership: CandidateEdgeMembership;
}

const CENTS_PER_COMPARISON_UNIT = 100;

const REFUND_MAX_DAYS = 90;
const REFUND_PERCENT_TOLERANCE = 0.03;
const REFUND_FIXED_TOLERANCE_CENTS = 100;

const TRANSFER_MAX_DAYS = 7;
const TRANSFER_PERCENT_TOLERANCE = 0.05;

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
  const normalized = value?.normalize('NFKC').trim().toLowerCase();
  return normalized ? normalized : null;
}

function normalizeCurrencyCode(value: string): string {
  return value.normalize('NFKC').trim().toUpperCase();
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
  const normalizedDescription = description.normalize('NFKC').toLowerCase();
  const tokens = normalizedDescription.match(/[\p{L}\p{N}]+/gu) ?? [];

  return new Set(
    tokens.filter((token) => token.length > 1 && !DESCRIPTION_BOILERPLATE_TOKENS.has(token)),
  );
}

function getSharedDescriptionTokens(debit: Set<string>, credit: Set<string>): string[] {
  return [...debit].filter((token) => credit.has(token)).sort();
}

function roundPositiveAmountToCents(amount: number): number | null {
  const amountCents = Math.round(amount * CENTS_PER_COMPARISON_UNIT);
  return Number.isFinite(amountCents) && amountCents > 0 ? amountCents : null;
}

function convertAmountToUsdCents(
  preparedTransaction: PreparedTransaction,
  exchangeRates: ExchangeRateMap,
): number | null {
  const { transaction, currencyCode, absoluteAmount } = preparedTransaction;
  let amountUsd = absoluteAmount;

  if (currencyCode !== 'USD') {
    const exchangeRate = findNearestExchangeRate(transaction.date, currencyCode, exchangeRates);
    if (
      !exchangeRate ||
      normalizeCurrencyCode(exchangeRate.baseCurrency) !== 'USD' ||
      normalizeCurrencyCode(exchangeRate.targetCurrency) !== currencyCode ||
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

  return roundPositiveAmountToCents(amountUsd);
}

function prepareTransactions(transactions: Transaction[]): PreparedTransaction[] {
  return transactions.flatMap((transaction) => {
    const currencyCode = normalizeCurrencyCode(transaction.currencyIsoCode);
    const absoluteAmount = Math.abs(transaction.amount);

    if (!currencyCode || !Number.isFinite(absoluteAmount) || absoluteAmount === 0) {
      return [];
    }

    return [
      {
        transaction,
        currencyCode,
        absoluteAmount,
        descriptionTokens: getMeaningfulDescriptionTokens(transaction.description),
      },
    ];
  });
}

function getUsdAmountCents(
  transaction: PreparedTransaction,
  exchangeRates: ExchangeRateMap,
  usdAmountCache: Map<PreparedTransaction, number | null>,
): number | null {
  if (usdAmountCache.has(transaction)) {
    return usdAmountCache.get(transaction) ?? null;
  }

  const amountUsdCents = convertAmountToUsdCents(transaction, exchangeRates);
  usdAmountCache.set(transaction, amountUsdCents);
  return amountUsdCents;
}

function getComparisonAmounts(
  debit: PreparedTransaction,
  credit: PreparedTransaction,
  exchangeRates: ExchangeRateMap,
  usdAmountCache: Map<PreparedTransaction, number | null>,
): ComparisonAmounts | null {
  const isSameCurrency = debit.currencyCode === credit.currencyCode;
  const debitAmountCents = isSameCurrency
    ? roundPositiveAmountToCents(debit.absoluteAmount)
    : getUsdAmountCents(debit, exchangeRates, usdAmountCache);
  const creditAmountCents = isSameCurrency
    ? roundPositiveAmountToCents(credit.absoluteAmount)
    : getUsdAmountCents(credit, exchangeRates, usdAmountCache);

  if (debitAmountCents === null || creditAmountCents === null) {
    return null;
  }

  return {
    debitAmountCents,
    creditAmountCents,
    amountDifferenceCents: Math.abs(debitAmountCents - creditAmountCents),
  };
}

function isAmountWithinTolerance(
  amountDifferenceCents: number,
  referenceAmountCents: number,
  percentTolerance: number,
  fixedToleranceCents: number,
): boolean {
  return (
    amountDifferenceCents <= Math.max(referenceAmountCents * percentTolerance, fixedToleranceCents)
  );
}

function getAmountDifferenceBasisPoints(
  amountDifferenceCents: number,
  debitAmountCents: number,
): number {
  return Math.round((amountDifferenceCents / debitAmountCents) * 10_000);
}

function buildCandidateEdge(
  debit: PreparedTransaction,
  credit: PreparedTransaction,
  exchangeRates: ExchangeRateMap,
  usdAmountCache: Map<PreparedTransaction, number | null>,
  membership: CandidateEdgeMembership,
): CandidateEdge | null {
  const accountRelationship = getAccountRelationship(debit.transaction, credit.transaction);
  if (accountRelationship === 'AMBIGUOUS') {
    return null;
  }

  const signedDayDistance = getDaysBetween(debit.transaction.date, credit.transaction.date);
  const absoluteDayDistance = Math.abs(signedDayDistance);
  const comparisonAmounts = getComparisonAmounts(debit, credit, exchangeRates, usdAmountCache);
  if (!comparisonAmounts) {
    return null;
  }

  const { debitAmountCents, amountDifferenceCents } = comparisonAmounts;
  const amountDifferenceBasisPoints = getAmountDifferenceBasisPoints(
    amountDifferenceCents,
    debitAmountCents,
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
      amountDifferenceCents,
      debitAmountCents,
      REFUND_PERCENT_TOLERANCE,
      REFUND_FIXED_TOLERANCE_CENTS,
    )
  ) {
    return {
      kind: 'REFUND',
      debit,
      credit,
      absoluteDayDistance,
      amountDifferenceBasisPoints,
      sharedDescriptionTokens,
      membership,
    };
  }

  if (
    accountRelationship === 'DIFFERENT' &&
    absoluteDayDistance <= TRANSFER_MAX_DAYS &&
    amountDifferenceCents <= debitAmountCents * TRANSFER_PERCENT_TOLERANCE
  ) {
    return {
      kind: 'TRANSFER',
      debit,
      credit,
      absoluteDayDistance,
      amountDifferenceBasisPoints,
      sharedDescriptionTokens,
      membership,
    };
  }

  return null;
}

function getCandidateEdgeMembership(
  debit: PreparedTransaction,
  credit: PreparedTransaction,
  visibleTransactionIds: Set<number>,
): CandidateEdgeMembership {
  return visibleTransactionIds.has(debit.transaction.id) &&
    visibleTransactionIds.has(credit.transaction.id)
    ? 'ALL_VISIBLE'
    : 'USES_NON_VISIBLE';
}

function compareCandidateEdges(left: CandidateEdge, right: CandidateEdge): number {
  return (
    left.amountDifferenceBasisPoints - right.amountDifferenceBasisPoints ||
    left.absoluteDayDistance - right.absoluteDayDistance ||
    right.sharedDescriptionTokens.length - left.sharedDescriptionTokens.length ||
    Number(left.membership === 'USES_NON_VISIBLE') -
      Number(right.membership === 'USES_NON_VISIBLE') ||
    left.debit.transaction.id - right.debit.transaction.id ||
    left.credit.transaction.id - right.credit.transaction.id
  );
}

function toCandidate(
  edge: CandidateEdge,
  visibleTransactionIds: Set<number>,
  explicitlyExcludedTransactionIds: Set<number>,
): TransferRefundCandidate {
  const debit = edge.debit.transaction;
  const credit = edge.credit.transaction;

  return {
    key: `${edge.kind}:${debit.id}:${credit.id}`,
    kind: edge.kind,
    debit,
    credit,
    absoluteDayDistance: edge.absoluteDayDistance,
    amountDifferenceBasisPoints: edge.amountDifferenceBasisPoints,
    sharedDescriptionTokens: edge.sharedDescriptionTokens,
    explicitlyExcludedTransactionIds: [debit.id, credit.id].filter((transactionId) =>
      explicitlyExcludedTransactionIds.has(transactionId),
    ),
    eligibleExclusionTransactionIds: [debit.id, credit.id].filter(
      (transactionId) =>
        visibleTransactionIds.has(transactionId) &&
        !explicitlyExcludedTransactionIds.has(transactionId),
    ),
  };
}

/**
 * Finds possible one-to-one refunds and internal transfers using only the supplied transactions,
 * visible and explicitly excluded saved-view membership, and exchange-rate snapshots.
 */
export function findTransferRefundCandidates(
  transactions: Transaction[],
  visibleViewTransactions: ViewTransaction[],
  exchangeRates: ExchangeRateMap,
  explicitlyExcludedIds: number[] = [],
): TransferRefundCandidate[] {
  const visibleTransactionIds = new Set(
    visibleViewTransactions.map((transaction) => transaction.id),
  );
  const explicitlyExcludedTransactionIds = new Set(explicitlyExcludedIds);
  const preparedTransactions = prepareTransactions(transactions);
  const debits = preparedTransactions.filter(({ transaction }) => transaction.type === 'DEBIT');
  const credits = preparedTransactions.filter(({ transaction }) => transaction.type === 'CREDIT');
  const usdAmountCache = new Map<PreparedTransaction, number | null>();
  const edges: CandidateEdge[] = [];

  for (const credit of credits) {
    for (const debit of debits) {
      if (
        !visibleTransactionIds.has(debit.transaction.id) &&
        !visibleTransactionIds.has(credit.transaction.id)
      ) {
        continue;
      }

      const membership = getCandidateEdgeMembership(debit, credit, visibleTransactionIds);
      const edge = buildCandidateEdge(debit, credit, exchangeRates, usdAmountCache, membership);
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
    candidates.push(toCandidate(edge, visibleTransactionIds, explicitlyExcludedTransactionIds));
  }

  return candidates.sort(
    (left, right) =>
      compareLocalDates(right.credit.date, left.credit.date) || right.credit.id - left.credit.id,
  );
}
