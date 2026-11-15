// src/api/currencyApi.ts
import { apiClient } from '@/api/client';
import { assertArrayResponse } from '@/api/collectionResponse';
import {
  CurrencySeriesResponse,
  CurrencySeriesCreateRequest,
  CurrencySeriesUpdateRequest,
  ExchangeRateResponse,
} from '@/types/currency';

export const currencyApi = {
  /**
   * Get all currency series
   * GET /v1/currencies?enabledOnly={boolean}
   */
  getCurrencies: async (enabledOnly = false): Promise<CurrencySeriesResponse[]> => {
    const response = await apiClient.get<unknown>('/v1/currencies', {
      params: { enabledOnly },
    });
    return assertArrayResponse<CurrencySeriesResponse>(response.data);
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
   * The response is dense: one rate per date, from the first source rate in the range through
   * the effective end date. A range with no source rate returns an empty list.
   * An omitted startDate means the first available rate
   * An omitted endDate means today (UTC), and an endDate after tomorrow (UTC) is treated as
   * tomorrow
   */
  getExchangeRates: async (params: {
    targetCurrency: string;
    startDate?: string; // LocalDate format YYYY-MM-DD
    endDate?: string; // LocalDate format YYYY-MM-DD
  }): Promise<ExchangeRateResponse[]> => {
    const response = await apiClient.get<unknown>('/v1/exchange-rates', {
      params,
    });
    return assertArrayResponse<ExchangeRateResponse>(response.data);
  },
};
