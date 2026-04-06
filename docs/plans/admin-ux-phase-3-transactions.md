# Phase 3: Admin Transaction Browsing (Read-Only)

**Status:** Ready to implement
**Parent plan:** [admin-ux-separate-identity.md](./admin-ux-separate-identity.md)

## Context

Implements Phase 3 of [admin-ux-separate-identity.md](./admin-ux-separate-identity.md). Phases 1–2 are
complete: admin users land on a separate `AdminLayout` with currencies and
statement formats working, and a "Transactions" nav item is rendered as
disabled (`src/features/admin/components/AdminLayout.tsx:33-37`). The goal of
Phase 3 is to flip that nav item live with a server‑driven, read‑only browse
of all users' transactions.

The backend endpoint exists in the spec:

- `GET /v1/admin/transactions` → `PagedResponseAdminTransactionResponse`
  (`docs/api/budget-analyzer-api.yaml:1239-1463`)
- `AdminTransactionResponse` schema at `docs/api/budget-analyzer-api.yaml:2763-2828`
- `PageMetadataResponse` at `docs/api/budget-analyzer-api.yaml:2829-2873`
- Wrapper `PagedResponseAdminTransactionResponse` at `docs/api/budget-analyzer-api.yaml:2874-2888`

## Backend Decisions

The OpenAPI spec is structurally sufficient. Three things were considered;
the user's decisions are recorded here so the plan body matches.

### Owner email/name on `AdminTransactionResponse` — DEFERRED

Considered adding `ownerEmail`/`ownerName` to `AdminTransactionResponse` so
the owner column could show human‑readable identity. **Rejected:** the
transaction service should not join across the permission/identity service.
The owner column will display `ownerId` (opaque IdP subject like
`"usr_test123"`) only.

### Filter by `ownerEmail` query param — DEFERRED

Same reason as above. The `/v1/admin/transactions` endpoint will only support
`ownerId` (exact string match) for the foreseeable future, which is what the
spec already exposes (`docs/api/budget-analyzer-api.yaml:1256-1268`).

The "filter by user" requirement from the parent plan is satisfied minimally:
admins can paste an `ownerId` to scope results to one user. Building a true
"find user by email then filter" UX is parked until there's an identity
lookup endpoint outside transaction-service.

### `GET /v1/admin/transactions/{id}` — NOT NEEDED

Verified by re‑reading `docs/api/budget-analyzer-api.yaml:1239-1463`: the
search endpoint already accepts an `id` query param. So
`GET /v1/admin/transactions?id=42` returns a one‑element page containing the
exact transaction. There is no field in `AdminTransactionResponse` that the
search omits and a hypothetical by‑id endpoint would add — they would return
identical shapes. If Phase 4 wants a real admin detail page, it can call
`useAdminTransactions({ id, page: 0, size: 1 })` from the detail route, or
pass the row through router state on click. No new backend work.

Phase 3 still skips row→detail navigation, but the rationale is "we don't
need a detail page yet", not "the backend can't support it".

## Architectural Decisions

- **URL params are the source of truth** for filters, page, size, sort. No
  Redux. This matches the analytics page pattern
  (`src/features/analytics/pages/AnalyticsPage.tsx:34-145`,
  `src/features/analytics/utils/urlState.ts`) and avoids the
  Redux+client‑filter complexity of the user `TransactionTable` (which client‑
  filters because it loads everything once).
- **React Query keys include the full param object** so paging/filters cache
  cleanly. Use `placeholderData: keepPreviousData` for smooth pagination.
- **TanStack Table in manual mode**: `manualPagination: true`,
  `manualSorting: true`, `pageCount` and `rowCount` from response metadata.
  No `getPaginationRowModel` / `getSortedRowModel`.
- **No reuse of `TransactionTable`** — confirmed by Phase 3 design notes; the
  user table is Redux‑coupled with bulk delete, inline edit, save‑as‑view,
  client filter, etc. Stripping these would be more code than starting fresh.
- **No new shared components beyond `DateRangeFilter`** (see below).

## Files to LIFT (move from feature → shared)

The user transactions feature owns
`src/features/transactions/components/DateRangeFilter.tsx` (43 lines, no
transaction‑specific deps). Lifting it is the cleanest way to share with
admin per the "features don't import from each other" rule in `AGENTS.md:103`.

