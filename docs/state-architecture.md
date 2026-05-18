# State Architecture Guide

Budget Analyzer uses separate tools for separate kinds of state. Keep state in
the narrowest durable place that satisfies the user workflow.

## State Ownership

| State type | Owner | Examples |
|---|---|---|
| Server state | TanStack Query | Transactions, saved views, users, currencies |
| Shareable route state | URL search params | Transaction filters, analytics source and controls |
| Global preferences | Redux Toolkit | Theme, display currency, persisted desktop admin sidebar |
| Local UI mechanics | Component state | Table sorting, pagination, row selection, draft inputs, modal state |
| Derived data | `useMemo` or plain calculations | Filtered rows, stats, available filter options |

Redux is intentionally small. The `ui` slice contains only:

```ts
{
  theme,
  displayCurrency,
  adminSidebarOpen,
}
```

Do not add transaction filters, table mechanics, navigation history, selected
transaction IDs, analytics source, or selected saved views to Redux.

## React Query

Use React Query for data fetched from backend services. It owns cache lifetime,
deduplication, loading states, errors, and invalidation.

Examples:

- `useTransactions()` for the authenticated user's transactions.
- `useView(viewId)` and `useViewTransactions(viewId)` for saved-view metadata
  and canonical view membership.
- Admin list/search hooks for users, transactions, currencies, and statement
  formats.

Server data should not be copied into Redux. Components receive query data and
derive display-specific values locally.

## URL-Backed Route State

Use URL search params when state must survive refreshes, be shareable, or be a
return target for drilldowns.

### Transaction Filters

The Transactions page treats these URL params as the source of truth:

```text
/?q=coffee&dateFrom=2026-01-01&dateTo=2026-01-31&bankName=Test%20Bank&accountId=checking&type=DEBIT&minAmount=10&maxAmount=250
```

Supported params:

- `q`
- `dateFrom`
- `dateTo`
- `bankName`
- `accountId`
- `type`
- `minAmount`
- `maxAmount`

`returnTo` and `breadcrumbLabel` are navigation context from drilldowns, not
filters. Clearing filters removes them along with the filter params.

### Analytics Source

Analytics does not store its active source in Redux or localStorage. The source
is URL-backed:

```text
/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026
/analytics?scope=view&viewId=<view-id>&viewMode=monthly&transactionType=debit&year=2026
```

`scope=all` resolves data with `useTransactions()`. `scope=view` resolves saved
view metadata with `useView(viewId)` and canonical visible membership with
`useViewTransactions(viewId)`, so pinned transactions are included and excluded
transactions are omitted. `useAnalyticsData` receives the already resolved
transaction list and remains unaware of how the source was fetched.

## Redux Preferences

Use Redux only for global user/layout preferences that need cross-tree access or
localStorage persistence:

- `theme`
- `displayCurrency`
- `adminSidebarOpen`

The desktop admin sidebar preference is persisted because it is layout chrome.
The mobile admin sidebar overlay is local state in `AdminLayout` because no
other component needs to open or close it.

## Local Component State

Use local state for mechanics that matter only while the current component is
mounted:

- Transaction table sorting and pagination.
- Row selection and bulk-action dialog state.
- Draft search and amount input values before they are committed to the URL.
- Modal form fields.

For table filters, keep a distinction between draft input state and committed
route state. For example, the transaction search box keeps typed text locally
until Enter commits it to `q`.

## Navigation State

Do not store route history in Redux. Detail-page back navigation uses explicit
`returnTo` URL context when present, otherwise browser history when the route was
reached through in-app navigation.

## Decision Rules

Choose React Query when data comes from an API.

Choose URL params when users should be able to refresh, bookmark, share, or
return to the exact view.

Choose Redux when the value is a true global preference or layout setting.

Choose local state when the value is transient, component-specific, or table
mechanics.
