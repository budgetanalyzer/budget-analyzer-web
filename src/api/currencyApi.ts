// src/api/currencyApi.ts
import { apiClient } from '@/api/client';
import {
  CurrencySeriesResponse,
  CurrencySeriesCreateRequest,
  CurrencySeriesUpdateRequest,
  ExchangeRateResponse,
  ExchangeRateImportResultResponse,
} from '@/types/currency';

export const currencyApi = {
  /**
   * Get all currency series
   * GET /v1/currencies?enabledOnly={boolean}
   */
  getCurrencies: async (enabledOnly = false): Promise<CurrencySeriesResponse[]> => {
    const response = await apiClient.get<CurrencySeriesResponse[]>('/v1/currencies', {
      params: { enabledOnly },
    });
    return response.data;
  },

  /**
   * Get currency series by ID
   * GET /v1/currencies/{id}
   */
  getCurrencyById: async (id: number): Promise<CurrencySeriesResponse> => {
    const response = await apiClient.get<CurrencySeriesResponse>(`/v1/currencies/${id}`);
    return response.data;
  },

  /**
   * Create a new currency series
   * POST /v1/currencies
   */
  createCurrency: async (request: CurrencySeriesCreateRequest): Promise<CurrencySeriesResponse> => {
    const response = await apiClient.post<CurrencySeriesResponse>('/v1/currencies', request);
    return response.data;
  },

  /**
   * Update an existing currency series
   * PUT /v1/currencies/{id}
   */
  updateCurrency: async (
    id: number,
    request: CurrencySeriesUpdateRequest,
  ): Promise<CurrencySeriesResponse> => {
    const response = await apiClient.put<CurrencySeriesResponse>(`/v1/currencies/${id}`, request);
    return response.data;
  },

  /**
   * Get exchange rates for a target currency
   * GET /v1/exchange-rates?targetCurrency={currency}&startDate={date}&endDate={date}
   * API guarantees a rate for every date in the range
   * If startDate/endDate are omitted, returns all available rates
   */
  getExchangeRates: async (params: {
    targetCurrency: string;
    startDate?: string; // LocalDate format YYYY-MM-DD
    endDate?: string; // LocalDate format YYYY-MM-DD
  }): Promise<ExchangeRateResponse[]> => {
    const response = await apiClient.get<ExchangeRateResponse[]>('/v1/exchange-rates', {
      params,
    });
    return response.data;
  },

  /**
   * Import latest available rates from FRED
   * GET /v1/exchange-rates/import
   * Manually triggers daily cron job
   */
  importExchangeRates: async (): Promise<ExchangeRateImportResultResponse> => {
    const response = await apiClient.get<ExchangeRateImportResultResponse>(
      '/v1/exchange-rates/import',
    );
    return response.data;
  },
};
