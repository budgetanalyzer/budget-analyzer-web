// src/features/analytics/utils/urlState.ts

/**
 * Analytics URL state management
 *
 * This module centralizes the URL query parameter contract for the Analytics page.
 * It defines parameter names, valid values, and utilities for building URLs.
 */

// URL parameter names
export const ANALYTICS_PARAMS = {
  SCOPE: 'scope',
  VIEW_ID: 'viewId',
  VIEW_MODE: 'viewMode',
  TRANSACTION_TYPE: 'transactionType',
  YEAR: 'year',
} as const;

// Valid analytics data scopes
export const ANALYTICS_SCOPES = {
  ALL: 'all',
  VIEW: 'view',
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
export type AnalyticsScope = (typeof ANALYTICS_SCOPES)[keyof typeof ANALYTICS_SCOPES];
export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];
export type TransactionTypeParam = (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

export interface AnalyticsUrlState {
  scope: AnalyticsScope;
  viewId?: string;
  viewMode: ViewMode;
  transactionType: TransactionTypeParam;
  year?: number;
}

export interface BuildAnalyticsReturnUrlParams {
  viewMode: ViewMode;
  transactionType: TransactionTypeParam;
  year?: number;
  scope?: AnalyticsScope;
  viewId?: string;
}

function isViewMode(value: string | null): value is ViewMode {
  return value === VIEW_MODES.MONTHLY || value === VIEW_MODES.YEARLY;
}

function isTransactionType(value: string | null): value is TransactionTypeParam {
  return value === TRANSACTION_TYPES.DEBIT || value === TRANSACTION_TYPES.CREDIT;
}

function parseYear(value: string | null): number | undefined {
  if (!value || !/^\d{4}$/.test(value)) {
    return undefined;
  }

  const year = Number.parseInt(value, 10);
  return Number.isFinite(year) ? year : undefined;
}

export function parseAnalyticsSearchParams(searchParams: URLSearchParams): AnalyticsUrlState {
  const scopeParam = searchParams.get(ANALYTICS_PARAMS.SCOPE);
  const viewIdParam = searchParams.get(ANALYTICS_PARAMS.VIEW_ID)?.trim();
  const viewModeParam = searchParams.get(ANALYTICS_PARAMS.VIEW_MODE);
  const transactionTypeParam = searchParams.get(ANALYTICS_PARAMS.TRANSACTION_TYPE);

  const scope =
    scopeParam === ANALYTICS_SCOPES.VIEW && viewIdParam
      ? ANALYTICS_SCOPES.VIEW
      : ANALYTICS_SCOPES.ALL;

  return {
    scope,
    viewId: scope === ANALYTICS_SCOPES.VIEW ? viewIdParam : undefined,
    viewMode: isViewMode(viewModeParam) ? viewModeParam : VIEW_MODES.MONTHLY,
    transactionType: isTransactionType(transactionTypeParam)
      ? transactionTypeParam
      : TRANSACTION_TYPES.DEBIT,
    year: parseYear(searchParams.get(ANALYTICS_PARAMS.YEAR)),
  };
}

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
 * buildAnalyticsReturnUrl({ viewMode: 'yearly', transactionType: 'credit' })
 * // Returns: "/analytics?scope=all&viewMode=yearly&transactionType=credit"
 *
 * buildAnalyticsReturnUrl({
 *   scope: 'view',
 *   viewId: 'view-1',
 *   viewMode: 'monthly',
 *   transactionType: 'debit',
 *   year: 2024,
 * })
 * // Returns: "/analytics?scope=view&viewId=view-1&viewMode=monthly&transactionType=debit&year=2024"
 */
export function buildAnalyticsReturnUrl(returnUrlParams: BuildAnalyticsReturnUrlParams): string {
  const { viewMode, transactionType, year, scope = ANALYTICS_SCOPES.ALL, viewId } = returnUrlParams;

  const params = new URLSearchParams();
  params.set(ANALYTICS_PARAMS.SCOPE, scope);
  if (scope === ANALYTICS_SCOPES.VIEW && viewId) {
    params.set(ANALYTICS_PARAMS.VIEW_ID, viewId);
  }
  params.set(ANALYTICS_PARAMS.VIEW_MODE, viewMode);
  params.set(ANALYTICS_PARAMS.TRANSACTION_TYPE, transactionType);
  if (year !== undefined) {
    params.set(ANALYTICS_PARAMS.YEAR, year.toString());
  }
  return `/analytics?${params.toString()}`;
}
