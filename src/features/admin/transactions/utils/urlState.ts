// src/features/admin/transactions/utils/urlState.ts
import type { TransactionSearchQuery, TransactionSearchFilters } from '@/types/transactionSearch';
import type { TransactionType } from '@/types/transaction';

/**
 * Admin transactions search URL state management.
 *
 * Centralizes the URL contract: parsing query params -> TransactionSearchQuery and
 * serializing TransactionSearchQuery -> URLSearchParams.
 *
 * Pure module (no React, no router) so it is cheap to unit test.
 */

export const ADMIN_TXN_PARAMS = {
  DESCRIPTION: 'q',
  OWNER_ID: 'ownerId',
  BANK: 'bank',
  ACCOUNT: 'account',
  TYPE: 'type',
  DATE_FROM: 'dateFrom',
  DATE_TO: 'dateTo',
  MIN_AMOUNT: 'minAmount',
  MAX_AMOUNT: 'maxAmount',
  CURRENCY: 'currency',
  PAGE: 'page',
  SIZE: 'size',
  SORT: 'sort',
} as const;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 50;
const DEFAULT_SORT: string[] = ['date,DESC', 'id,DESC'];

// Whitelist matched to backend (GET /v1/transactions/search in docs/api/budget-analyzer-api.yaml)
export const SORTABLE_FIELDS = [
  'id',
  'ownerId',
  'accountId',
  'bankName',
  'date',
  'currencyIsoCode',
  'amount',
  'type',
  'description',
  'createdAt',
  'updatedAt',
] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

const SORT_DIRECTIONS = ['ASC', 'DESC'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const TRANSACTION_TYPES: readonly TransactionType[] = ['CREDIT', 'DEBIT'];

function clampPageSize(size: number): PageSize {
  if (PAGE_SIZE_OPTIONS.includes(size as PageSize)) {
    return size as PageSize;
  }
  return DEFAULT_PAGE_SIZE;
}

function parseSortEntry(entry: string): string | null {
  const [field, dirRaw] = entry.split(',');
  if (!field || !SORTABLE_FIELDS.includes(field as SortableField)) {
    return null;
  }
  const dir = (dirRaw ?? 'ASC').toUpperCase();
  if (!SORT_DIRECTIONS.includes(dir as SortDirection)) {
    return null;
  }
  return `${field},${dir}`;
}

function parseStringParam(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key);
  if (value === null || value === '') return undefined;
  return value;
}

function parseNumberParam(searchParams: URLSearchParams, key: string): number | undefined {
  const value = searchParams.get(key);
  if (value === null || value === '') return undefined;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;
  return parsed;
}

function parseTypeParam(searchParams: URLSearchParams): TransactionType | undefined {
  const value = searchParams.get(ADMIN_TXN_PARAMS.TYPE);
  if (value === null || value === '') return undefined;
  const upper = value.toUpperCase();
  if (TRANSACTION_TYPES.includes(upper as TransactionType)) {
    return upper as TransactionType;
  }
  return undefined;
}

/**
 * Parse a URLSearchParams object into a fully-defaulted TransactionSearchQuery.
 */
