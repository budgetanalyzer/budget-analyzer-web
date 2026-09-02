# State Architecture

This document owns state placement in the SPA. Keep each value in the narrowest
place that satisfies its workflow; do not promote transient mechanics into a
global store.

## Ownership Summary

| State category                    | Owner                           | Current examples                                           |
| --------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| Server and session data           | TanStack Query                  | Transactions, saved views, users, currencies, current user |
| Refreshable/shareable route state | URL search params               | Transaction filters, analytics controls, admin searches    |
| Global persisted preferences      | Redux Toolkit plus localStorage | Theme, display currency, desktop admin sidebar             |
| Transient UI mechanics            | Local component state           | Draft inputs, sorting, pagination, row selection, dialogs  |
| Derived values                    | Plain calculation or `useMemo`  | Filtered rows, statistics, available filter options        |
| Navigation context                | URL plus browser history        | Analytics drilldown return path and breadcrumb label       |

TanStack Query response data does not belong in Redux. URL state does not need a
second Redux copy. Derived values do not need effects or stored state.

## TanStack Query Server State

Use TanStack Query when a value comes from a backend or Session Gateway request.
It owns cache lifetime, request deduplication, loading/error state, retries, and
invalidation.

Examples include:

- `useAuth()` for the current user;
- `useTransactions()` and `useTransaction(id)` for current-user transaction
  data;
- `useView(id)`, `useViewMembership(id)`, and `useViewTransactions(id)` for
  saved-view metadata and canonical membership; and
- admin query hooks for paginated user and cross-user transaction searches.

Static membership and the complete active current-user transaction snapshot are
separate server-state resources. Saved-view transaction objects are derived by
intersecting the ordered membership IDs with the transaction-list cache; they
are not copied into another cache or hydrated through per-ID detail requests.

Hooks and mutations own query keys and invalidation. Components consume their
results and derive presentation values locally. Transport and malformed-response
contracts belong to [API integration](api-integration.md); endpoint schemas
belong to the generated [unified API](api/budget-analyzer-api.yaml) and
[Session Gateway API](api/session-gateway-api.yaml).

## URL-Backed Route State

Use URL parameters when state must survive refresh, be bookmarkable/shareable,
or identify a precise return destination. Parsing and serialization belong in a
route hook or feature utility, not scattered component effects.

### Transaction and saved-view filters

`src/hooks/useTransactionFiltersSync.ts` is the shared URL contract for the
Transactions page and saved-view detail:

```text
/?q=coffee&dateFrom=2026-01-01&dateTo=2026-01-31&bankName=Test%20Bank&accountId=checking&type=DEBIT&minAmount=10&maxAmount=250&amountCurrency=USD
```

Supported canonical parameters are:

- `q`
- `dateFrom` and `dateTo`
- `bankName`
- `accountId`
- `type`
- `minAmount`, `maxAmount`, and `amountCurrency`

`amountCurrency` records the enabled display currency in which an amount range
was authored. A legacy URL with bounds but no currency uses the current display
currency until the next amount edit canonicalizes the URL. A valid deep link
synchronizes the persisted display preference before applying its range;
malformed or disabled currencies leave the bounds unapplied and visible for the
user to clear. Changing the display currency from the Transactions or saved-view
detail page clears all three amount parameters before updating the preference.

The parser still accepts legacy `bank` and `account` values, but setters replace
them with the canonical names. On saved-view detail these parameters filter the
currently visible static membership only; they do not change collection
membership. All ordinary transaction and saved-view filters operate locally on
the complete snapshot or its member intersection. They are not backend query
criteria.

The applied search term lives in `q`. `TransactionFilterBar` keeps the user's
unsubmitted search text and amount values in local draft state, committing
search on Enter and amounts after their debounce. Clearing all filters removes
the transaction parameters and the drilldown navigation context. Saved-view
member-table filters remain URL-backed while its contextual transaction picker
is open; they do not seed or track the picker.

### Analytics controls and source

Analytics source and controls are URL-backed, not Redux or localStorage state:

```text
/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026
/analytics?scope=view&viewId=<view-id>&viewMode=monthly&transactionType=debit&year=2026
```

