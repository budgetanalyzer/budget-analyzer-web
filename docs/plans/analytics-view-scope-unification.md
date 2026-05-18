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
- `ViewsPage` aggregate stats use `filterTransactionsByCriteria`, which ignores
  pinned and excluded view membership.
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

## Phase 3: Canonicalize Views Aggregate Stats

Files likely affected:

- `src/features/views/pages/ViewsPage.tsx`
- `src/features/views/components/AggregateViewStats.tsx`
- `src/features/views/hooks/useAggregateViewStats.ts`
- `src/features/views/components/SelectableViewCard.tsx`
- `src/hooks/useViews.ts`

Tasks:

1. Replace criteria-only aggregate stat calculation with canonical membership
   where feasible.
2. Decide whether the Views list overview should fetch every selected view's
   membership:
   - For current scale, `useQueries` for selected views is acceptable.
   - If view count becomes large, defer exact aggregate stats behind an explicit
     "Calculate" action or backend aggregate endpoint.
3. Preserve deduplication when multiple selected views contain the same
   transaction.
4. Ensure pinned transactions are included and excluded transactions are not
   included.
5. Update individual view card summary calculations if they currently present
   criteria-only totals that can diverge from view detail.
6. Consider a loading skeleton or compact loading state for aggregate stats when
   memberships are being resolved.

Acceptance criteria:

- Aggregate stats on the Views page reconcile with individual View Detail
  transaction membership.
- Selected-view deduplication still works.
- No stats surface presents criteria-only totals as canonical view totals.
- Tests cover pinned/excluded cases.

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
- `src/features/views/components/SelectableViewCard.tsx`
- `src/features/views/pages/ViewsPage.tsx`
- `src/features/analytics/utils/urlState.ts`

Tasks:

1. Add "Analyze View" action on View Detail.
2. Optionally add a compact analyze action on each view card, separate from
   selection and "View Details".
3. Build links with the analytics URL builder so scope is always explicit:
   `scope=view&viewId=<id>`.
4. Preserve the current analytics defaults:
   - monthly
   - debit
   - latest year with transactions
5. Avoid making view card selection imply analytics source.

Acceptance criteria:

- From a view detail page, one click opens Analytics scoped to that view.
- View card selection remains aggregate-overview state only.
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
   - canonical view aggregate stats
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
5. Phase 3: Canonical view aggregate stats.
6. Phase 6: final documentation, full tests, and build.

This order keeps each pull of behavior verifiable: first URLs, then view landing
behavior, then analytics source selection, then entry points, then stats
reconciliation.

## Risks And Decisions To Confirm

- Fetching canonical membership for many selected views on `ViewsPage` may be
  noisy if users have many views. Start with selected views only and reassess if
  latency becomes visible.
- `ViewTransactionTable` currently owns local pagination, sorting, and search
  input state. Adding URL-backed date filters should not globalize this state.
- Analytics cards should not contain route branching directly. Keep destination
  branching in `buildAnalyticsDrilldownUrl`.
- View-scoped analytics should likely show view metadata near the source
  selector so users can tell pinned/excluded membership is being honored.
