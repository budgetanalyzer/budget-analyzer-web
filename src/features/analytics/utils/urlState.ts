// src/features/analytics/utils/urlState.ts

/**
 * Analytics URL state management
 *
 * This module centralizes the URL query parameter contract for the Analytics page.
 * It defines parameter names, valid values, and utilities for building URLs.
 */

// URL parameter names
export const ANALYTICS_PARAMS = {
  VIEW_MODE: 'viewMode',
  TRANSACTION_TYPE: 'transactionType',
  YEAR: 'year',
} as const;

// Valid view modes
export const VIEW_MODES = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
} as const;

// Valid transaction types (lowercase for URL params)
export const TRANSACTION_TYPES = {
  DEBIT: 'debit',
  CREDIT: 'credit',
} as const;

// Type exports
export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];
export type TransactionTypeParam = (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

/**
 * Build an analytics return URL with preserved state.
 * Used when navigating away from analytics and needing to return with the same view.
 *
 * @param viewMode - Current view mode (monthly or yearly)
 * @param transactionType - Current transaction type filter (debit or credit)
 * @param year - Optional year (only needed for monthly view)
 * @returns Full analytics URL with query parameters
 *
 * @example
 * buildAnalyticsReturnUrl('yearly', 'credit')
 * // Returns: "/analytics?viewMode=yearly&transactionType=credit"
 *
 * buildAnalyticsReturnUrl('monthly', 'debit', 2024)
 * // Returns: "/analytics?viewMode=monthly&transactionType=debit&year=2024"
 */
export function buildAnalyticsReturnUrl(
  viewMode: ViewMode,
  transactionType: TransactionTypeParam,
  year?: number,
): string {
  const params = new URLSearchParams();
  params.set(ANALYTICS_PARAMS.VIEW_MODE, viewMode);
  params.set(ANALYTICS_PARAMS.TRANSACTION_TYPE, transactionType);
  if (year !== undefined) {
    params.set(ANALYTICS_PARAMS.YEAR, year.toString());
  }
  return `/analytics?${params.toString()}`;
}