`src/features/analytics/utils/urlState.ts` owns parsing and serialization for
`scope`, `viewId`, `viewMode`, `transactionType`, and `year`. Missing or invalid
values fall back to all transactions, monthly view, debit transactions, and the
latest available transaction year when `year` is absent.

`scope=all` resolves data with `useTransactions()`. A valid `scope=view` and
`viewId` resolve static view metadata and the ordered intersection of membership
with the complete active transaction snapshot. `useAnalyticsData` receives the
resolved transaction list and stays independent of its API source. Its monetary
models are derived from per-transaction selected-currency projections: counts
include every qualifying transaction, totals include only available quantized
values, and unavailable counts distinguish partial or all-unavailable periods
from real zero totals.

### Admin searches

Admin transaction and user search filters, pagination, page size, and sorting
also live in the URL. Their pure parser/builders are:

- `src/features/admin/transactions/utils/urlState.ts`
- `src/features/admin/users/utils/urlState.ts`

These utilities validate supported values and omit defaults when building URLs.
The resulting parsed query object is part of the TanStack Query key and API
request. This is the cross-user exception to the ordinary local-filter rule:
the backend applies filters, sorting, and pagination, and amount bounds retain
their stored signed numeric meaning. `currencyIsoCode` is independent from the
amount bounds and from the Redux display-currency preference. Do not move admin
search or pagination state into Redux.

## Redux Preferences

`src/store/uiSlice.ts` is intentionally limited to cross-tree preferences and
layout state:

```ts
{
  theme,
  displayCurrency,
  adminSidebarOpen,
}
```

All three values persist in localStorage. Theme initially falls back to the
browser color-scheme preference, display currency to `USD`, and desktop admin
sidebar visibility to open. The mobile admin sidebar overlay stays local to
`AdminLayout`; it is not the persisted desktop preference.

Do not add transaction filters, search queries, navigation history, table
sorting/pagination, selected transaction IDs, analytics source, or a selected
saved view to Redux.

## Local Component State

Use local state for values that matter only while the owning UI is mounted:

- search and amount drafts before URL commit;
- table sorting and client-side pagination;
- row selection, including select-all-matching mode;
- the transaction or action associated with an open dialog;
- modal visibility and form drafts.

Selection is owned by each table component. It is derived into action IDs only
when a bulk action runs and is cleared according to that component's workflow.
It is not reported upward as a second filtered-row state and is not persisted in
Redux. Saved-view removal can promote the current page selection to all locally
filtered members; that mode derives the complete filtered ID array and clears
only after atomic membership removal succeeds or the user explicitly clears it.
The saved-view add-transactions dialog owns its visibility and its picker's
initially unset filters, sorting, pagination, row selection, and
select-all-matching state. Each opening derives eligible nonmember IDs from the
complete active transaction snapshot while retaining disabled member rows for
context. Closing discards all picker mechanics and mutation feedback. A stale
addition keeps the dialog and selection open but blocks resubmission until the
user changes that selection after refreshed transaction and membership data
arrive.

Use `useMemo` or plain calculations for filtered collections, statistics,
membership maps, display-amount projections, and option lists. Sorting and
presentation pagination also remain with the owning table. Use effects only
when synchronizing an external system, following the repository conventions
summarized in [Architecture](architecture.md).

## Navigation Context

Do not store route history in Redux. Analytics drilldowns add `returnTo` and
`breadcrumbLabel` to the destination URL. The operational page uses that
explicit context for its breadcrumb and back action; otherwise detail-page back
navigation uses browser history when available.

`returnTo` and `breadcrumbLabel` are navigation context, not transaction
filters. Normal links build them from existing internal URLs, and clearing the
operational filters removes them with the filter parameters.

## Placement Checklist

- Data came from an API: TanStack Query.
- Refresh/bookmark/share must preserve it: URL parameters.
- It is a cross-tree persisted preference or desktop layout setting: Redux.
- It is a draft, selection, table mechanic, or open/closed state: local state.
- It can be calculated from current inputs: derive it.
- It describes where a drilldown should return: URL navigation context, then
  browser history as fallback.

Application structure is owned by [Architecture](architecture.md), local
runtime setup by [Development](development.md), authentication query behavior by
[Authentication and authorization](authentication.md), and test policy by the
[Testing guide](testing-guide.md).
