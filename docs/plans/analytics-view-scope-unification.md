# Analytics View Scope Unification Plan

## Goal

Implement the long-term UX model where Transactions, Views, and Analytics remain
separate task pages, but Analytics can explicitly analyze either all
transactions or a single saved view.

The core product behavior:

- Transactions page remains the all-transaction management surface.
- View detail page remains the saved-view membership management surface.
- Analytics page remains the analysis surface.
- Analytics source is explicit and URL-backed, not persisted in Redux or
  localStorage.
- View-scoped analytics uses canonical view membership from `useViewTransactions`,
  not criteria-only local filtering.
- Analytics drilldowns route to the correct operational page for the active
  source.

## Current State

- `AnalyticsPage` calls `useTransactions()` and analyzes the full transaction
  list only.
- `MonthlySpendingCard` and `YearlySpendingCard` build drilldown links through
  `buildTransactionsUrl`, so every analytics drilldown goes to the all
  transactions page.
- `ViewsPage` is a saved-view directory only. The previous aggregate
  selected-view stats surface was removed instead of canonicalized because it
  added complexity that does not belong in the analytics scope-unification work.
- `ViewPage` and `ViewTransactionTable` use canonical membership through
  `useViewTransactions`, but the table only supports text search and does not
  have URL-backed date filters.
- `ViewSelector` is navigation. It should stay navigation and should not become
  the global analytics source selector.

## Non-Goals

- Do not merge Transactions and View Detail into a single shared page.
- Do not make one table component with mode-dependent delete/pin/exclude action
  branches.
- Do not make "All transactions" a pseudo saved view in the Views dropdown.
- Do not use selected view IDs from Redux/localStorage as analytics context.
- Do not implement multi-view analytics in this pass.
- Do not preserve or replace the Views page aggregate selected-view stats
  surface.

## URL Contract

Use explicit analytics scope parameters:

```text
/analytics?scope=all&viewMode=monthly&transactionType=debit&year=2026
/analytics?scope=view&viewId=<view-id>&viewMode=monthly&transactionType=debit&year=2026
```

Defaults:

- Missing `scope` means `all`.
- `scope=view` without a valid `viewId` falls back to `all` or shows a scoped
  error state. Prefer fallback only for malformed URLs and a visible API error
  for missing/deleted views.
- Existing `viewMode`, `transactionType`, and `year` behavior remains intact.

View drilldown URLs:

```text
/views/<view-id>?dateFrom=2026-01-01&dateTo=2026-01-31&returnTo=<encoded>&breadcrumbLabel=Jan%202026
```

All-transaction drilldown URLs:

```text
/?dateFrom=2026-01-01&dateTo=2026-01-31&returnTo=<encoded>&breadcrumbLabel=Jan%202026
```

## Phase 1: Shared URL State And Drilldown Builder

Files likely affected:

- `src/features/analytics/utils/urlState.ts`
- `src/utils/navigation.ts`
- `src/features/analytics/components/MonthlySpendingCard.tsx`
- `src/features/analytics/components/YearlySpendingCard.tsx`
- analytics URL-state tests, if present or newly added

Tasks:

1. Extend analytics URL state with:
   - `scope`
   - `viewId`
   - `AnalyticsScope = 'all' | 'view'`
   - parsing helpers for analytics URL state
   - `buildAnalyticsReturnUrl(...)` support for scope/viewId
2. Add `buildAnalyticsDrilldownUrl(...)` to `src/utils/navigation.ts` or a
   nearby shared navigation module.
3. Make `buildAnalyticsDrilldownUrl` accept:
   - active analytics scope
   - optional `viewId`
   - `dateFrom`
   - `dateTo`
   - `returnTo`
   - `breadcrumbLabel`
4. Route drilldowns based on source:
   - `all` -> `/`
   - `view` -> `/views/:viewId`
5. Update monthly and yearly analytics cards to use
   `buildAnalyticsDrilldownUrl` instead of `buildTransactionsUrl`.

Acceptance criteria:

- Existing all-transaction analytics URLs keep working.
- New scoped analytics return URLs preserve `scope=view&viewId=...`.
- Month/year card links route to `/views/:id` when source is a view.
- Month/year card links route to `/` when source is all transactions.
- Unit tests cover URL builder output for both scopes.

## Phase 2: Analytics Source Resolution

Files likely affected:

- `src/features/analytics/pages/AnalyticsPage.tsx`
- `src/features/analytics/hooks/useAnalyticsData.ts`
- `src/hooks/useViews.ts`
- `src/features/analytics/components/*`
- new `AnalyticsSourceSelector` component

Tasks:

1. Add an Analytics source selector:
   - "All transactions"
   - saved view options from `useViews()`
2. Keep the selector visible near existing analytics controls so the current
   data source is never hidden.
3. In `AnalyticsPage`, resolve transactions by scope:
   - `all`: use `useTransactions()`
   - `view`: use `useView(viewId)` and `useViewTransactions(viewId)`
