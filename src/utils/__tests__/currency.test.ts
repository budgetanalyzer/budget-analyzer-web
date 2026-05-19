import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExchangeRateResponse } from '@/types/currency';
import {
  buildExchangeRateMap,
  convertCurrency,
  findNearestExchangeRate,
  formatCurrency,
} from '@/utils/currency';

function rate(date: string, targetCurrency: string, value: number): ExchangeRateResponse {
  return {
    baseCurrency: 'USD',
    targetCurrency,
    date,
    rate: value,
  };
}

function buildRates(): Map<string, Map<string, ExchangeRateResponse>> {
  return buildExchangeRateMap([
    rate('2025-01-01', 'EUR', 0.8),
    rate('2025-01-01', 'JPY', 150),
    rate('2025-01-10', 'EUR', 0.82),
    rate('2025-01-10', 'JPY', 155),
  ]);
}

describe('currency utilities', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats positive, zero, and negative amounts using the requested currency code', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
    expect(formatCurrency(-42.5, 'USD')).toBe('-$42.50');
    expect(formatCurrency(500, 'THB')).toContain('THB');
  });

  it('keeps unknown three-letter currency codes visible in formatted output', () => {
    expect(formatCurrency(12.34, 'ZZZ')).toContain('ZZZ');
  });

  it('builds an exchange-rate map keyed by LocalDate and target currency', () => {
    const ratesMap = buildRates();

    expect(ratesMap.get('2025-01-01')?.get('EUR')).toMatchObject({
      targetCurrency: 'EUR',
      rate: 0.8,
    });
    expect(ratesMap.get('2025-01-10')?.get('JPY')).toMatchObject({
      targetCurrency: 'JPY',
      rate: 155,
    });
  });

  it('finds exact, latest, earliest, and in-range fallback exchange rates', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const ratesMap = buildRates();

    expect(findNearestExchangeRate('2025-01-10', 'EUR', ratesMap)?.rate).toBe(0.82);
    expect(findNearestExchangeRate('2025-02-01', 'EUR', ratesMap)?.rate).toBe(0.82);
    expect(findNearestExchangeRate('2024-12-31', 'EUR', ratesMap)?.rate).toBe(0.8);
    expect(findNearestExchangeRate('2025-01-05', 'JPY', ratesMap)?.rate).toBe(150);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[findNearestExchangeRate] Missing rate for JPY on date 2025-01-05 within range [2025-01-01, 2025-01-10]',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[findNearestExchangeRate] Transaction date 2024-12-31 is before earliest available rate 2025-01-01 for EUR. This should not happen with current API validation.',
    );
  });

  it('returns null when the requested currency is missing from available rate dates', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ratesMap = buildRates();

    expect(findNearestExchangeRate('2025-01-10', 'GBP', ratesMap)).toBeNull();
    expect(findNearestExchangeRate('2025-01-05', 'GBP', ratesMap)).toBeNull();

    expect(warnSpy).toHaveBeenCalledWith(
      '[findNearestExchangeRate] Missing rate for GBP on date 2025-01-05 within range [2025-01-01, 2025-01-10]',
    );
  });

  it('converts through USD for USD, non-USD, zero, and negative amounts', () => {
    const ratesMap = buildRates();

    expect(convertCurrency(100, '2025-01-01', 'USD', 'EUR', ratesMap)).toBe(80);
    expect(convertCurrency(80, '2025-01-01', 'EUR', 'USD', ratesMap)).toBe(100);
    expect(convertCurrency(80, '2025-01-01', 'EUR', 'JPY', ratesMap)).toBe(15000);
    expect(convertCurrency(0, '2025-01-01', 'USD', 'EUR', ratesMap)).toBe(0);
    expect(convertCurrency(-100, '2025-01-01', 'USD', 'EUR', ratesMap)).toBe(-80);
  });

  it('returns the original amount when conversion rates are missing or currencies match', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ratesMap = buildRates();

    expect(convertCurrency(42, '2025-01-01', 'USD', 'USD', ratesMap)).toBe(42);
    expect(convertCurrency(42, '2025-01-01', 'USD', 'GBP', ratesMap)).toBe(42);
    expect(convertCurrency(42, '2025-01-01', 'GBP', 'USD', ratesMap)).toBe(42);
    expect(convertCurrency(42, '2025-01-01', 'GBP', 'EUR', ratesMap)).toBe(42);

    expect(warnSpy).toHaveBeenCalledWith(
      '[convertCurrency] No rate found for GBP on 2025-01-01, returning original amount',
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[convertCurrency] Missing rates for GBP or EUR on 2025-01-01, returning original amount',
    );
  });
});
