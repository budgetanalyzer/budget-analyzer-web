import { describe, expect, it } from 'vitest';
import { findTransferRefundCandidates } from '@/features/views/utils/findTransferRefundCandidates';
import type { ExchangeRateResponse } from '@/types/currency';
import type { Transaction, TransactionType } from '@/types/transaction';
import { buildExchangeRateMap } from '@/utils/currency';

const NO_RATES = new Map<string, Map<string, ExchangeRateResponse>>();

function transaction(
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

function discover(
  transactions: Transaction[],
  memberIds: number[] = transactions.map(({ id }) => id),
  exchangeRates = NO_RATES,
) {
  return findTransferRefundCandidates(transactions, new Set(memberIds), exchangeRates);
}

describe('findTransferRefundCandidates', () => {
  it('finds same-account refunds with normalized identity and meaningful description evidence', () => {
    const debit = transaction(1, 'DEBIT', {
      bankName: ' WISE ',
      accountId: ' EUR-CHECKING ',
      currencyIsoCode: 'eur',
      amount: -100,
      description: 'WISE CARD PURCHASE CAFE\u0301 #1234',
    });
    const credit = transaction(2, 'CREDIT', {
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
        eligibleRemovalTransactionIds: [1, 2],
      }),
    ]);
  });

  it('finds cross-account transfers without requiring description overlap', () => {
    const debit = transaction(1, 'DEBIT', {
      bankName: 'Bank One',
      description: 'Monthly sweep outgoing',
    });
    const credit = transaction(2, 'CREDIT', {
      bankName: 'Bank Two',
      accountId: 'savings',
      date: '2026-01-02',
      description: 'Deposit received',
    });

    expect(discover([debit, credit])[0]).toMatchObject({
      kind: 'TRANSFER',
      sharedDescriptionTokens: [],
    });
  });

  it('uses each transaction exact LocalDate rate and USD as the cross-currency comparison unit', () => {
    const debit = transaction(1, 'DEBIT', {
      bankName: 'Euro Bank',
      date: '2026-02-01',
      currencyIsoCode: 'EUR',
      amount: 100,
    });
    const credit = transaction(2, 'CREDIT', {
      bankName: 'Sterling Bank',
      accountId: 'savings',
      date: '2026-02-03',
      currencyIsoCode: 'GBP',
      amount: 40,
    });
    const rates = buildExchangeRateMap([
      {
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        date: '2026-02-01',
        rate: 2,
        publishedDate: '2026-02-01',
      },
      {
        baseCurrency: 'USD',
        targetCurrency: 'GBP',
        date: '2026-02-03',
        rate: 0.8,
        publishedDate: '2026-02-03',
      },
    ]);

    expect(discover([debit, credit], [1, 2], rates)[0]).toMatchObject({
      kind: 'TRANSFER',
      amountDifferenceBasisPoints: 0,
    });
  });

  it('omits a cross-currency candidate when only a nearby rather than exact rate exists', () => {
    const debit = transaction(1, 'DEBIT', {
      bankName: 'Euro Bank',
      date: '2026-02-02',
      currencyIsoCode: 'EUR',
      amount: 100,
    });
    const credit = transaction(2, 'CREDIT', {
      bankName: 'US Bank',
      accountId: 'savings',
      date: '2026-02-03',
      currencyIsoCode: 'USD',
      amount: 50,
    });
    const nearbyRate = buildExchangeRateMap([
      {
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        date: '2026-02-01',
        rate: 2,
        publishedDate: '2026-02-01',
      },
    ]);

    expect(discover([debit, credit], [1, 2], nearbyRate)).toEqual([]);
  });

  it('omits a cross-currency candidate when an exact rate is invalid', () => {
    const debit = transaction(1, 'DEBIT', {
      bankName: 'Euro Bank',
      currencyIsoCode: 'EUR',
    });
    const credit = transaction(2, 'CREDIT', {
      bankName: 'US Bank',
      accountId: 'savings',
      date: '2026-01-02',
      amount: 100,
    });
    const invalidRate = buildExchangeRateMap([
      {
        baseCurrency: 'USD',
        targetCurrency: 'EUR',
        date: '2026-01-01',
        rate: 0,
        publishedDate: '2026-01-01',
      },
    ]);

    expect(discover([debit, credit], [1, 2], invalidRate)).toEqual([]);
  });

  it('uses a nonmember as evidence but makes only the current member removable', () => {
    const outsideDebit = transaction(1, 'DEBIT', { bankName: 'Bank One' });
    const memberCredit = transaction(2, 'CREDIT', {
      bankName: 'Bank Two',
      accountId: 'savings',
      date: '2026-01-02',
    });

    expect(discover([outsideDebit, memberCredit], [2])[0]).toMatchObject({
      debit: outsideDebit,
      credit: memberCredit,
      eligibleRemovalTransactionIds: [2],
    });
  });

  it('does not classify or retain a pair when neither side is a current member', () => {
    const debit = transaction(1, 'DEBIT', { bankName: 'Bank One' });
    const credit = transaction(2, 'CREDIT', {
      bankName: 'Bank Two',
      accountId: 'savings',
      date: '2026-01-02',
    });

    expect(discover([debit, credit], [])).toEqual([]);
  });

  it('keeps the exact refund tolerance and date boundaries', () => {
    const debit = transaction(1, 'DEBIT');
    const exactBoundary = transaction(2, 'CREDIT', { date: '2026-04-01', amount: 97 });
    const beyondDate = transaction(3, 'CREDIT', { date: '2026-04-02', amount: 97 });
    const beyondAmount = transaction(4, 'CREDIT', { date: '2026-04-01', amount: 96.99 });

    expect(discover([debit, exactBoundary])).toHaveLength(1);
    expect(discover([debit, beyondDate])).toEqual([]);
    expect(discover([debit, beyondAmount])).toEqual([]);
  });

  it('keeps the exact transfer tolerance and date boundaries', () => {
    const debit = transaction(1, 'DEBIT', { bankName: 'Bank One', amount: 200 });
    const exactBoundary = transaction(2, 'CREDIT', {
      bankName: 'Bank Two',
      accountId: 'savings',
      date: '2026-01-08',
      amount: 190,
    });
    const beyondDate = transaction(3, 'CREDIT', {
      bankName: 'Bank Two',
      accountId: 'savings',
      date: '2026-01-09',
      amount: 190,
    });
    const beyondAmount = transaction(4, 'CREDIT', {
      bankName: 'Bank Two',
      accountId: 'savings',
      date: '2026-01-08',
      amount: 189.99,
    });

    expect(discover([debit, exactBoundary])).toHaveLength(1);
    expect(discover([debit, beyondDate])).toEqual([]);
    expect(discover([debit, beyondAmount])).toEqual([]);
  });

  it('rejects refunds with unrelated descriptions, reversed dates, or ambiguous accounts', () => {
    const debit = transaction(1, 'DEBIT', { description: 'Neighborhood coffee shop' });
    const unrelatedCredit = transaction(2, 'CREDIT', {
      date: '2026-01-02',
      description: 'Grocery market adjustment',
    });
    const priorCredit = transaction(3, 'CREDIT', { date: '2025-12-31' });
    const ambiguousCredit = transaction(4, 'CREDIT', {
      accountId: '',
      date: '2026-01-02',
    });

    expect(discover([debit, unrelatedCredit])).toEqual([]);
    expect(discover([debit, priorCredit])).toEqual([]);
    expect(discover([debit, ambiguousCredit])).toEqual([]);
  });

  it('rejects zero amounts and blank normalized currencies', () => {
    const zeroDebit = transaction(1, 'DEBIT', { amount: 0 });
    const zeroCredit = transaction(2, 'CREDIT', { amount: 0, date: '2026-01-02' });
    const blankDebit = transaction(3, 'DEBIT', { currencyIsoCode: '  ' });
    const blankCredit = transaction(4, 'CREDIT', {
      currencyIsoCode: '',
      date: '2026-01-02',
    });

    expect(discover([zeroDebit, zeroCredit])).toEqual([]);
    expect(discover([blankDebit, blankCredit])).toEqual([]);
  });

  it('retains each transaction in at most one financially strongest candidate', () => {
    const debit = transaction(1, 'DEBIT', { description: 'Alpha market' });
    const exactCredit = transaction(2, 'CREDIT', {
      date: '2026-01-02',
      description: 'Alpha market refund',
    });
    const fartherCredit = transaction(3, 'CREDIT', {
      date: '2026-01-03',
      amount: 99,
      description: 'Alpha market refund',
    });

    expect(discover([fartherCredit, debit, exactCredit]).map(({ key }) => key)).toEqual([
      'REFUND:1:2',
    ]);
  });

  it('prefers all-member evidence only after financial and description evidence tie', () => {
    const memberDebit = transaction(10, 'DEBIT', { bankName: 'Bank One' });
    const outsideCredit = transaction(1, 'CREDIT', {
      bankName: 'Bank Two',
      accountId: 'outside',
      date: '2026-01-02',
    });
    const memberCredit = transaction(20, 'CREDIT', {
      bankName: 'Bank Three',
      accountId: 'member',
      date: '2026-01-02',
    });

    expect(
      discover([outsideCredit, memberDebit, memberCredit], [10, 20]).map(({ key }) => key),
    ).toEqual(['TRANSFER:10:20']);
  });
});