4. Pass the resolved transaction list into `useAnalyticsData`.
5. Preserve existing exchange-rate behavior.
6. Keep analytics calculation pure: `useAnalyticsData` should not know how the
   source was fetched.
7. Handle loading and error states:
   - all-scope transaction loading/error
   - view metadata loading/error
   - view transaction loading/error
   - empty view transaction data
8. Update `PageHeader` description to reflect source, for example:
   - `Monthly spending breakdown for 2026`
   - `Monthly spending breakdown for 2026 in Groceries`

Acceptance criteria:

- Selecting a saved view updates the URL with `scope=view&viewId=...`.
- Selecting all transactions updates/removes view-specific URL params.
- Refreshing a scoped analytics URL restores the selected source.
- View-scoped analytics totals match the canonical view transaction list,
  including pinned and excluded membership behavior.
- No Redux/localStorage state controls analytics source.
- Tests cover all-scope and view-scope data selection.

## Phase 3: Remove Views Aggregate Stats

Status: Implemented.

Files likely affected:

- `src/features/views/pages/ViewsPage.tsx`
- `src/features/views/components/AggregateViewStats.tsx`
- `src/features/views/hooks/useAggregateViewStats.ts`
- `src/features/views/components/SelectableViewCard.tsx`
- `src/hooks/useViews.ts`
- `src/features/views/index.ts`
- view stats tests, if present

Tasks:

1. Remove the aggregate stats UI from the Views list page.
2. Remove the selected-view aggregate state and selection handlers from
   `ViewsPage`.
3. Delete `AggregateViewStats.tsx` and `useAggregateViewStats.ts`.
4. Simplify or replace `SelectableViewCard` so view cards are navigation and
   management entry points only, not aggregate-stat selectors.
5. Remove criteria-only aggregate calculations, deduplication code, monthly
   average helpers, and any query dependencies used only by the aggregate stats
   feature.
6. Remove exports, imports, tests, fixtures, and mocks that exist only for
   aggregate view stats.
7. Keep the Views list focused on listing saved views and linking to View
   Detail / Analytics entry points.

Acceptance criteria:

- No aggregate selected-view stats UI remains on the Views page.
- No aggregate stats hook, component, or view-selection state remains in the
  views feature.
- No code path computes criteria-only selected-view totals or monthly averages.
- Existing view list, view detail, and view-to-analytics flows continue to work.
- Tests no longer assert aggregate stats behavior and cover the remaining view
  list interactions where needed.

## Phase 3b: Minimize Redux UI State

Files likely affected:

- `src/store/uiSlice.ts`
- `src/features/transactions/pages/TransactionsPage.tsx`
- `src/features/transactions/components/TransactionTable.tsx`
- `src/features/transactions/hooks/useTransactionFiltersSync.ts`
- `src/components/CreateViewModal.tsx`
- `src/components/Layout.tsx`
- `src/components/BackButton.tsx`
- `src/features/admin/components/AdminLayout.tsx`
- transaction table, transactions page, layout, and store tests
- `docs/state-architecture.md`
- `docs/architecture.md`

Target Redux shape:

```ts
{
  theme,
  displayCurrency,
  adminSidebarOpen,
}
```

`adminSidebarMobileOpen` may remain only if there is a concrete cross-component
control need; otherwise move it into `AdminLayout` local state.

Tasks:

1. Remove unused transaction selection state:
   - `selectedTransactionId`
   - `setSelectedTransactionId`
2. Remove navigation-history state from Redux:
   - `hasNavigated`
   - `setHasNavigated`
3. Replace `hasNavigated` with a route-local or layout-local mechanism for
   `BackButton`, or simplify `BackButton` to use URL `returnTo` / browser
   history behavior where available.
4. Remove `transactionTable` from Redux.
5. Make URL parameters the source of truth for shareable transaction filters:
   - `q`
   - `dateFrom`
   - `dateTo`
   - `bankName`
   - `accountId`
   - `type`
   - `minAmount`
   - `maxAmount`
6. Keep table-only state local to `TransactionTable`:
   - sorting
   - pagination
   - transient search input text before it is committed to the URL
7. Delete `useTransactionFiltersSync` if its only remaining purpose is mirroring
   URL parameters into Redux.
8. Update `CreateViewModal` so clearing filters updates the URL/source state
   directly instead of dispatching Redux table-filter actions.
9. Move `adminSidebarMobileOpen` into `AdminLayout` local state unless another
   component needs to open/close it.
10. Keep Redux for true global preferences only:
    - `theme`
    - `displayCurrency`
    - persisted desktop `adminSidebarOpen`
11. Remove dead actions, selectors, tests, and imports after the state shape is
    reduced.
12. Update state architecture docs to describe:
    - React Query for server state
    - URL params for shareable route state
    - local component state for table mechanics
    - Redux only for global user/layout preferences

Acceptance criteria:

