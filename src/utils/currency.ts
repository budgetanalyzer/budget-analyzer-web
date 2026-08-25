// src/utils/currency.ts
import { ExchangeRateResponse } from '@/types/currency';

/**
 * Build a nested Map structure for fast O(1) lookups by date and currency
 * @param rates Array of exchange rate responses from API
 * @returns Map with structure: date -> (targetCurrency -> ExchangeRateResponse)
 *
 * Example:
 * {
 *   '2025-01-01' => {
 *     'THB' => { baseCurrency: 'USD', targetCurrency: 'THB', rate: 33.5, ... },
 *     'JPY' => { baseCurrency: 'USD', targetCurrency: 'JPY', rate: 110.2, ... }
 *   },
 *   '2025-01-02' => { ... }
 * }
 */
export function buildExchangeRateMap(
  rates: ExchangeRateResponse[],
): Map<string, Map<string, ExchangeRateResponse>> {
  const map = new Map<string, Map<string, ExchangeRateResponse>>();
  rates.forEach((rate) => {
    let currencyMap = map.get(rate.date);
    if (!currencyMap) {
      currencyMap = new Map<string, ExchangeRateResponse>();
      map.set(rate.date, currencyMap);
    }
    currencyMap.set(rate.targetCurrency, rate);
  });
  return map;
}

/**
 * Format a number as currency with proper locale and symbol
 * @param amount Numeric amount to format
 * @param currencyCode ISO 4217 currency code (e.g., 'USD', 'THB')
 * @returns Formatted currency string (e.g., '$1,234.56')
 */
export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}