| File | Action |
|------|--------|
| `src/features/transactions/components/DateRangeFilter.tsx` | **Move** → `src/components/DateRangeFilter.tsx` (no code change) |
| `src/features/transactions/components/TransactionTable.tsx:42` | **Edit** the import: `from './DateRangeFilter'` → `from '@/components/DateRangeFilter'` |

## Files to CREATE

### 1. `src/types/adminTransaction.ts`

TypeScript types mirroring the OpenAPI schemas. Kept separate from
`src/types/transaction.ts` because the admin response is a different shape
(adds `ownerId`).

```ts
import type { TransactionType } from '@/types/transaction';

export interface AdminTransaction {
  id: number;
  ownerId: string;             // opaque IdP subject (e.g. "usr_test123")
  accountId: string;
  bankName: string;
  date: string;                // YYYY-MM-DD
  currencyIsoCode: string;
  amount: number;
  type: TransactionType;
  description: string;
  createdAt: string;           // ISO 8601
  updatedAt: string;           // ISO 8601
}

export interface PageMetadata {
  page: number;
  size: number;
  numberOfElements: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface PagedResponse<T> {
  content: T[];
  metadata: PageMetadata;
}

export interface AdminTransactionFilters {
  ownerId?: string;            // exact string match (no email lookup — deferred)
  accountId?: string;
  bankName?: string;
  description?: string;
  type?: TransactionType;
  dateFrom?: string;           // YYYY-MM-DD
  dateTo?: string;             // YYYY-MM-DD
  minAmount?: number;
  maxAmount?: number;
  currencyIsoCode?: string;
}

export interface AdminTransactionsQuery extends AdminTransactionFilters {
  page: number;                // 0-based
  size: number;
  sort: string[];              // e.g. ['date,DESC', 'id,DESC']
}
```

### 2. `src/api/adminTransactionApi.ts`

Thin axios wrapper, mirrors `src/api/transactionApi.ts:12-80` pattern.

```ts
import { apiClient } from '@/api/client';
import type {
  AdminTransaction,
  AdminTransactionsQuery,
  PagedResponse,
} from '@/types/adminTransaction';

export const adminTransactionApi = {
  searchTransactions: async (
    query: AdminTransactionsQuery,
  ): Promise<PagedResponse<AdminTransaction>> => {
    const response = await apiClient.get<PagedResponse<AdminTransaction>>(
      '/v1/admin/transactions',
      { params: query, paramsSerializer: { indexes: null } }, // sort=a&sort=b
    );
    return response.data;
  },
};
```

