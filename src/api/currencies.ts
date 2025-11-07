import { apiClient } from './client';

/**
 * Currency Series API types and endpoints
 */

export interface CurrencySeries {
  id: number;
  currencyCode: string;
  providerSeriesId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencySeriesCreateRequest {
  currencyCode: string;
  providerSeriesId: string;
  enabled?: boolean;
}

export interface CurrencySeriesUpdateRequest {
  providerSeriesId: string;
  enabled: boolean;
}

/**
 * Get all currency series
 */
export async function getCurrencies(enabledOnly?: boolean): Promise<CurrencySeries[]> {
  const params = enabledOnly !== undefined ? { enabledOnly } : undefined;
  const response = await apiClient.get<CurrencySeries[]>('/v1/currencies', { params });
  return response.data;
}

/**
 * Get currency series by ID
 */
export async function getCurrencyById(id: number): Promise<CurrencySeries> {
  const response = await apiClient.get<CurrencySeries>(`/v1/currencies/${id}`);
  return response.data;
}

/**
 * Create new currency series
 */
export async function createCurrency(data: CurrencySeriesCreateRequest): Promise<CurrencySeries> {
  const response = await apiClient.post<CurrencySeries>('/v1/currencies', data);
  return response.data;
}

/**
 * Update existing currency series
 */
export async function updateCurrency(
  id: number,
  data: CurrencySeriesUpdateRequest,
): Promise<CurrencySeries> {
  const response = await apiClient.put<CurrencySeries>(`/v1/currencies/${id}`, data);
  return response.data;
}