- Redux no longer stores transaction table filters, sorting, pagination, route
  history, or selected transaction IDs.
- Transaction filter URLs remain refreshable and shareable.
- Clearing transaction filters still clears the URL-backed filters.
- Transaction table sorting and pagination still work within the active page
  session.
- `BackButton` behavior is preserved or deliberately simplified and covered by
  tests.
- `adminSidebarOpen` remains persisted for desktop admin layout.
- No new Redux state is introduced for analytics source or view selection.
- State architecture documentation reflects the minimized Redux scope.

## Phase 4: URL-Backed Date Filtering On View Detail

Implemented in the view-detail table. The remaining analytics work can assume
`/views/:id` supports `dateFrom`, `dateTo`, and `q`, applies date filtering
before local description search, shows the shared `DateRangeFilter`, clears
analytics breadcrumb params when filters are cleared, and preserves the current
filtered view URL when drilling into transaction detail.

Remaining tasks:

1. Wire analytics view-scope drilldowns to `/views/:id` with the existing
   `dateFrom` and `dateTo` parameters.
2. Add analytics-level tests that verify scoped drilldowns land on the filtered
   view detail page.

## Phase 5: View-To-Analytics Entry Points

Files likely affected:

- `src/features/views/pages/ViewPage.tsx`
- `src/features/views/components/ViewCard.tsx`
- `src/features/views/pages/ViewsPage.tsx`
- `src/features/analytics/utils/urlState.ts`

Tasks:

1. Add "Analyze View" action on View Detail.
2. Optionally add a compact analyze action on each view card, separate from
   "View Details".
3. Build links with the analytics URL builder so scope is always explicit:
   `scope=view&viewId=<id>`.
4. Preserve the current analytics defaults:
   - monthly
   - debit
   - latest year with transactions
5. Do not add persistent view-card selection state as analytics source.

Acceptance criteria:

- From a view detail page, one click opens Analytics scoped to that view.
- The Views list remains a directory; choosing an analytics source is explicit
  through the analyze link or Analytics source selector.
- Analyze links are normal links, not hidden persistent context.

## Phase 6: Tests, Docs, And Regression Checks

Files likely affected:

- `src/features/analytics/**/__tests__`
- `src/features/views/**/__tests__`
- `src/utils/**/__tests__`
- `docs/architecture.md` or `docs/state-architecture.md`
- `docs/authentication.md` only if permission behavior changes, which is not
  expected

Tasks:

1. Add or update unit tests for:
   - analytics URL parsing/building
   - `buildAnalyticsDrilldownUrl`
   - analytics source selector behavior
   - view-scoped analytics data resolution
   - view detail date URL sync
   - removal of aggregate view stats UI and selected-view state
   - minimized Redux state shape
2. Add integration-style component tests for:
   - analytics month click in all scope
   - analytics month click in view scope
   - `/views/:id` date-filtered landing from analytics
3. Run:
   - `npm run lint:fix`
   - targeted Vitest files
   - `npm run build`
4. If UI dependency or styling changes are added, run the CSP smoke check:
   - `npm run build:prod-smoke`
   - `rg -n "createElement\\('style'\\)|styleSheet\\.cssText|eval\\(" dist/`
5. Update persistent docs after implementation:
   - state/URL contract in `docs/state-architecture.md`
   - page responsibility and route behavior in `docs/architecture.md`

Acceptance criteria:

- Tests pass.
- Build passes.
- Documentation describes the explicit analytics scope URL contract.
- No new inline styles or runtime style injection are introduced.

## Implementation Order

Recommended order:

1. Phase 1: URL contract and drilldown builder.
2. Phase 4: View detail date filtering, because drilldowns need a target that
   can display the date range.
3. Phase 2: Analytics source selector and `useViewTransactions` source
   resolution.
4. Phase 5: View-to-analytics links.
5. Phase 3: remove aggregate view stats UI/code.
6. Phase 3b: minimize Redux UI state.
7. Phase 6: final documentation, full tests, and build.

This order keeps each pull of behavior verifiable: first URLs, then view landing
behavior, then analytics source selection, then entry points, then removal of
the obsolete stats surface, then state cleanup once the URL-backed behavior is
settled.

## Risks And Decisions To Confirm

- Removing aggregate stats means the Views page no longer tries to summarize
  selected-view transaction totals. Use Analytics scoped to a single view for
  transaction analysis instead of reintroducing a parallel stats surface.
- Removing `transactionTable` from Redux must not break the transaction URL
  contract. Treat URL params as canonical for filters and local state as
  canonical only for non-shareable table mechanics.
- `ViewTransactionTable` currently owns local pagination, sorting, and search
  input state. Adding URL-backed date filters should not globalize this state.
- Analytics cards should not contain route branching directly. Keep destination
  branching in `buildAnalyticsDrilldownUrl`.
- View-scoped analytics should likely show view metadata near the source
  selector so users can tell pinned/excluded membership is being honored.
