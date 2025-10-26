// src/types/currency.ts

/**
 * Currency code (ISO 4217)
 * This is returned as a simple string array from GET /currencies
 */
export type CurrencyCode = string;

/**
 * Detailed currency information
 * Used in ExchangeRateResponse
 */
export interface Currency {
  currencyCode: string;
  displayName: string;
  symbol: string;
  defaultFractionDigits: number;
  numericCode: number;
  numericCodeAsString: string;
}

/**
 * Exchange rate response from GET /exchange-rates
 */
export interface ExchangeRateResponse {
  baseCurrency: Currency;
  targetCurrency: Currency;
  date: string; // ISO date format
  rate: number;
}
