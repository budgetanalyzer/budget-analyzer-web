// src/lib/currency.ts
import { ExchangeRateResponse } from '@/types/currency';

/**
 * Build a Map of date -> exchange rate for fast O(1) lookups
 * @param rates Array of exchange rate responses from API
 * @returns Map with date string (YYYY-MM-DD) as key and rate as value
 */
export function buildExchangeRateMap(rates: ExchangeRateResponse[]): Map<string, number> {
  const map = new Map<string, number>();
  rates.forEach((rate) => {
    map.set(rate.date, rate.rate);
  });
  return map;
}

/**
 * Convert an amount from one currency to another using exchange rate
 * API guarantees a rate exists for every date, so no fallback logic needed
 *
 * @param amount Amount in source currency
 * @param date Transaction date (YYYY-MM-DD)
 * @param sourceCurrency Source currency code (e.g., 'THB')
 * @param targetCurrency Target currency code (e.g., 'USD')
 * @param ratesMap Map of dates to exchange rates (for sourceCurrency -> targetCurrency)
 * @returns Converted amount in target currency
 */
export function convertCurrency(
  amount: number,
  date: string,
  sourceCurrency: string,
  targetCurrency: string,
  ratesMap: Map<string, number>,
): number {
  // No conversion needed if currencies are the same
  if (sourceCurrency === targetCurrency) {
    return amount;
  }

  // Get the rate for this date
  const rate = ratesMap.get(date);

  // If no rate found, return original amount
  // This shouldn't happen if API guarantees coverage, but defensive programming
  if (!rate) {
    console.warn(`No exchange rate found for ${date}, ${sourceCurrency} -> ${targetCurrency}`);
    return amount;
  }

  // Apply conversion
  // Note: Exchange rates are stored as baseCurrency (USD) -> targetCurrency
  // So we need to handle conversion direction appropriately
  if (sourceCurrency === 'USD') {
    // USD -> targetCurrency (e.g., USD -> THB)
    return amount * rate;
  } else {
    // targetCurrency -> USD (e.g., THB -> USD)
    return amount / rate;
  }
}
