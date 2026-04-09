// src/features/admin/users/utils/urlState.ts
import type { UserSearchFilters, UserSearchQuery, UserStatus } from '@/types/user';

/**
 * Admin users search URL state management.
 *
 * Centralizes the URL contract: parsing query params -> UserSearchQuery and
 * serializing UserSearchQuery -> URLSearchParams.
 *
 * Pure module (no React, no router) so it is cheap to unit test.
 */

export const ADMIN_USER_PARAMS = {
  EMAIL: 'q',
  DISPLAY_NAME: 'name',
  ID: 'id',
  IDP_SUB: 'idpSub',
  STATUS: 'status',
  CREATED_AFTER: 'createdAfter',
  CREATED_BEFORE: 'createdBefore',
  UPDATED_AFTER: 'updatedAfter',
  UPDATED_BEFORE: 'updatedBefore',
  PAGE: 'page',
  SIZE: 'size',
  SORT: 'sort',
} as const;

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 50;
const DEFAULT_SORT: string[] = ['createdAt,DESC', 'id,DESC'];

// Whitelist matched to backend (GET /v1/users in docs/api/budget-analyzer-api.yaml)
export const SORTABLE_FIELDS = [
  'id',
  'email',
  'displayName',
  'idpSub',
  'status',
  'createdAt',
  'updatedAt',
] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

const SORT_DIRECTIONS = ['ASC', 'DESC'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

const USER_STATUSES: readonly UserStatus[] = ['ACTIVE', 'DEACTIVATED'];

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

function parseStatusParam(searchParams: URLSearchParams): UserStatus | undefined {
  const value = searchParams.get(ADMIN_USER_PARAMS.STATUS);
  if (value === null || value === '') return undefined;
  const upper = value.toUpperCase();
  if (USER_STATUSES.includes(upper as UserStatus)) {
    return upper as UserStatus;
  }
  return undefined;
}

/**
 * Parse a URLSearchParams object into a fully-defaulted UserSearchQuery.
 */
export function parseAdminUserQuery(searchParams: URLSearchParams): UserSearchQuery {
  const pageRaw = parseNumberParam(searchParams, ADMIN_USER_PARAMS.PAGE) ?? 0;
  const page = pageRaw < 0 ? 0 : Math.floor(pageRaw);

  const sizeRaw = parseNumberParam(searchParams, ADMIN_USER_PARAMS.SIZE) ?? DEFAULT_PAGE_SIZE;
  const size = clampPageSize(Math.floor(sizeRaw));

  const sortValues = searchParams.getAll(ADMIN_USER_PARAMS.SORT);
  const validSorts = sortValues.map(parseSortEntry).filter((s): s is string => s !== null);
  const sort = validSorts.length > 0 ? validSorts : [...DEFAULT_SORT];

  return {
    page,
    size,
    sort,
    email: parseStringParam(searchParams, ADMIN_USER_PARAMS.EMAIL),
    displayName: parseStringParam(searchParams, ADMIN_USER_PARAMS.DISPLAY_NAME),
    id: parseStringParam(searchParams, ADMIN_USER_PARAMS.ID),
    idpSub: parseStringParam(searchParams, ADMIN_USER_PARAMS.IDP_SUB),
    status: parseStatusParam(searchParams),
    createdAfter: parseStringParam(searchParams, ADMIN_USER_PARAMS.CREATED_AFTER),
    createdBefore: parseStringParam(searchParams, ADMIN_USER_PARAMS.CREATED_BEFORE),
    updatedAfter: parseStringParam(searchParams, ADMIN_USER_PARAMS.UPDATED_AFTER),
    updatedBefore: parseStringParam(searchParams, ADMIN_USER_PARAMS.UPDATED_BEFORE),
  };
}

function appendIfDefined(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === '') return;
  params.set(key, String(value));
}

/**
 * Serialize a UserSearchQuery back to URLSearchParams.
 * Defaults are omitted (page=0, size=50, default sort) to keep URLs short.
 */
export function buildAdminUserSearchParams(query: UserSearchQuery): URLSearchParams {
  const params = new URLSearchParams();

  appendIfDefined(params, ADMIN_USER_PARAMS.EMAIL, query.email);
  appendIfDefined(params, ADMIN_USER_PARAMS.DISPLAY_NAME, query.displayName);
  appendIfDefined(params, ADMIN_USER_PARAMS.ID, query.id);
  appendIfDefined(params, ADMIN_USER_PARAMS.IDP_SUB, query.idpSub);
  appendIfDefined(params, ADMIN_USER_PARAMS.STATUS, query.status);
  appendIfDefined(params, ADMIN_USER_PARAMS.CREATED_AFTER, query.createdAfter);
  appendIfDefined(params, ADMIN_USER_PARAMS.CREATED_BEFORE, query.createdBefore);
  appendIfDefined(params, ADMIN_USER_PARAMS.UPDATED_AFTER, query.updatedAfter);
  appendIfDefined(params, ADMIN_USER_PARAMS.UPDATED_BEFORE, query.updatedBefore);

  if (query.page > 0) {
    params.set(ADMIN_USER_PARAMS.PAGE, String(query.page));
  }
  if (query.size !== DEFAULT_PAGE_SIZE) {
    params.set(ADMIN_USER_PARAMS.SIZE, String(query.size));
  }

  const sortIsDefault =
    query.sort.length === DEFAULT_SORT.length && query.sort.every((s, i) => s === DEFAULT_SORT[i]);
  if (!sortIsDefault) {
    for (const s of query.sort) {
      params.append(ADMIN_USER_PARAMS.SORT, s);
    }
  }

  return params;
}

/**
 * Build URLSearchParams that clear all filters but preserve page size and sort.
 */
export function clearAdminUserFilters(query: UserSearchQuery): URLSearchParams {
  const cleared: UserSearchQuery = {
    page: 0,
    size: query.size,
    sort: query.sort,
  };
  return buildAdminUserSearchParams(cleared);
}

/**
 * Returns true if any filter (not page/size/sort) is currently active.
 */
export function hasActiveFilters(query: UserSearchQuery): boolean {
  const filterKeys: (keyof UserSearchFilters)[] = [
    'id',
    'email',
    'displayName',
    'idpSub',
    'status',
    'createdAfter',
    'createdBefore',
    'updatedAfter',
    'updatedBefore',
  ];
  return filterKeys.some((k) => query[k] !== undefined && query[k] !== '');
}
