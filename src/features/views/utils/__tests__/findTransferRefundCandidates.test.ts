import { describe, expect, it } from 'vitest';
import type { ExchangeRateResponse } from '@/types/currency';
import type { Transaction, TransactionType } from '@/types/transaction';
import type { ViewTransaction } from '@/types/view';
import { buildExchangeRateMap } from '@/utils/currency';
import { findTransferRefundCandidates } from '@/features/views/utils/findTransferRefundCandidates';

const NO_RATES = new Map<string, Map<string, ExchangeRateResponse>>();

function createTransaction(
  id: number,
  type: TransactionType,
  overrides: Partial<Transaction> = {},
): Transaction {
  return {
    id,
    accountId: 'checking',
    bankName: 'Example Bank',
    date: '2026-01-01',
    currencyIsoCode: 'USD',
    amount: 100,
    type,
    description: 'Corner café purchase',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function asViewTransaction(transaction: Transaction): ViewTransaction {
  return { ...transaction, membershipType: 'MATCHED' };
}

function discover(
  transactions: Transaction[],
  visibleTransactions: Transaction[] = transactions,
  exchangeRates = NO_RATES,
) {
  return findTransferRefundCandidates(
    transactions,
    visibleTransactions.map(asViewTransaction),
    exchangeRates,
  );
}

describe('findTransferRefundCandidates', () => {
  it('finds an exact non-USD refund without a rate using deterministic case normalization', () => {
    const debit = createTransaction(1, 'DEBIT', {
      bankName: ' WISE ',
      accountId: ' EUR-CHECKING ',
      currencyIsoCode: 'eur',
      amount: -100,
      description: 'WISE CARD PURCHASE CAFE\u0301 #1234',
    });
    const credit = createTransaction(2, 'CREDIT', {
      bankName: 'Wise',
      accountId: 'eur-checking',
      date: '2026-01-04',
      currencyIsoCode: 'EUR',
      amount: 100,
      description: 'Posted refund Wise Café 1234',
    });

    expect(discover([credit, debit])).toEqual([
      expect.objectContaining({
        key: 'REFUND:1:2',
        kind: 'REFUND',
        debit,
        credit,
        absoluteDayDistance: 3,
        amountDifferenceBasisPoints: 0,
        sharedDescriptionTokens: ['1234', 'café', 'wise'],
        eligibleExclusionTransactionIds: [1, 2],
      }),
    ]);
  });

  it('finds an exact non-USD transfer without a rate or description evidence', () => {
    const debit = createTransaction(1, 'DEBIT', {
      bankName: 'Bank One',
      accountId: 'shared-id',
      currencyIsoCode: 'EUR',
      description: 'Monthly sweep outgoing',
    });
    const credit = createTransaction(2, 'CREDIT', {
      bankName: 'Bank Two',
      accountId: 'shared-id',
      date: '2026-01-02',
      currencyIsoCode: 'eur',
      description: 'Deposit received',
    });

    expect(discover([debit, credit])).toEqual([
      expect.objectContaining({
        kind: 'TRANSFER',
        sharedDescriptionTokens: [],
      }),
    ]);
  });

  it('compares equal same-currency amounts directly when rates differ by transaction date', () => {
    const debit = createTransaction(1, 'DEBIT', {
      currencyIsoCode: 'EUR',
      amount: -100,
      description: 'Merchant purchase',
    });
    const credit = createTransaction(2, 'CREDIT', {
      date: '2026-01-02',
      currencyIsoCode: 'EUR',
      amount: 100,
      description: 'Merchant refund',
    });
    const rates = buildExchangeRateMap([
      {
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        date: '2026-01-01',
        rate: 2,
      },
      {
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        date: '2026-01-02',
        rate: 4,
      },
    ]);

    expect(discover([debit, credit], [debit, credit], rates)[0]).toMatchObject({
      kind: 'REFUND',
      amountDifferenceBasisPoints: 0,
    });
  });

  it('treats unequal account IDs at the same bank as a transfer relationship', () => {
    const debit = createTransaction(1, 'DEBIT', { accountId: 'checking' });
    const credit = createTransaction(2, 'CREDIT', {
      accountId: 'savings',
      date: '2025-12-30',
    });

    expect(discover([debit, credit])[0]).toMatchObject({
      kind: 'TRANSFER',
      absoluteDayDistance: 2,
    });
  });

  it("converts each row with that row's transaction-date exchange rate", () => {
    const debit = createTransaction(1, 'DEBIT', {
      bankName: 'Euro Bank',
      accountId: 'eur',
      date: '2026-02-01',
      currencyIsoCode: 'EUR',
      amount: -100,
      description: 'Wise transfer',
    });
    const credit = createTransaction(2, 'CREDIT', {
      bankName: 'Sterling Bank',
      accountId: 'gbp',
      date: '2026-02-03',
      currencyIsoCode: 'GBP',
      amount: 40,
      description: 'Wise remittance',
    });
    const rates = buildExchangeRateMap([
      {
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        date: '2026-02-01',
        rate: 2,
      },
      {
        baseCurrency: 'USD',
        targetCurrency: 'GBP',
        date: '2026-02-03',
        rate: 0.8,
      },
    ]);

    expect(discover([debit, credit], [debit, credit], rates)[0]).toMatchObject({
      kind: 'TRANSFER',
      amountDifferenceBasisPoints: 0,
      sharedDescriptionTokens: ['wise'],
    });
  });

  it('normalizes both negative and positive stored amount signs', () => {
    const debit = createTransaction(1, 'DEBIT', { amount: 75 });
    const credit = createTransaction(2, 'CREDIT', {
      amount: -75,
      date: '2026-01-02',
    });

    expect(discover([debit, credit])[0]).toMatchObject({ amountDifferenceBasisPoints: 0 });
  });

  it('includes exact refund amount and date boundaries and rejects values beyond them', () => {
    const debit = createTransaction(1, 'DEBIT', { amount: 100 });
    const exactBoundary = createTransaction(2, 'CREDIT', {
      date: '2026-04-01',
      amount: 97,
    });
    const beyondDate = createTransaction(3, 'CREDIT', {
      date: '2026-04-02',
      amount: 97,
    });
    const beyondAmount = createTransaction(4, 'CREDIT', {
      date: '2026-04-01',
      amount: 96.99,
    });

    expect(discover([debit, exactBoundary], [exactBoundary])).toHaveLength(1);
    expect(discover([debit, beyondDate], [beyondDate])).toEqual([]);
    expect(discover([debit, beyondAmount], [beyondAmount])).toEqual([]);
  });

  it('uses the inclusive one-unit refund floor in the same comparison currency', () => {
    const debit = createTransaction(1, 'DEBIT', { currencyIsoCode: 'EUR', amount: 10 });
    const exactBoundary = createTransaction(2, 'CREDIT', {
      date: '2026-01-02',
      currencyIsoCode: 'EUR',
      amount: 9,
    });
    const beyondBoundary = createTransaction(3, 'CREDIT', {
      date: '2026-01-02',
      currencyIsoCode: 'EUR',
      amount: 8.99,
    });

    expect(discover([debit, exactBoundary])).toHaveLength(1);
    expect(discover([debit, beyondBoundary])).toEqual([]);
  });

  it('includes exact transfer amount and date boundaries and rejects values beyond them', () => {
    const debit = createTransaction(1, 'DEBIT', {
      bankName: 'Bank One',
      amount: 200,
    });
    const exactBoundary = createTransaction(2, 'CREDIT', {
      bankName: 'Bank Two',
      date: '2026-01-08',
      amount: 190,
    });
    const beyondDate = createTransaction(3, 'CREDIT', {
      bankName: 'Bank Two',
      date: '2026-01-09',
      amount: 190,
    });
    const beyondAmount = createTransaction(4, 'CREDIT', {
      bankName: 'Bank Two',
      date: '2026-01-08',
      amount: 189.99,
    });

    expect(discover([debit, exactBoundary])).toHaveLength(1);
    expect(discover([debit, beyondDate])).toEqual([]);
    expect(discover([debit, beyondAmount])).toEqual([]);
  });

  it('uses the inclusive five-unit transfer floor in the same comparison currency', () => {
    const debit = createTransaction(1, 'DEBIT', {
      bankName: 'Bank One',
      currencyIsoCode: 'EUR',
      amount: 20,
    });
    const exactBoundary = createTransaction(2, 'CREDIT', {
      bankName: 'Bank Two',
      date: '2026-01-02',
      currencyIsoCode: 'EUR',
      amount: 15,
    });
    const beyondBoundary = createTransaction(3, 'CREDIT', {
      bankName: 'Bank Two',
      date: '2026-01-02',
      currencyIsoCode: 'EUR',
      amount: 14.99,
    });

    expect(discover([debit, exactBoundary])).toHaveLength(1);
    expect(discover([debit, beyondBoundary])).toEqual([]);
  });

  it('omits cross-currency rows when a required usable rate is missing', () => {
    const debit = createTransaction(1, 'DEBIT', {
      bankName: 'Euro Bank',
      currencyIsoCode: 'EUR',
    });
    const credit = createTransaction(2, 'CREDIT', {
      bankName: 'US Bank',
      date: '2026-01-02',
    });

    expect(discover([debit, credit])).toEqual([]);
  });

  it('does not infer a refund from unrelated same-account descriptions', () => {
    const debit = createTransaction(1, 'DEBIT', { description: 'Neighborhood coffee shop' });
    const credit = createTransaction(2, 'CREDIT', {
      date: '2026-01-02',
      description: 'Grocery market adjustment',
    });

    expect(discover([debit, credit])).toEqual([]);
  });

  it('does not infer a refund when the credit precedes the same-account debit', () => {
    const debit = createTransaction(1, 'DEBIT', { date: '2026-01-02' });
    const credit = createTransaction(2, 'CREDIT', { date: '2026-01-01' });

    expect(discover([debit, credit])).toEqual([]);
  });

  it('rejects zero-value rows even when their descriptions and accounts agree', () => {
    const debit = createTransaction(1, 'DEBIT', { amount: 0 });
    const credit = createTransaction(2, 'CREDIT', { amount: -0, date: '2026-01-02' });

    expect(discover([debit, credit])).toEqual([]);
  });

  it('rejects rows with blank normalized currency codes', () => {
    const debit = createTransaction(1, 'DEBIT', { currencyIsoCode: '  ' });
    const credit = createTransaction(2, 'CREDIT', {
      currencyIsoCode: '',
      date: '2026-01-02',
    });

    expect(discover([debit, credit])).toEqual([]);
  });

  it('omits same-bank pairs whose account identity is ambiguous', () => {
    const debit = createTransaction(1, 'DEBIT', { accountId: '' });
    const credit = createTransaction(2, 'CREDIT', {
      accountId: 'checking',
      date: '2026-01-02',
    });

    expect(discover([debit, credit])).toEqual([]);
  });

  it('does not classify an unrelated salary credit without a debit', () => {
    const salary = createTransaction(1, 'CREDIT', {
      description: 'Employer monthly salary',
      amount: 5_000,
    });

    expect(discover([salary])).toEqual([]);
  });

  it('uses outside-view transactions as evidence but exposes only visible IDs for exclusion', () => {
    const outsideDebit = createTransaction(1, 'DEBIT', { bankName: 'Bank One' });
    const visibleCredit = createTransaction(2, 'CREDIT', {
      bankName: 'Bank Two',
      date: '2026-01-02',
    });

    expect(discover([outsideDebit, visibleCredit], [visibleCredit])[0]).toMatchObject({
      debit: outsideDebit,
      credit: visibleCredit,
      eligibleExclusionTransactionIds: [2],
    });
  });

  it('discards candidates when neither side is a canonical visible view member', () => {
    const debit = createTransaction(1, 'DEBIT', { bankName: 'Bank One' });
    const credit = createTransaction(2, 'CREDIT', {
      bankName: 'Bank Two',
      date: '2026-01-02',
    });

    expect(discover([debit, credit], [])).toEqual([]);
  });

  it('does not let an outside-view edge reserve a transaction needed by an in-view candidate', () => {
    const sharedDebit = createTransaction(1, 'DEBIT', { description: 'Alpha' });
    const outsideCredit = createTransaction(2, 'CREDIT', {
      date: '2026-01-01',
      description: 'Alpha',
    });
    const visibleCredit = createTransaction(3, 'CREDIT', {
      date: '2026-01-02',
      amount: 99,
      description: 'Alpha',
    });

    expect(discover([sharedDebit, outsideCredit, visibleCredit], [visibleCredit])).toEqual([
      expect.objectContaining({
        key: 'REFUND:1:3',
        eligibleExclusionTransactionIds: [3],
      }),
    ]);
  });

  it('resolves ties by token overlap and IDs independently of input order', () => {
    const lowerIdDebit = createTransaction(1, 'DEBIT', { description: 'Alpha only' });
    const greaterOverlapDebit = createTransaction(2, 'DEBIT', {
      description: 'Alpha beta',
    });
    const credit = createTransaction(10, 'CREDIT', {
      date: '2026-01-02',
      description: 'Alpha beta',
    });

    const forward = discover([lowerIdDebit, greaterOverlapDebit, credit], [credit]);
    const reversed = discover([credit, greaterOverlapDebit, lowerIdDebit], [credit]);

    expect(forward.map(({ key }) => key)).toEqual(['REFUND:2:10']);
    expect(reversed.map(({ key }) => key)).toEqual(['REFUND:2:10']);
  });

  it('ranks competing native and USD edges by unitless amount difference', () => {
    const debit = createTransaction(1, 'DEBIT', {
      currencyIsoCode: 'EUR',
      amount: 100,
      description: 'Merchant purchase',
    });
    const closerNativeCredit = createTransaction(2, 'CREDIT', {
      date: '2026-01-02',
      currencyIsoCode: 'EUR',
      amount: 99,
      description: 'Merchant refund',
    });
    const fartherUsdCredit = createTransaction(3, 'CREDIT', {
      date: '2026-01-02',
      currencyIsoCode: 'USD',
      amount: 49.25,
      description: 'Merchant refund',
    });
    const rates = buildExchangeRateMap([
      {
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        date: '2026-01-01',
        rate: 2,
      },
    ]);

    expect(
      discover(
        [fartherUsdCredit, closerNativeCredit, debit],
        [fartherUsdCredit, closerNativeCredit],
        rates,
      ).map(({ key }) => key),
    ).toEqual(['REFUND:1:2']);
  });

  it('uses debit then credit ID as the final ambiguity tie-breakers', () => {
    const debitOne = createTransaction(1, 'DEBIT', { description: 'Alpha' });
    const debitTwo = createTransaction(2, 'DEBIT', { description: 'Alpha' });
    const creditTen = createTransaction(10, 'CREDIT', {
      date: '2026-01-02',
      description: 'Alpha',
    });
    const creditEleven = createTransaction(11, 'CREDIT', {
      date: '2026-01-02',
      description: 'Alpha',
    });

    expect(discover([creditEleven, debitTwo, creditTen, debitOne]).map(({ key }) => key)).toEqual([
      'REFUND:2:11',
      'REFUND:1:10',
    ]);
  });

  it('orders retained candidates by descending credit date and credit ID', () => {
    const earlyDebit = createTransaction(1, 'DEBIT', {
      accountId: 'one',
      description: 'Alpha',
    });
    const earlyCredit = createTransaction(2, 'CREDIT', {
      accountId: 'one',
      date: '2026-01-02',
      description: 'Alpha',
    });
    const laterDebit = createTransaction(3, 'DEBIT', {
      accountId: 'two',
      description: 'Beta',
    });
    const laterCreditLowerId = createTransaction(4, 'CREDIT', {
      accountId: 'two',
      date: '2026-01-03',
      description: 'Beta',
    });
    const laterDebitTwo = createTransaction(5, 'DEBIT', {
      accountId: 'three',
      description: 'Gamma',
    });
    const laterCreditHigherId = createTransaction(6, 'CREDIT', {
      accountId: 'three',
      date: '2026-01-03',
      description: 'Gamma',
    });

    expect(
      discover([
        earlyDebit,
        earlyCredit,
        laterDebit,
        laterCreditLowerId,
        laterDebitTwo,
        laterCreditHigherId,
      ]).map(({ credit }) => credit.id),
    ).toEqual([6, 4, 2]);
  });

  it('prevents either transaction from being retained in more than one candidate', () => {
    const debit = createTransaction(1, 'DEBIT', { description: 'Alpha' });
    const closerCredit = createTransaction(2, 'CREDIT', {
      date: '2026-01-02',
      amount: 100,
      description: 'Alpha',
    });
    const fartherCredit = createTransaction(3, 'CREDIT', {
      date: '2026-01-03',
      amount: 99,
      description: 'Alpha',
    });

    const candidates = discover([debit, fartherCredit, closerCredit]);

    expect(candidates.map(({ key }) => key)).toEqual(['REFUND:1:2']);
    expect(
      candidates.flatMap(({ debit: candidateDebit, credit: candidateCredit }) => [
        candidateDebit.id,
        candidateCredit.id,
      ]),
    ).toEqual([1, 2]);
  });
});