export function parseAdminTxnQuery(searchParams: URLSearchParams): TransactionSearchQuery {
  const pageRaw = parseNumberParam(searchParams, ADMIN_TXN_PARAMS.PAGE) ?? 0;
  const page = pageRaw < 0 ? 0 : Math.floor(pageRaw);

  const sizeRaw = parseNumberParam(searchParams, ADMIN_TXN_PARAMS.SIZE) ?? DEFAULT_PAGE_SIZE;
  const size = clampPageSize(Math.floor(sizeRaw));

  const sortValues = searchParams.getAll(ADMIN_TXN_PARAMS.SORT);
  const validSorts = sortValues.map(parseSortEntry).filter((s): s is string => s !== null);
  const sort = validSorts.length > 0 ? validSorts : [...DEFAULT_SORT];

  return {
    page,
    size,
    sort,
    description: parseStringParam(searchParams, ADMIN_TXN_PARAMS.DESCRIPTION),
    ownerId: parseStringParam(searchParams, ADMIN_TXN_PARAMS.OWNER_ID),
    bankName: parseStringParam(searchParams, ADMIN_TXN_PARAMS.BANK),
    accountId: parseStringParam(searchParams, ADMIN_TXN_PARAMS.ACCOUNT),
    type: parseTypeParam(searchParams),
    dateFrom: parseStringParam(searchParams, ADMIN_TXN_PARAMS.DATE_FROM),
    dateTo: parseStringParam(searchParams, ADMIN_TXN_PARAMS.DATE_TO),
    minAmount: parseNumberParam(searchParams, ADMIN_TXN_PARAMS.MIN_AMOUNT),
    maxAmount: parseNumberParam(searchParams, ADMIN_TXN_PARAMS.MAX_AMOUNT),
    currencyIsoCode: parseStringParam(searchParams, ADMIN_TXN_PARAMS.CURRENCY),
  };
}

function appendIfDefined(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === '') return;
  params.set(key, String(value));
}

/**
 * Serialize a TransactionSearchQuery back to URLSearchParams.
 * Defaults are omitted (page=0, size=50, default sort) to keep URLs short.
 */
export function buildAdminTxnSearchParams(query: TransactionSearchQuery): URLSearchParams {
  const params = new URLSearchParams();

  appendIfDefined(params, ADMIN_TXN_PARAMS.DESCRIPTION, query.description);
  appendIfDefined(params, ADMIN_TXN_PARAMS.OWNER_ID, query.ownerId);
  appendIfDefined(params, ADMIN_TXN_PARAMS.BANK, query.bankName);
  appendIfDefined(params, ADMIN_TXN_PARAMS.ACCOUNT, query.accountId);
  appendIfDefined(params, ADMIN_TXN_PARAMS.TYPE, query.type);
  appendIfDefined(params, ADMIN_TXN_PARAMS.DATE_FROM, query.dateFrom);
  appendIfDefined(params, ADMIN_TXN_PARAMS.DATE_TO, query.dateTo);
  appendIfDefined(params, ADMIN_TXN_PARAMS.MIN_AMOUNT, query.minAmount);
  appendIfDefined(params, ADMIN_TXN_PARAMS.MAX_AMOUNT, query.maxAmount);
  appendIfDefined(params, ADMIN_TXN_PARAMS.CURRENCY, query.currencyIsoCode);

  if (query.page > 0) {
    params.set(ADMIN_TXN_PARAMS.PAGE, String(query.page));
  }
  if (query.size !== DEFAULT_PAGE_SIZE) {
    params.set(ADMIN_TXN_PARAMS.SIZE, String(query.size));
  }

  const sortIsDefault =
    query.sort.length === DEFAULT_SORT.length && query.sort.every((s, i) => s === DEFAULT_SORT[i]);
  if (!sortIsDefault) {
    for (const s of query.sort) {
      params.append(ADMIN_TXN_PARAMS.SORT, s);
    }
  }

  return params;
}

/**
 * Build URLSearchParams that clear all filters but preserve page size and sort.
 */
export function clearAdminTxnFilters(query: TransactionSearchQuery): URLSearchParams {
  const cleared: TransactionSearchQuery = {
    page: 0,
    size: query.size,
    sort: query.sort,
  };
  return buildAdminTxnSearchParams(cleared);
}

/**
 * Returns true if any filter (not page/size/sort) is currently active.
 */
export function hasActiveFilters(query: TransactionSearchQuery): boolean {
  const filterKeys: (keyof TransactionSearchFilters)[] = [
    'ownerId',
    'accountId',
    'bankName',
    'description',
    'type',
    'dateFrom',
    'dateTo',
    'minAmount',
    'maxAmount',
    'currencyIsoCode',
  ];
  return filterKeys.some((k) => query[k] !== undefined && query[k] !== '');
}
