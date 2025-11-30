// src/types/currency.ts

/**
 * Currency code (ISO 4217)
 */
export type CurrencyCode = string;

/**
 * Currency series response with mapping details
 * Returned by GET /v1/currencies
 */
export interface CurrencySeriesResponse {
  id: number;
  currencyCode: string;
  providerSeriesId: string;
  enabled: boolean;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

/**
 * Request to create a new currency series mapping
 */
export interface CurrencySeriesCreateRequest {
  currencyCode: string; // ISO 4217 three-letter code
  providerSeriesId: string;
  enabled?: boolean; // Defaults to true
}

/**
 * Request to update an existing currency series
 * Currency code and providerSeriesId are immutable, only enabled can be changed
 */
export interface CurrencySeriesUpdateRequest {
  enabled: boolean;
}

/**
 * Exchange rate response from GET /v1/exchange-rates
 * baseCurrency and targetCurrency are now simple strings (ISO 4217 codes)
 */
export interface ExchangeRateResponse {
  baseCurrency: string;
  targetCurrency: string;
  date: string; // LocalDate format (YYYY-MM-DD)
  rate: number;
  publishedDate: string; // LocalDate format (YYYY-MM-DD)
}

/**
 * Exchange rate import result response
 * Returned by GET /v1/exchange-rates/import
 */
export interface ExchangeRateImportResultResponse {
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  earliestExchangeRateDate?: string; // LocalDate format (YYYY-MM-DD)
  latestExchangeRateDate?: string; // LocalDate format (YYYY-MM-DD)
  timestamp: string; // ISO 8601 timestamp
}