Note: `paramsSerializer: { indexes: null }` is required so the `sort: string[]`
is serialized as `sort=date,DESC&sort=id,DESC` (Spring's expected style),
not `sort[0]=...&sort[1]=...`.

### 3. `src/features/admin/transactions/api/useAdminTransactions.ts`

```ts
import { useQuery, keepPreviousData, type UseQueryResult } from '@tanstack/react-query';
import { adminTransactionApi } from '@/api/adminTransactionApi';
import type {
  AdminTransaction,
  AdminTransactionsQuery,
  PagedResponse,
} from '@/types/adminTransaction';
import type { ApiError } from '@/types/apiError';

const adminTransactionsKey = (q: AdminTransactionsQuery) =>
  ['adminTransactions', q] as const;

export function useAdminTransactions(
  query: AdminTransactionsQuery,
): UseQueryResult<PagedResponse<AdminTransaction>, ApiError> {
  return useQuery({
    queryKey: adminTransactionsKey(query),
    queryFn: () => adminTransactionApi.searchTransactions(query),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30,
    retry: 1,
  });
}
```

`keepPreviousData` keeps the table populated while the next page is loading,
avoiding a flash to skeleton on every page change. 30s stale time matches
admin's expectation that data is "reasonably fresh" without hammering.

### 4. `src/features/admin/transactions/utils/urlState.ts`

Centralizes the URL contract (parse + serialize), mirroring
`src/features/analytics/utils/urlState.ts`.

Responsibilities:
- Constants for param names: `q` (description), `ownerId`, `bank`,
  `account`, `type`, `dateFrom`, `dateTo`, `minAmount`, `maxAmount`,
  `currency`, `page`, `size`, `sort`.
- `parseAdminTxnQuery(searchParams: URLSearchParams): AdminTransactionsQuery`
  with sensible defaults: `page=0`, `size=50`, `sort=['date,DESC','id,DESC']`.
- `buildAdminTxnSearchParams(query: AdminTransactionsQuery): URLSearchParams`.
- `clearAdminTxnFilters(searchParams)` helper.
- Validation: clamp `page >= 0`, `size` ∈ `[10, 25, 50, 100, 200]`,
  `sort` whitelist matched to backend (`docs/api/budget-analyzer-api.yaml:1444-1446`):
  `id, ownerId, accountId, bankName, date, currencyIsoCode, amount, type, description, createdAt, updatedAt`.

This module is pure (no React, no router) so it's cheap to unit test.

### 5. `src/features/admin/transactions/components/AdminTransactionFilters.tsx`

Filter bar component. Receives `query` and `onChange(partialQuery)` from the
page; never reads URL directly. Uses:

- `Input` (`@/components/ui/Input`) for: search (description), owner ID,
  bank, account, min/max amount.
- `DateRangeFilter` (lifted to `@/components/DateRangeFilter`) for date range.
- `Select` (`@/components/ui/Select`) for type (`All / DEBIT / CREDIT`).
- `Button` for "Clear all".
- `useDebounce` (`@/hooks/useDebounce`, 400ms) for the text/number inputs so
  typing doesn't fire one request per keystroke.
- "Search" submit on Enter for the description box (mirrors user table's
  pattern at `src/features/transactions/components/TransactionTable.tsx:127-140`).

The owner filter is a free‑text input that maps to the `ownerId` query
param (exact match, not contains). Placeholder text: `"Filter by owner ID
(e.g. usr_test123)"`. Document the limitation in a small `<p
className="text-xs text-muted-foreground">` near the input: "Owner ID is an
opaque identifier. Email‑based lookup is not currently supported."

NO bank/account/currency dropdowns: the backend has no aggregate endpoint to
list distinct values across all users, and we cannot derive them from the
current page (would be a misleading subset). Free‑text only — call this out
in the placeholder text ("Filter by bank name…").

### 6. `src/features/admin/transactions/components/AdminTransactionTable.tsx`

Read‑only TanStack Table. Receives `data: AdminTransaction[]`, `metadata:
PageMetadata`, current `sort`, `onSortChange`, `onPageChange`, `isFetching`.

Columns (match the OpenAPI fields, no inline edit, no row selection, no
actions column):

1. `date` — sortable, `formatLocalDate` from `@/utils/dates`
2. `description` — not sortable in v1 (column too wide; can revisit)
3. `bankName` — sortable
4. `accountId` — sortable
5. `type` — `Badge` (CREDIT = green outline, DEBIT = default)
6. `amount` — sortable, right‑aligned, `formatCurrency` from `@/utils/currency`,
   currency code badge if `currencyIsoCode !== 'USD'`. Reuse the visual idea
   from `TransactionAmountBadge` but inline (don't import from
   `features/transactions/`).
7. `ownerId` — sortable, monospace small text (`font-mono text-xs
   text-muted-foreground`). Header label: "Owner ID". Truncate with the
   `truncate` Tailwind class. Per `AGENTS.md:232` (no tooltips), the full ID
   is always visible inline if it fits, otherwise truncated — admins who
   need the whole string can copy it from the URL filter or scroll the
   column. This is the deferred‑email tradeoff documented in "Backend
   Decisions" above.
8. `createdAt` — `formatTimestamp` from `@/utils/dates`, smaller muted text

Key TanStack Table config:

```ts
const table = useReactTable({
  data,
  columns,
  pageCount: metadata.totalPages,
  rowCount: metadata.totalElements,
  state: {
    pagination: { pageIndex: metadata.page, pageSize: metadata.size },
    sorting: parseSortStateFromQuery(sort),
  },
  manualPagination: true,
  manualSorting: true,
  getCoreRowModel: getCoreRowModel(),
  onSortingChange: (updater) => {
    const next = typeof updater === 'function'
      ? updater(parseSortStateFromQuery(sort))
      : updater;
    onSortChange(serializeSortStateToQuery(next));
  },
  onPaginationChange: (updater) => {
    const current = { pageIndex: metadata.page, pageSize: metadata.size };
    const next = typeof updater === 'function' ? updater(current) : updater;
    if (next.pageIndex !== current.pageIndex) onPageChange(next.pageIndex);
    if (next.pageSize !== current.pageSize) onSizeChange(next.pageSize);
  },
});
```

Pagination footer: First / Prev / Page X of N / Next / Last buttons (mirror
`TransactionTable.tsx:629-664`), plus a `Select` for page size
(`10/25/50/100/200`) and a "Showing X–Y of Z" label fed by
`metadata.numberOfElements` and `metadata.totalElements`.

Empty / loading / error states:
- Initial load → `Skeleton` rows (5 of them) inside the table body.
- `isFetching && data` → keep current data (via `keepPreviousData`), overlay a
  subtle loading bar at the top of the card.
- Empty result → reuse the empty‑state pattern from `CurrenciesListPage.tsx:157-170` (centered icon + text).
- Error → `<ErrorBanner error={error} onRetry={refetch} />` from `@/components/ErrorBanner`.

No `useEffect` for derived state — sort/page state lives in URL → query →
hook → table props, never mirrored to local React state. (`AGENTS.md:170-176`.)

### 7. `src/features/admin/transactions/pages/AdminTransactionsPage.tsx`

Glue page. Mirrors `AnalyticsPage.tsx` shape:

```tsx
export function AdminTransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseAdminTxnQuery(searchParams), [searchParams]);
  const { data, isLoading, isFetching, error, refetch } = useAdminTransactions(query);

  const handleQueryChange = useCallback(
    (next: Partial<AdminTransactionsQuery>) => {
      // merge, reset page to 0 on filter change, then update URL
      const merged = { ...query, ...next, page: 'page' in next ? next.page! : 0 };
      setSearchParams(buildAdminTxnSearchParams(merged), { replace: true });
    },
    [query, setSearchParams],
  );

  // page-size, page, sort handlers all delegate to handleQueryChange
  // ...

  return (
    <div className="h-full bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-8 py-10">
        <PageHeader
          title="Transactions"
          description="Browse all users' transactions (read-only)"
        />
        <AdminTransactionFilters query={query} onChange={handleQueryChange} />
        {error ? (
          <ErrorBanner error={error} onRetry={() => refetch()} />
        ) : (
          <AdminTransactionTable
            data={data?.content ?? []}
            metadata={data?.metadata}
            sort={query.sort}
            isLoading={isLoading}
            isFetching={isFetching}
            onPageChange={(page) => handleQueryChange({ page })}
            onSizeChange={(size) => handleQueryChange({ size, page: 0 })}
            onSortChange={(sort) => handleQueryChange({ sort, page: 0 })}
          />
        )}
      </div>
    </div>
  );
}
```

Imports `PageHeader` from `@/components/PageHeader`, `ErrorBanner` from
`@/components/ErrorBanner`, plus the three new admin transaction modules.

## Files to MODIFY

### 1. `src/App.tsx`

Add the route inside the existing admin block (after line 47, before the
`path="*"` catch‑all so the `*` still wins for unmatched admin paths):

```tsx
<Route path="transactions" element={<AdminTransactionsPage />} />
```

And add the import at the top with the other admin imports (around line 23).

### 2. `src/features/admin/components/AdminLayout.tsx`

Remove `disabled: true` from the Transactions nav item at lines 32-37:

```diff
   {
     to: '/admin/transactions',
     label: 'Transactions',
     icon: List,
-    disabled: true,
   },
```

### 3. `src/features/admin/pages/AdminDashboard.tsx`

Add a third summary card for Transactions next to Currencies and Statement
Formats. Mirrors the existing two cards (`AdminDashboard.tsx:32-108`). The
count comes from a one‑off `useAdminTransactions({ page: 0, size: 1, ... })`
call — `metadata.totalElements` gives the system‑wide count without fetching
rows. Change the grid from `sm:grid-cols-2` to `lg:grid-cols-3` to fit.

### 4. `src/mocks/handlers.ts`

Add a handler for the admin search so any future test that mounts
`AdminTransactionsPage` doesn't network‑fail:

```ts
http.get('/api/v1/admin/transactions', () => {
  return HttpResponse.json({
    content: [
      {
        id: 1,
        ownerId: 'usr_test123',
        accountId: 'checking-3223',
        bankName: 'Capital One',
        date: '2025-10-14',
        currencyIsoCode: 'USD',
        amount: 100.5,
        type: 'DEBIT',
        description: 'Grocery shopping',
        createdAt: '2025-10-14T10:30:00Z',
        updatedAt: '2025-10-14T10:30:00Z',
      },
    ],
    metadata: {
      page: 0,
      size: 50,
      numberOfElements: 1,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    },
  });
}),
```

### 5. `docs/plans/admin-ux-separate-identity.md`

- Flip Phase 3 **Status** from "Not started" to "Complete" once the work
  lands (`docs/plans/admin-ux-separate-identity.md:148`).
- Resolve the open question "What user info should the transaction owner
  column show? (email, name, ID?)" with: **ID only** — by user decision,
  transaction‑service does not join across permission‑service
  (`docs/plans/admin-ux-separate-identity.md:187`).
- Resolve the open question about backend endpoint shape with: **single
  search endpoint, no separate by‑id endpoint needed** — search already
  accepts `id` as a filter (`docs/plans/admin-ux-separate-identity.md:190`).

## Things Explicitly NOT in this plan

- **No filter‑by‑email for the owner column.** Deferred per user decision —
  transaction‑service will not join across permission‑service. Owner filter
  is exact‑match `ownerId` only. Revisit when an identity lookup endpoint
  exists outside transaction‑service.
- **No owner email/name in the row.** Same reason. Owner column shows the
  raw `ownerId` string.
- **No row click → detail page.** All `AdminTransactionResponse` fields are
  already visible in the row; a detail page would just re‑render the same
  data. If we want one later, the existing search endpoint already accepts
  `id` as a query param — no new backend work required.
- No reuse of `useTransactions` / `TransactionTable` / Redux `transactionTable` slice — admin is a different consumer with server-side pagination.
- No bank/account/currency dropdown filters (no aggregate endpoint exists; deriving from current page would be misleading).
- No "save as view" — views are user-scoped feature.
- No bulk select / delete / inline edit — Phase 3 is read-only.
- No CSV export of admin results — listed in `docs/plans/admin-ux-separate-identity.md:189` open questions; defer.
- No usage of `useAppDispatch` / `uiSlice` from admin code — admin avoids Redux entirely.

## Verification

Run in this order from `/workspace/budget-analyzer-web`:

1. `npm run typecheck` — proves all types resolve, the lifted
   `DateRangeFilter` import is correct, and no stale `transaction.ts`
   imports leaked into admin code.
2. `npm run lint:fix` — auto‑fixes formatting/import order.
3. `npm test -- adminTransactions` — once a small smoke test exists for
   `useAdminTransactions` (one test asserting MSW handler is hit and the
   parsed `PagedResponse` shape lands in `data`).
4. `npm test -- AdminTransactionsPage` (optional) — render the page with
   MSW, assert the table renders one row, click "next page" disabled state.
5. **Manual E2E (the real verification):**
   1. `npm run dev` (user runs this — do NOT run automatically per `AGENTS.md:266`).
   2. Log in as an admin user.
   3. Navigate to `/admin` — confirm the Transactions nav item is no longer
      greyed out / "Soon".
   4. Click Transactions → land on `/admin/transactions`.
   5. Verify a paginated table loads. DevTools → Network → confirm a single
      `GET /api/v1/admin/transactions?page=0&size=50&sort=date,DESC&sort=id,DESC`.
   6. Type in description search → 400ms after stop, confirm a new request
      with `description=...&page=0`.
   7. Click a column header (date / amount / bankName) → confirm
      `sort=<col>,ASC|DESC` round‑trips through the URL.
   8. Click "Next page" → confirm `page=1` URL update and table doesn't
      flash to skeleton (keepPreviousData working).
   9. Set page size to 100 → confirm `size=100&page=0`.
   10. Refresh the browser with a deep‑filtered URL → confirm filters
       restore and the table shows the same data (URL is the source of truth).
   11. As a non‑admin user, hit `/admin/transactions` directly → confirm
       redirect to `/` (existing `AdminRoute` guard at
       `src/features/admin/components/AdminRoute.tsx:57-72`).

## Dependencies on Backend

None. The current OpenAPI spec is sufficient for the plan above:

- Search endpoint `GET /v1/admin/transactions` exists with all required filters and server-side pagination/sort.
- `id` query param on the search endpoint covers the lookup-by-id case if a future detail page is built.
- Email-based owner filter is explicitly deferred (per user decision: transaction-service should not join across permission-service).
