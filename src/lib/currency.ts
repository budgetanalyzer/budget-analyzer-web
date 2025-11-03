// src/lib/currency.ts
import { ExchangeRateResponse } from '@/types/currency';

/**
 * Build a Map of date -> exchange rate response for fast O(1) lookups
 * @param rates Array of exchange rate responses from API
 * @returns Map with date string (YYYY-MM-DD) as key and full ExchangeRateResponse as value
 */
export function buildExchangeRateMap(
  rates: ExchangeRateResponse[],
): Map<string, ExchangeRateResponse> {
  const map = new Map<string, ExchangeRateResponse>();
  rates.forEach((rate) => {
    map.set(rate.date, rate);
  });
  return map;
}

// Cache for earliest/latest dates per ratesMap to avoid repeated calculations
const dateRangeCache = new WeakMap<
  Map<string, ExchangeRateResponse>,
  {
    earliest: string;
    latest: string;
    earliestRate: ExchangeRateResponse;
    latestRate: ExchangeRateResponse;
  }
>();

/**
 * Find the nearest available exchange rate for a given date
 * Falls back to closest available rate if exact date not found.
 *
 * In practice the API will always return a rate for every date
 * it has in a range.  So transactions prior to the range of dates
 * for which we have an exchange rate will always use the earliest
 * rate we have, which is 1981-01-02,20.6611 for THB.  And for
 * transactions that occur after the range of rates for which we
 * have data, we will always use the most recent rate we have.
 *
 * @param date Transaction date (YYYY-MM-DD)
 * @param ratesMap Map of dates to exchange rate responses
 * @returns Exchange rate response for nearest available date, or null if no rates available
 */
export function findNearestExchangeRate(
  date: string,
  ratesMap: Map<string, ExchangeRateResponse>,
): ExchangeRateResponse | null {
  if (ratesMap.size === 0) {
    return null;
  }

  // First try exact match (O(1) - the happy path for most transactions)
  const exactMatch = ratesMap.get(date);
  if (exactMatch) {
    return exactMatch;
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
      earliestRate: ratesMap.get(earliest)!,
      latestRate: ratesMap.get(latest)!,
    };
    dateRangeCache.set(ratesMap, dateRange);
  }

  // Transaction before the earliest rate? Use earliest rate
  if (date < dateRange.earliest) {
    return dateRange.earliestRate;
  }

  // Transaction after the latest rate? Use latest rate
  if (date > dateRange.latest) {
    return dateRange.latestRate;
  }

  // Date is within range but no exact match
  // This should rarely happen if API returns continuous daily rates
  // Log a warning and fall back to earliest rate for safety
  console.warn(
    `[findNearestExchangeRate] Missing rate for date ${date} within range [${dateRange.earliest}, ${dateRange.latest}]`,
  );
  return dateRange.earliestRate;
}

/**
 * Convert an amount from one currency to another using exchange rate
 * If no exact rate exists for the date, uses the nearest available rate
 *
 * @param amount Amount in source currency
 * @param date Transaction date (YYYY-MM-DD)
 * @param sourceCurrency Source currency code (e.g., 'THB')
 * @param targetCurrency Target currency code (e.g., 'USD')
 * @param ratesMap Map of dates to exchange rate responses
 * @returns Converted amount in target currency
 */
export function convertCurrency(
  amount: number,
  date: string,
  sourceCurrency: string,
  targetCurrency: string,
  ratesMap: Map<string, ExchangeRateResponse>,
): number {
  // No conversion needed if currencies are the same
  if (sourceCurrency === targetCurrency) {
    return amount;
  }

  // Get the exchange rate response for this date (or nearest available)
  const exchangeRateResponse = findNearestExchangeRate(date, ratesMap);

  // If no rate found at all, return original amount
  if (!exchangeRateResponse) {
    return amount;
  }

  const rate = exchangeRateResponse.rate;

  // Apply conversion based on direction
  // Note: Exchange rates are stored as baseCurrency (USD) -> targetCurrency (THB)
  if (sourceCurrency === 'USD') {
    // USD -> THB: multiply by rate
    return amount * rate;
  } else {
    // THB -> USD: divide by rate
    return amount / rate;
  }
}
