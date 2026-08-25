import { describe, expect, it } from 'vitest';
import type { ExchangeRateResponse } from '@/types/currency';
import { buildExchangeRateMap } from '@/utils/currency';
import {
  findExactExchangeRate,
  getCurrencyMinorUnitCount,
  projectDisplayAmount,
  quantizeCurrencyAmount,
} from '@/utils/displayAmount';

const transactionDate = '2026-01-04';

function rate(
  targetCurrency: string,
  value: number,
  overrides: Partial<ExchangeRateResponse> = {},
): ExchangeRateResponse {
  return {
    baseCurrency: 'USD',
    targetCurrency,
    date: transactionDate,
    publishedDate: '2026-01-02',
    rate: value,
    ...overrides,
  };
}

function transaction(amount: number, currencyIsoCode: string, date = transactionDate) {
  return { amount, currencyIsoCode, date };
}

describe('display amount projection', () => {
  it('derives zero-, two-, and three-decimal precision from the runtime formatter', () => {
    expect(getCurrencyMinorUnitCount('JPY')).toBe(0);
    expect(getCurrencyMinorUnitCount('USD')).toBe(2);
    expect(getCurrencyMinorUnitCount('KWD')).toBe(3);
    expect(getCurrencyMinorUnitCount('NOT-ISO')).toBeNull();
  });

  it('quantizes display values at decimal boundaries', () => {
    expect(quantizeCurrencyAmount(1.005, 2)).toBe(1.01);
    expect(quantizeCurrencyAmount(1.004, 2)).toBe(1);
    expect(quantizeCurrencyAmount(1.5, 0)).toBe(2);
    expect(quantizeCurrencyAmount(1.2345, 3)).toBe(1.235);
  });

  it('normalizes same-currency values to a positive magnitude without exchange rates', () => {
    expect(projectDisplayAmount(transaction(-12.3456, 'KWD'), 'KWD', new Map())).toEqual({
      available: true,
      sourceMagnitude: 12.3456,
      sourceCurrency: 'KWD',
      targetCurrency: 'KWD',
      minorUnitCount: 3,
      value: 12.346,
      rateLegs: [],
    });
  });

  it('converts USD to the target with one exact target leg and publication provenance', () => {
    const eurRate = rate('EUR', 0.8);
    const result = projectDisplayAmount(
      transaction(-100, 'USD'),
      'EUR',
      buildExchangeRateMap([eurRate]),
    );

    expect(result).toMatchObject({
      available: true,
      sourceMagnitude: 100,
      value: 80,
      rateLegs: [{ kind: 'USD_TO_TARGET', exchangeRate: eurRate }],
    });
    expect(result.available ? result.rateLegs[0]?.exchangeRate.publishedDate : null).toBe(
      '2026-01-02',
    );
  });

  it('converts a non-USD source to USD with one exact source leg', () => {
    const eurRate = rate('EUR', 0.8);

    expect(
      projectDisplayAmount(transaction(80, 'EUR'), 'USD', buildExchangeRateMap([eurRate])),
    ).toMatchObject({
      available: true,
      value: 100,
      rateLegs: [{ kind: 'SOURCE_TO_USD', exchangeRate: eurRate }],
    });
  });

  it('triangulates non-USD currencies with two exact rate legs and quantizes only the result', () => {
    const eurRate = rate('EUR', 2);
    const gbpRate = rate('GBP', 2);

    expect(
      projectDisplayAmount(
        transaction(1.005, 'EUR'),
        'GBP',
        buildExchangeRateMap([eurRate, gbpRate]),
      ),
    ).toMatchObject({
      available: true,
      sourceMagnitude: 1.005,
      value: 1.01,
      rateLegs: [
        { kind: 'SOURCE_TO_USD', exchangeRate: eurRate },
        { kind: 'USD_TO_TARGET', exchangeRate: gbpRate },
      ],
    });
  });

  it('looks up only the requested LocalDate and never substitutes another date', () => {
    const priorRate = rate('EUR', 0.8, {
      date: '2026-01-03',
      publishedDate: '2026-01-02',
    });
    const ratesMap = buildExchangeRateMap([priorRate]);

    expect(findExactExchangeRate(transactionDate, 'EUR', ratesMap)).toBeNull();
    expect(projectDisplayAmount(transaction(10, 'USD'), 'EUR', ratesMap)).toEqual({
      available: false,
      sourceMagnitude: 10,
      sourceCurrency: 'USD',
      targetCurrency: 'EUR',
      reason: 'MISSING_TARGET_RATE',
    });
  });

  it('distinguishes missing source and target legs without returning a mislabeled number', () => {
    expect(projectDisplayAmount(transaction(10, 'EUR'), 'USD', new Map())).toMatchObject({
      available: false,
      sourceCurrency: 'EUR',
      targetCurrency: 'USD',
      reason: 'MISSING_SOURCE_RATE',
    });

    expect(
      projectDisplayAmount(transaction(10, 'EUR'), 'GBP', buildExchangeRateMap([rate('EUR', 0.8)])),
    ).toMatchObject({
      available: false,
      sourceCurrency: 'EUR',
      targetCurrency: 'GBP',
      reason: 'MISSING_TARGET_RATE',
    });
  });

  it.each([
    ['a non-finite rate', Number.NaN, {}],
    ['a zero rate', 0, {}],
    ['a negative rate', -1, {}],
    ['a mismatched base', 0.8, { baseCurrency: 'EUR' }],
  ])('rejects %s on the source leg', (_label, value, overrides) => {
    const sourceRate = rate('EUR', value, overrides);

    expect(
      projectDisplayAmount(transaction(10, 'EUR'), 'USD', buildExchangeRateMap([sourceRate])),
    ).toMatchObject({ available: false, reason: 'INVALID_SOURCE_RATE' });
  });

  it('rejects mismatched source and target entries under the requested map keys', () => {
    const mismatchedSource = rate('GBP', 0.8);
    const mismatchedTarget = rate('JPY', 150);
    const sourceRatesMap = new Map([
      [transactionDate, new Map<string, ExchangeRateResponse>([['EUR', mismatchedSource]])],
    ]);
    const targetRatesMap = new Map([
      [
        transactionDate,
        new Map<string, ExchangeRateResponse>([
          ['EUR', rate('EUR', 0.8)],
          ['GBP', mismatchedTarget],
        ]),
      ],
    ]);

    expect(projectDisplayAmount(transaction(10, 'EUR'), 'USD', sourceRatesMap)).toMatchObject({
      available: false,
      reason: 'INVALID_SOURCE_RATE',
    });
    expect(projectDisplayAmount(transaction(10, 'EUR'), 'GBP', targetRatesMap)).toMatchObject({
      available: false,
      reason: 'INVALID_TARGET_RATE',
    });
  });

  it('rejects invalid target rates and unsupported target precision', () => {
    expect(
      projectDisplayAmount(
        transaction(10, 'USD'),
        'EUR',
        buildExchangeRateMap([rate('EUR', Number.POSITIVE_INFINITY)]),
      ),
    ).toMatchObject({ available: false, reason: 'INVALID_TARGET_RATE' });

    expect(projectDisplayAmount(transaction(10, 'USD'), 'NOT-ISO', new Map())).toEqual({
      available: false,
      sourceMagnitude: 10,
      sourceCurrency: 'USD',
      targetCurrency: 'NOT-ISO',
      reason: 'UNSUPPORTED_CURRENCY_PRECISION',
    });
  });
});
