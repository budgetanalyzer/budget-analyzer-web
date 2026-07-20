// src/utils/navigation.ts

/**
 * Parameters for building a transactions URL with date filters and navigation context.
 */
export interface BuildTransactionsUrlParams {
  /** Start date in YYYY-MM-DD format */
  dateFrom: string;
  /** End date in YYYY-MM-DD format */
  dateTo: string;
  /** URL to return to after viewing transactions */
  returnTo: string;
  /** Label to display in breadcrumb navigation */
  breadcrumbLabel: string;
}

export interface BuildAnalyticsDrilldownUrlParams extends BuildTransactionsUrlParams {
  /** Active analytics data source */
  scope: 'all' | 'view';
  /** Saved view ID when scope is "view" */
  viewId?: string;
  /** Transaction type selected in analytics */
  transactionType: 'debit' | 'credit';
}

/**
 * Builds a URL for the transactions page with date filters and navigation context.
 *
 * Creates a properly encoded query string with:
 * - Date range filters (dateFrom, dateTo)
 * - Return navigation path (returnTo)
 * - Breadcrumb label for user context
 *
 * @param params - URL building parameters
 * @returns Complete URL path with encoded query parameters
 *
 * @example
 * ```typescript
 * const url = buildTransactionsUrl({
 *   dateFrom: '2025-01-01',
 *   dateTo: '2025-01-31',
 *   returnTo: '/analytics?viewMode=monthly&year=2025',
 *   breadcrumbLabel: 'January 2025'
 * });
 * // Returns: '/?dateFrom=2025-01-01&dateTo=2025-01-31&returnTo=%2Fanalytics%3FviewMode%3Dmonthly%26year%3D2025&breadcrumbLabel=January%202025'
 * ```
 */
export function buildTransactionsUrl(params: BuildTransactionsUrlParams): string {
  const { dateFrom, dateTo, returnTo, breadcrumbLabel } = params;

  return `/?dateFrom=${dateFrom}&dateTo=${dateTo}&returnTo=${encodeURIComponent(returnTo)}&breadcrumbLabel=${encodeURIComponent(breadcrumbLabel)}`;
}

/**
 * Builds the operational drilldown URL for the active analytics source.
 *
 * All-transaction analytics drill into the Transactions page. Saved-view
 * analytics drill into the corresponding View detail page with the same date
 * bounds, transaction-type filter, and return breadcrumb context.
 */
export function buildAnalyticsDrilldownUrl(params: BuildAnalyticsDrilldownUrlParams): string {
  const { scope, viewId, transactionType, dateFrom, dateTo, returnTo, breadcrumbLabel } = params;
  const basePath = scope === 'view' && viewId ? `/views/${encodeURIComponent(viewId)}` : '/';
  const type = transactionType === 'debit' ? 'DEBIT' : 'CREDIT';

  return `${basePath}?dateFrom=${dateFrom}&dateTo=${dateTo}&type=${type}&returnTo=${encodeURIComponent(returnTo)}&breadcrumbLabel=${encodeURIComponent(breadcrumbLabel)}`;
}
