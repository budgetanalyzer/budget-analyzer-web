import { describe, expect, it } from 'vitest';
import type { ExchangeRateResponse } from '@/types/currency';
import { buildExchangeRateMap, formatCurrency } from '@/utils/currency';

function rate(date: string, targetCurrency: string, value: number): ExchangeRateResponse {
  return {
    baseCurrency: 'USD',
    targetCurrency,
    date,
    publishedDate: date,
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
});
