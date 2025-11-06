// src/features/currencies/api/currencyApi.ts
import { apiClient } from '@/api/client';
import { CurrencyCode, ExchangeRateResponse } from '@/types/currency';

export const currencyApi = {
  /**
   * Get list of supported currencies
   * GET /v1/currencies
   */
  getCurrencies: async (): Promise<CurrencyCode[]> => {
    const response = await apiClient.get<CurrencyCode[]>('/v1/currencies');
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
    startDate?: string; // ISO date format YYYY-MM-DD
    endDate?: string; // ISO date format YYYY-MM-DD
  }): Promise<ExchangeRateResponse[]> => {
    const response = await apiClient.get<ExchangeRateResponse[]>('/v1/exchange-rates', {
      params,
    });
    return response.data;
  },
};
