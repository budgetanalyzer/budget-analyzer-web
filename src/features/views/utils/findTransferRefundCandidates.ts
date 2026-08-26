import type { ExchangeRateResponse } from '@/types/currency';
import type { Transaction } from '@/types/transaction';
import type {
  TransferRefundCandidate,
  TransferRefundCandidateKind,
} from '@/features/views/types/transferRefundReview';
import { compareLocalDates, getDaysBetween } from '@/utils/dates';
import { projectDisplayAmount } from '@/utils/displayAmount';

type ExchangeRateMap = Map<string, Map<string, ExchangeRateResponse>>;
type AccountRelationship = 'SAME' | 'DIFFERENT' | 'AMBIGUOUS';
type CandidateEdgeMembership = 'ALL_MEMBERS' | 'USES_NONMEMBER';

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

  if (!debitBank || !creditBank) return 'AMBIGUOUS';
  if (debitBank !== creditBank) return 'DIFFERENT';

  const debitAccount = normalizeIdentity(debit.accountId);
  const creditAccount = normalizeIdentity(credit.accountId);

  if (!debitAccount || !creditAccount) return 'AMBIGUOUS';
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
  const normalizedTransaction = {
    ...preparedTransaction.transaction,
    currencyIsoCode: preparedTransaction.currencyCode,
  };
  const displayAmount = projectDisplayAmount(normalizedTransaction, 'USD', exchangeRates);

  return displayAmount.available ? roundPositiveAmountToCents(displayAmount.value) : null;
}

function prepareTransactions(transactions: Transaction[]): PreparedTransaction[] {
  return transactions.flatMap((transaction) => {
    const currencyCode = normalizeCurrencyCode(transaction.currencyIsoCode);
    const absoluteAmount = Math.abs(transaction.amount);

    if (!currencyCode || !Number.isFinite(absoluteAmount) || absoluteAmount === 0) return [];

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

  if (debitAmountCents === null || creditAmountCents === null) return null;

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
  if (accountRelationship === 'AMBIGUOUS') return null;

  const signedDayDistance = getDaysBetween(debit.transaction.date, credit.transaction.date);
  const absoluteDayDistance = Math.abs(signedDayDistance);
  const comparisonAmounts = getComparisonAmounts(debit, credit, exchangeRates, usdAmountCache);
  if (!comparisonAmounts) return null;

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
  memberTransactionIds: Set<number>,
): CandidateEdgeMembership {
  return memberTransactionIds.has(debit.transaction.id) &&
    memberTransactionIds.has(credit.transaction.id)
    ? 'ALL_MEMBERS'
    : 'USES_NONMEMBER';
}

function compareCandidateEdges(left: CandidateEdge, right: CandidateEdge): number {
  return (
    left.amountDifferenceBasisPoints - right.amountDifferenceBasisPoints ||
    left.absoluteDayDistance - right.absoluteDayDistance ||
    right.sharedDescriptionTokens.length - left.sharedDescriptionTokens.length ||
    Number(left.membership === 'USES_NONMEMBER') - Number(right.membership === 'USES_NONMEMBER') ||
    left.debit.transaction.id - right.debit.transaction.id ||
    left.credit.transaction.id - right.credit.transaction.id
  );
}

function toCandidate(
  edge: CandidateEdge,
  memberTransactionIds: Set<number>,
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
    eligibleRemovalTransactionIds: [debit.id, credit.id].filter((transactionId) =>
      memberTransactionIds.has(transactionId),
    ),
  };
}

/**
 * Find one-to-one refunds and internal transfers. Nonmembers may be evidence, but every retained
 * candidate includes at least one current saved-view member and only member IDs are removable.
 */
export function findTransferRefundCandidates(
  transactions: Transaction[],
  memberIds: ReadonlySet<number>,
  exchangeRates: ExchangeRateMap,
): TransferRefundCandidate[] {
  const memberTransactionIds = new Set(memberIds);
  const preparedTransactions = prepareTransactions(transactions);
  const debits = preparedTransactions.filter(({ transaction }) => transaction.type === 'DEBIT');
  const credits = preparedTransactions.filter(({ transaction }) => transaction.type === 'CREDIT');
  const usdAmountCache = new Map<PreparedTransaction, number | null>();
  const edges: CandidateEdge[] = [];

  for (const credit of credits) {
    for (const debit of debits) {
      if (
        !memberTransactionIds.has(debit.transaction.id) &&
        !memberTransactionIds.has(credit.transaction.id)
      ) {
        continue;
      }

      const membership = getCandidateEdgeMembership(debit, credit, memberTransactionIds);
      const edge = buildCandidateEdge(debit, credit, exchangeRates, usdAmountCache, membership);
      if (edge) edges.push(edge);
    }
  }

  edges.sort(compareCandidateEdges);

  const retainedTransactionIds = new Set<number>();
  const candidates: TransferRefundCandidate[] = [];

  for (const edge of edges) {
    const debitId = edge.debit.transaction.id;
    const creditId = edge.credit.transaction.id;
    if (retainedTransactionIds.has(debitId) || retainedTransactionIds.has(creditId)) continue;

    retainedTransactionIds.add(debitId);
    retainedTransactionIds.add(creditId);
    candidates.push(toCandidate(edge, memberTransactionIds));
  }

  return candidates.sort(
    (left, right) =>
      compareLocalDates(right.credit.date, left.credit.date) || right.credit.id - left.credit.id,
  );
}
