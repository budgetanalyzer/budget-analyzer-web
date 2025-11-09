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

// Cache for earliest/latest dates per ratesMap to avoid repeated calculations
const dateRangeCache = new WeakMap<
  Map<string, Map<string, ExchangeRateResponse>>,
  {
    earliest: string;
    latest: string;
  }
>();

/**
 * Find the nearest available exchange rate for a given date and currency
 * Falls back to closest available rate if exact date not found.
 *
 * @param date Transaction date (YYYY-MM-DD)
 * @param targetCurrency The target currency to look up (e.g., 'THB', 'JPY')
 * @param ratesMap Nested map: date -> (targetCurrency -> ExchangeRateResponse)
 * @returns Exchange rate response for nearest available date, or null if no rates available
 */
export function findNearestExchangeRate(
  date: string,
  targetCurrency: string,
  ratesMap: Map<string, Map<string, ExchangeRateResponse>>,
): ExchangeRateResponse | null {
  if (ratesMap.size === 0) {
    return null;
  }

  // First try exact match (O(1) - the happy path for most transactions)
  const currencyMapForDate = ratesMap.get(date);
  if (currencyMapForDate) {
    const exactMatch = currencyMapForDate.get(targetCurrency);
    if (exactMatch) {
      return exactMatch;
    }
  }

  // Get or compute the date range boundaries (cached per ratesMap instance)
  let dateRange = dateRangeCache.get(ratesMap);
  if (!dateRange) {
    console.log(
      '[findNearestExchangeRate] Computing date range for map with',
      ratesMap.size,
      'entries',
    );
    const allDates = Array.from(ratesMap.keys()).sort();
    const earliest = allDates[0];
    const latest = allDates[allDates.length - 1];
    dateRange = {
      earliest,
      latest,
    };
    dateRangeCache.set(ratesMap, dateRange);
  }

  // Transaction before the earliest rate? Use earliest rate
  // This should not happen with API validation enforcing year 2000+ for imports
  if (date < dateRange.earliest) {
    console.error(
      `[findNearestExchangeRate] Transaction date ${date} is before earliest available rate ${dateRange.earliest} for ${targetCurrency}. This should not happen with current API validation.`,
    );
    const earliestCurrencyMap = ratesMap.get(dateRange.earliest);
    return earliestCurrencyMap?.get(targetCurrency) || null;
  }

  // Transaction after the latest rate? Use latest rate
  if (date > dateRange.latest) {
    const latestCurrencyMap = ratesMap.get(dateRange.latest);
    return latestCurrencyMap?.get(targetCurrency) || null;
  }

  // Date is within range but no exact match
  // This should rarely happen if API returns continuous daily rates
  // Log a warning and fall back to earliest rate for safety
  console.warn(
    `[findNearestExchangeRate] Missing rate for ${targetCurrency} on date ${date} within range [${dateRange.earliest}, ${dateRange.latest}]`,
  );
  const earliestCurrencyMap = ratesMap.get(dateRange.earliest);
  return earliestCurrencyMap?.get(targetCurrency) || null;
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

/**
 * Convert an amount from one currency to another using exchange rate triangulation through USD
 * If no exact rate exists for the date, uses the nearest available rate
 *
 * All exchange rates are stored with USD as the base currency (USD -> targetCurrency).
 * For non-USD to non-USD conversions (e.g., THB -> JPY), we triangulate through USD:
 * 1. Convert source currency to USD (divide by source rate)
 * 2. Convert USD to target currency (multiply by target rate)
 *
 * @param amount Amount in source currency
 * @param date Transaction date (YYYY-MM-DD)
 * @param sourceCurrency Source currency code (e.g., 'THB')
 * @param targetCurrency Target currency code (e.g., 'JPY')
 * @param ratesMap Nested map: date -> (targetCurrency -> ExchangeRateResponse)
 * @returns Converted amount in target currency
 */
export function convertCurrency(
  amount: number,
  date: string,
  sourceCurrency: string,
  targetCurrency: string,
  ratesMap: Map<string, Map<string, ExchangeRateResponse>>,
): number {
  // No conversion needed if currencies are the same
  if (sourceCurrency === targetCurrency) {
    return amount;
  }

  // Case 1: Converting FROM USD
  if (sourceCurrency === 'USD') {
    // USD -> targetCurrency: multiply by rate
    const targetRate = findNearestExchangeRate(date, targetCurrency, ratesMap);
    if (!targetRate) {
      console.warn(
        `[convertCurrency] No rate found for ${targetCurrency} on ${date}, returning original amount`,
      );
      return amount;
    }
    return amount * targetRate.rate;
  }

  // Case 2: Converting TO USD
  if (targetCurrency === 'USD') {
    // sourceCurrency -> USD: divide by rate
    const sourceRate = findNearestExchangeRate(date, sourceCurrency, ratesMap);
    if (!sourceRate) {
      console.warn(
        `[convertCurrency] No rate found for ${sourceCurrency} on ${date}, returning original amount`,
      );
      return amount;
    }
    return amount / sourceRate.rate;
  }

  // Case 3: Converting between two non-USD currencies (e.g., THB -> JPY)
  // Triangulate through USD: THB -> USD -> JPY
  const sourceRate = findNearestExchangeRate(date, sourceCurrency, ratesMap);
  const targetRate = findNearestExchangeRate(date, targetCurrency, ratesMap);

  if (!sourceRate || !targetRate) {
    console.warn(
      `[convertCurrency] Missing rates for ${sourceCurrency} or ${targetCurrency} on ${date}, returning original amount`,
    );
    return amount;
  }

  // Step 1: Convert to USD (divide by source rate)
  const amountInUSD = amount / sourceRate.rate;
  // Step 2: Convert from USD to target currency (multiply by target rate)
  return amountInUSD * targetRate.rate;
}
