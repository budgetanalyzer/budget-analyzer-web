// src/api/currencyApi.ts
import { apiClient } from './client';
import { CurrencyCode, ExchangeRateResponse } from '@/types/currency';

export const currencyApi = {
  /**
   * Get list of supported currencies
   * GET /currencies
   */
  getCurrencies: async (): Promise<CurrencyCode[]> => {
    const response = await apiClient.get<CurrencyCode[]>('/currencies');
    return response.data;
  },

  /**
   * Get exchange rates for a target currency
   * GET /exchange-rates?targetCurrency={currency}&startDate={date}&endDate={date}
   * API guarantees a rate for every date in the range
   * If startDate/endDate are omitted, returns all available rates
   */
  getExchangeRates: async (params: {
    targetCurrency: string;
    startDate?: string; // ISO date format YYYY-MM-DD
    endDate?: string; // ISO date format YYYY-MM-DD
  }): Promise<ExchangeRateResponse[]> => {
    const response = await apiClient.get<ExchangeRateResponse[]>('/exchange-rates', {
      params,
    });
    return response.data;
  },
};
