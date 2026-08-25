# Static Saved Views and Consistent Amount Semantics

Replace the dynamic saved-view client with the static membership API in the generated unified
specification and establish one explicit amount contract for ordinary user surfaces. Current-user
pages will continue to operate over the complete active transaction snapshot, convert each
transaction magnitude to the selected display currency for its LocalDate, quantize before any
comparison or aggregation, and expose unavailable conversions instead of relabeling native values.
The separate administrative search will remain server-paged and will make its stored numeric,
non-FX-normalized amount semantics visible. The phases below deliberately separate shared amount
infrastructure, the breaking saved-view cutover, membership workflows, administrative behavior,
documentation, and final integration gates.

## Phase 1: Establish the Display-Amount and Rate-Loading Contracts

### Workspace

.

### Goal

Create a single shared, pure display-amount model and make the exchange-rate input accurately
represent the generated API before changing product behavior.

### Scope

Add the missing exchange-rate publication date, exact-date conversion and quantization helpers, a
discriminated available/unavailable result, per-leg rate provenance, and transaction-bounded rate
queries with aggregate loading and error state.

### Non-goals

Changing filters, table sorting, statistics, analytics, saved views, administrative search,
transaction write validation, Currency Service endpoints, or adding a decimal dependency.

### Required context

Read `AGENTS.md`, `docs/api-integration.md`, `docs/state-architecture.md`,
`docs/testing-guide.md`, and `docs/react-hooks-lifecycle-mental-model.md`. Inspect
`ExchangeRateResponse` and `GET /v1/exchange-rates` in
`docs/api/budget-analyzer-api.yaml`, then inspect `src/types/currency.ts`,
`src/api/currencyApi.ts`, `src/hooks/useCurrencies.ts`, `src/utils/currency.ts`, and their tests.

### Execution steps

1. Add the required `publishedDate` LocalDate to `ExchangeRateResponse`. Keep `date` as the
   effective requested day and `publishedDate` as provenance for the prior published observation;
   a weekend or holiday row is not a browser fallback and must not be described as one.
2. Introduce a shared `DisplayAmount` discriminated union and pure projection helper under the
   top-level shared `src/types/` and `src/utils/` boundaries. An available result must contain the
   positive source magnitude, selected ISO currency, minor-unit count, once-quantized numeric
   value, and zero, one, or two exact rate legs. An unavailable result must retain the source and
   target currencies and a stable reason such as a missing/invalid source leg, missing/invalid
   target leg, or unsupported currency precision.
3. Derive ISO minor units through the runtime currency formatter contract, cover zero- and
   three-decimal currencies, and quantize each converted transaction once before it is exposed to
   consumers. Normalize the stored amount with `Math.abs` only at this ordinary-user display
   boundary; `TransactionType` remains the sole credit/debit direction. Do not change transaction
   request payloads or imply that persistence enforces nonnegative values.
4. Convert USD-to-target, source-to-USD, and non-USD triangulation only from entries keyed by the
   transaction LocalDate. Same-currency magnitudes are available without rates. Reject absent,
   non-finite, nonpositive, mismatched-base, or mismatched-target legs; never search another date
   and never return the source number labeled as the target currency.
5. Refactor `useExchangeRatesMap` to derive inclusive `startDate` and `endDate` from the earliest
   and latest LocalDates in the complete `['transactions']` snapshot, request only non-USD source
   currencies plus a non-USD display currency that are actually needed, and expose pending and
   failed currencies without discarding successful series. Do not issue history queries for an
   empty snapshot. Keep the date range and currency in each TanStack Query key.
6. Add focused API, hook, and pure utility tests for publication provenance, all conversion legs,
   exact-date lookup, same-currency operation without rates, invalid rate data, missing legs,
   magnitude normalization, ISO precision, quantization boundaries, bounded request parameters,
   partial query failure, and an empty snapshot.

### Implementation notes

The displayed value, not an unrounded intermediate, is the future authority for filters, sorting,
and totals. Sum per-transaction quantized values rather than quantizing only the aggregate. Rate
provenance must support two legs because a non-USD to non-USD conversion cannot be honestly
represented by one FRED rate. Keep rate query failures distinct from an empty successful series so
pages can offer retry while still rendering same-currency and otherwise available amounts.

### Validation

Format only changed files with the repository Prettier configuration, run
`npx vitest run src/api/__tests__/currencyApi.test.ts src/hooks/__tests__/useCurrencies.test.tsx src/utils/__tests__/currency.test.ts`,
run any new display-amount test file explicitly, and run `npm run lint:fix`.

### Completion criteria

The frontend has one tested exact-date, quantized display-amount primitive; `publishedDate` is
preserved; rate requests use the actual complete-snapshot date range; and no new helper can silently
substitute a native or differently dated numeric value.

## Phase 2: Make the Transaction List Use One Selected-Currency Amount

### Workspace

.

### Goal

Make the main Transactions page display, filter, sort, and aggregate the same selected-currency
value, including explicit loading and unavailable-conversion behavior.

### Scope

Update the transaction filter URL contract, currency selection coordination, page-level amount
projection, table cells and sorting, amount range filtering, statistics, save readiness, and
related user feedback.

### Non-goals

Saved-view API migration, view-detail and analytics migration, backend filtering, server
aggregates, current-user pagination, virtualization, or performance benchmark gates.

### Required context

Use the completed Phase 1 contract. Read the state and hooks owner docs, then inspect
`TransactionsPage`, `TransactionTable`, `TransactionAmountBadge`, `TransactionFilterBar`,
`CurrencySelector`, `useTransactionFiltersSync`, `transactionFilters`, `useTransactionStats`,
`statsConfig`, and their tests.

### Execution steps

1. Build one memoized transaction-ID-to-`DisplayAmount` projection in `TransactionsPage` from the
   canonical transaction array, selected display currency, and rate map. Pass that projection or
   derived rows to the filter, table, statistics, amount badge, delete dialog, and save workflow;
   do not let child components reconvert the same collection.
2. Extend `TransactionFilterValues` and `useTransactionFiltersSync` with `amountCurrency`. Whenever
   either amount bound is committed, serialize the active display currency with it; remove
   `amountCurrency` when both bounds are absent or all filters are cleared. Accept a legacy URL
   with bounds but no currency by binding it to the current selected currency for that visit, and
   canonicalize it on the next amount edit.
3. On a valid deep link whose amount bounds carry a different enabled `amountCurrency`, synchronize
   the persisted display preference to that currency before applying the bounds. While that
   synchronization or required rate queries are pending, show an amount-dependent loading state
   rather than a transient wrong result. If the URL currency is malformed or disabled, do not
   apply its amount bounds and present a recoverable notice.
4. Make a user-driven `CurrencySelector` change synchronously clear `minAmount`, `maxAmount`, and
   `amountCurrency` on Transactions and saved-view detail routes before dispatching the new Redux
   preference, then show a concise informational toast. This is event-driven work; do not add an
   effect that watches the preference and repeatedly rewrites the URL.
5. Apply amount bounds to available, quantized display magnitudes after all non-amount filters.
   Once rate loading settles, exclude unavailable conversions only when an amount range is active
   and show how many otherwise-matching rows were excluded. Without an amount range, retain those
   rows and render their native amount with a clear “conversion unavailable” state.
6. Replace `amountInUsd` table rows with selected-currency sort data. Sort by the exact quantized
   displayed value, keep unavailable values last in both directions, and use transaction LocalDate
   then ID as deterministic tie-breakers. Keep TanStack Table client pagination as presentation
   only and keep selection based on the complete filtered row set rather than the current page.
7. Refactor transaction totals and monthly averages to consume the shared projection. Counts and
   date ranges include every visible transaction; monetary values omit unavailable conversions and
   expose an unavailable count. Mark a mixed result as partial, and render an all-unavailable
   monetary result as unavailable rather than a misleading zero.
8. Add focused tests for URL parsing/serialization, deep-link initialization, currency-change
   clearing, loading, quantization-edge filtering, unavailable exclusion, native disclosure,
   selected-currency reordering, deterministic equal values, unavailable-last sorting, partial and
   all-unavailable totals, presentation pagination, and save disabled while an active amount range
   is unresolved.

### Implementation notes

`displayCurrency` remains the cross-tree persisted preference; `amountCurrency` records the unit in
which URL-owned bounds were authored. The synchronization between them exists only to make a deep
link semantically complete. Do not store projections or filtered rows in Redux, TanStack Query, or
an effect. A display-currency switch can legitimately reorder transactions because the target-rate
factor varies by transaction date.

### Validation

Format changed files and run the focused filter, URL hook, currency selector, stats, amount badge,
table, and page tests with `npx vitest run`. Include
`src/utils/__tests__/transactionFilters.test.ts`,
`src/hooks/__tests__/useTransactionFiltersSync.test.tsx`,
`src/components/__tests__/CurrencySelector.test.tsx`,
`src/features/transactions/components/__tests__/TransactionTable.test.tsx`, and
`src/features/transactions/pages/__tests__/TransactionsPage.test.tsx`. Run `npm run lint:fix`.

### Completion criteria

Every amount-dependent decision on the main page uses one quantized selected-currency projection,
URL bounds retain their currency meaning, unavailable values are never silently numeric, and
focused workflow tests pass.

## Phase 3: Prepare the Static Saved-View Transport and Cache Foundation

### Workspace

.

### Goal

Implement and test the new saved-view transport, cache, and reconciliation contracts before the
larger UI cutover.

### Scope

Add static metadata and membership types, `PATCH` rename and membership-delta adapters, shared query
keys, stale-membership error copy, and pure ordered intersection with the complete transaction
snapshot. Keep the currently wired legacy view UI buildable during this checkpoint, then remove
all temporary migration-only exports in Phase 4.

### Non-goals

Changing visible view pages or controls, adding/removing membership from the UI, retaining runtime
compatibility with both backend contracts after Phase 4, fetching individual missing members, or
copying view data into Redux.

### Required context

Read the saved-view paths and `CreateSavedViewRequest`, `SavedViewResponse`,
`UpdateSavedViewRequest`, `UpdateSavedViewTransactionsRequest`, and `ViewMembershipResponse` in the
generated specification. Inspect `src/types/view.ts`, `src/api/viewApi.ts`,
`src/hooks/useViews.ts`, `src/hooks/useTransactions.ts`,
`src/utils/reconcileViewTransactions.ts`, `src/utils/errorMessages.ts`, default MSW handlers, and
their tests.

### Execution steps

1. Extract transaction and view query-key factories from hook modules into a neutral top-level
   shared module so the final `useViewTransactions` can call `useTransactions` without creating the
   current `useTransactions` -> `useViews` -> `useTransactions` module cycle. Replace literal
   `['transactions']`, `['transaction', id]`, and view-family invalidations in touched hooks and
   tests with the factories.
2. Model static saved-view metadata as exactly `id`, `name`, `transactionCount`, `createdAt`, and
   `updatedAt`; create requests as required `{name, transactionIds}`; rename requests as required
   `{name}`; membership as `{transactionIds}`; and deltas as required
   `{addTransactionIds, removeTransactionIds}`. Do not model a response body for a successful 204
   delta. Enforce positive IDs, disjoint delta sets, and at least one nonempty set before transport.
3. Add adapter coverage for `POST /v1/views`, `PATCH /v1/views/{id}`,
   `GET /v1/views/{id}/transactions`, and `PATCH /v1/views/{id}/transactions`, including an empty
   creation membership and the exact two-array delta body. Retain top-level array validation for
   the list endpoint. Mark the old `PUT`, pin, unpin, exclude, unexclude, and bulk endpoint methods
   for deletion at cutover rather than adding fallback calls.
4. Add a pure reconciliation function that builds one ID map from the complete active transaction
   array and emits transactions in the membership response's deterministic ID order. Missing IDs
   are skipped as independently fetched cache skew and may be reported diagnostically, but they
   must never start `GET /v1/transactions/{id}` fan-out requests.
5. Add `SAVED_VIEW_MEMBERSHIP_STALE` to `src/utils/errorMessages.ts` with copy that tells the user
   the transaction snapshot changed and must be refreshed. Define mutation invalidation rules:
   rename refreshes list/detail; successful membership delta refreshes list/detail/membership;
   stale creation or addition also refreshes the complete transaction snapshot and relevant view
   resources without automatically retrying or dropping IDs.
6. Add focused API, reconciliation, query-key, and error-message tests. If temporary names are
   needed to keep the pre-cutover UI compiling, isolate them in the view modules, label them as
   phase-local migration scaffolding, and make their Phase 4 deletion an explicit test/search
   target.

### Implementation notes

The membership response and complete transaction array remain separate TanStack Query resources;
transaction objects are derived during render. Preserve backend membership order. Do not interpret
a missing active transaction as authority to fetch it individually or silently mutate persisted
membership. The API is breaking and the final code must contain one contract, not content-based
response sniffing or old-endpoint fallbacks.

### Validation

Format changed files; run
`npx vitest run src/api/__tests__/viewApi.test.ts src/hooks/__tests__/useViews.test.tsx src/utils/__tests__/reconcileViewTransactions.test.ts src/utils/__tests__/errorMessages.test.ts`
plus any new query-key tests; and run `npm run lint:fix`. Run the repository TypeScript compiler if
the phase changes exported hook signatures rather than using isolated migration scaffolding.

### Completion criteria

The new static requests and responses are tested, query keys have no hook-module cycle, ordered
membership intersection performs zero per-ID fetches, stale membership has stable user copy, and
the worktree remains ready for a single-contract UI cutover.

## Phase 4: Cut the Saved-View UI Over to Static Collections

### Workspace

.

### Goal

Replace dynamic criteria-based saved views with a coherent static collection experience across
creation, catalogue, detail, rename, delete, permissions, and read-only membership display.

### Scope

Wire the Phase 3 contract into production hooks and UI, save exact visible IDs, simplify view
metadata presentation, derive member transactions from the complete snapshot, remove dynamic
membership concepts, and apply view permissions. Membership editing is deferred to Phases 5 and 6.

### Non-goals

Add-to-view mode, transfer/refund-assisted removal, restoring membership history, ordering
controls, source-view lineage, server-side filtering, or backward-compatible old responses.

### Required context

Use Phases 1–3. Read the authentication owner doc and inspect route composition, `Layout`,
`ViewSelector`, `TransactionsPage`, `SaveAsViewButton`, `CreateViewModal`, `ViewsPage`, `ViewCard`,
`ViewPage`, `ViewTransactionTable`, `ViewSettingsMenu`, `EditViewModal`, `DeleteViewModal`, the
view hooks, test auth fixtures, MSW handlers, and all colocated tests.

### Execution steps

1. Make the final `useViews`, `useView`, `useViewMembership`, and `useViewTransactions` use only the
   static adapters. Compose membership with `useTransactions`, explicitly combine loading/error/
   refetch state without an unsafe `UseQueryResult` cast, preserve response order, and delete the
   excluded-transaction hook and all missing-member `useQueries` fan-out.
2. Change `SaveAsViewButton` and `CreateViewModal` to receive the exact currently visible ID array
   and its readiness state, submit only `{name, transactionIds}`, permit an empty collection, use
   the schema's 255-character name maximum, and keep the modal open on failure. On stale membership,
   refresh the transaction snapshot, retain the user's name, and explain that the visible set
   changed; do not retry with a reduced array. Clear transaction filters only after success.
3. On `TransactionsPage`, derive creation IDs after every active filter, including settled
   selected-currency amount filtering. On `ViewPage`, add a Save as/Clone action that submits the
   current visible filtered member IDs and no source-view identifier. Disable these actions while
   an active amount filter is unresolved; once settled, the existing unavailable-row notice makes
   any excluded conversions explicit.
4. Reduce cards, headings, settings, edit, and delete confirmation to static metadata and
   transaction count. Rename via `PATCH` with name only. Remove criteria summaries, open-ended
   controls/badges, pinned and excluded counts, restore controls, pin markers, and all claims that
   future matching transactions automatically enter a view. Make the initial static detail table
   read-only except for transaction navigation and local filters.
5. Gate `/views` and `/views/:id` plus query-owning navigation/selectors with `views:read`; gate
   creation/clone/rename with `views:write`; and gate delete independently with `views:delete`.
   Denied subtrees must not mount their hooks. Update default authenticated test fixtures so tests
   that exercise view actions receive the exact required permissions rather than relying on roles.
6. Replace default MSW payloads and page/component/hook tests with static metadata and membership.
   Cover empty views, empty creation, exact filtered IDs, clone independence, ordered intersection,
   stale IDs, permission denial, loading/error states, rename, delete, and zero individual
   transaction requests. Delete Phase 3 scaffolding and all now-dead criteria/open-ended/pin/
   exclusion types, adapters, components, exports, mocks, and tests.

### Implementation notes

Static membership is unordered for creation and delta semantics even though reads are
deterministically ordered. Do not persist sort order or filter definitions. Transaction edits do
not alter membership; transaction soft delete removes the row from the complete active snapshot
and the backend owns membership cleanup. Keep local filters in the URL and table sorting,
pagination, and selection local as documented.

### Validation

Format changed files; run focused tests for `viewApi`, `useViews`, `CreateViewModal`,
`SaveAsViewButton`, `ViewSelector`, `ViewsPage`, `ViewPage`, `ViewCard`, `ViewSettingsMenu`,
`ViewTransactionTable`, route permissions, and changed MSW behavior; then run `npm run lint:fix`.
Run:

```bash
rg -n 'ViewCriteria|openEnded|pinned|excluded|pinTransaction|unpinTransaction|excludeTransaction|unexcludeTransaction|BulkViewTransaction' src --glob '*.{ts,tsx}'
```

Review every result and remove all production legacy-contract matches.

### Completion criteria

The production UI consumes only static view metadata and `{transactionIds}`, exact visible sets can
be saved or cloned, view permissions gate the correct subtrees and actions, the detail page performs
no per-ID fetches, and no dynamic view concept remains.

## Phase 5: Implement Atomic Removal and Reframe Transfer/Refund Review

### Workspace

.

### Goal

Restore saved-view curation with atomic member removal and adapt transfer/refund assistance to the
single static membership set.

### Scope

Add row and bulk “Remove from view” behavior, membership-delta cache handling, and a static-view
transfer/refund review that can use nonmember transactions only as evidence.

### Non-goals

Adding transactions, restoring removed members from history, recording relationship provenance,
partial success, deleting transactions, changing candidate tolerances, or introducing membership
ordering.

### Required context

Use the Phase 4 static detail page. Inspect `ViewTransactionTable`, the former bulk view controls,
`TransferRefundReviewDialog`, `findTransferRefundCandidates`, permissions, display-amount helpers,
and their tests.

### Execution steps

1. Add a `useUpdateViewTransactions` mutation that always sends both required arrays. Provide a
   remove operation as `{addTransactionIds: [], removeTransactionIds: uniquePositiveIds}` and, on
   204, invalidate metadata, list, and membership together. Treat unknown removals as idempotent
   success and do not invent an updated count from a nonexistent response body.
2. Add `views:write`-gated row and bulk “Remove from view” actions to the static view table. Keep
   selection independent from `transactions:delete`, support all filtered members rather than only
   the visible page, confirm the exact count, clear selection only on success, and leave transaction
   deletion as a separately permissioned action outside this membership workflow.
3. Refactor transfer/refund candidate inputs from `ViewTransaction` plus explicit exclusions to
   ordinary transactions plus the current member-ID set. Preserve the existing same-account,
   cross-account, date-window, description, tolerance, and one-to-one matching rules. Use the exact
   dated display-amount machinery with USD as the comparison unit for cross-currency pairs; omit a
   candidate whose required conversion is unavailable.
4. Remove “complete previous exclusions” and every inference that a nonmember was previously
   excluded. A transaction outside current membership may support a candidate but cannot be
   selected. Only current member IDs are eligible for the atomic remove delta, and copy throughout
   the review must say “remove from this view.”
5. Replace the former pin/exclude/restore bulk components with narrowly named removal components,
   delete the restore modal, and update table, mutation, candidate, and dialog tests for permissions,
   filtered select-all, idempotent removal, 204 handling, outside evidence, unavailable FX,
   cancellation, failure retention, and success invalidation.

### Implementation notes

The server stores only membership; it receives no transfer/refund candidate data. The browser must
not classify an outside transaction as removed history because the new API exposes no such
provenance. Reuse the shared amount primitive for rate validity and exact dates, but keep the
candidate comparison unit and tolerance rules independent from the user's selected display
currency.

### Validation

Format changed files; run focused `useViews`, view table, removal modal/bar,
`findTransferRefundCandidates`, `TransferRefundReviewDialog`, and `ViewPage` tests; run
`npm run lint:fix`; and repeat the Phase 4 legacy-term search.

### Completion criteria

Users with `views:write` can remove one or many current members atomically, transaction deletion
permissions remain independent, transfer/refund assistance removes only current members, and no UI
pretends removed-member history exists.

## Phase 6: Add Transactions to Existing Static Views

### Workspace

.

### Goal

Complete static collection curation with a discoverable, permission-safe add workflow that reuses
the complete transaction snapshot and main transaction filters.

### Scope

Add URL-owned add mode from a view to the Transactions page, decouple selection intent from delete
permission, prevent selecting existing members, submit one atomic add delta, and return to the
source view.

### Non-goals

Building a second transaction picker, server-side search, transaction transport pagination,
adding deleted transactions, adding the same row twice, membership ordering, partial success, or a
general multi-view assignment menu.

### Required context

Read the state owner doc and inspect `ViewPage`, `TransactionsPage`, `TransactionTable`, existing
row selection and select-all behavior, breadcrumb/return URL conventions, the static membership
hooks, permissions, and their tests.

### Execution steps

1. Add an “Add transactions” action on `ViewPage` that navigates to `/` with a validated target
   view ID and explicit internal return destination in URL state. Parse/build this mode in one pure
   shared utility, preserve ordinary transaction filter params, reject malformed/external return
   targets, and make cancel/success remove all mode-specific params.
2. Resolve target view metadata and membership through TanStack Query only while add mode is
   active. Gate the entry action and the complete add-mode subtree with `views:write`; a denied
   deep link must not issue target-view queries or reveal a selectable table.
3. Refactor `TransactionTable` selection into explicit purposes. Normal mode retains
   `transactions:delete` selection and bulk delete. Add mode instead uses `views:write`, hides bulk
   delete, marks or disables current members, and selects only nonmember rows from the already
   filtered complete snapshot. Keep page selection and “select all matching” semantics correct
   when existing members are interleaved.
4. Submit one deduplicated delta as `{addTransactionIds: selectedIds,
removeTransactionIds: []}`. Disable submission for no selection or unresolved active amount
   filtering. On 204, refresh the target membership and metadata and return to the view. On
   `SAVED_VIEW_MEMBERSHIP_STALE`, retain the mode and selection, refresh both transactions and
   membership, explain the conflict, and require the user to review rather than retrying.
5. Add pure URL tests and integrated page/table tests for the entry action, permissions, deep-link
   validation, existing-member disabling, page versus all-filtered selection, empty selection,
   settled amount filters, 204 success, stale addition, other mutation errors, cancel, browser
   back/forward behavior, and cleaned return navigation.

### Implementation notes

Add mode is navigation context and therefore URL state, not Redux or component-to-component state.
It is mutually exclusive with bulk-delete selection so one checkbox never represents two actions.
The backend canonicalizes duplicates and revalidates ownership, but the frontend should still avoid
submitting known existing members and duplicate IDs.

### Validation

Format changed files; run focused add-mode URL, `TransactionsPage`, `TransactionTable`, `ViewPage`,
permission, view-hook, and navigation tests; and run `npm run lint:fix`.

### Completion criteria

Users can enter add mode from a view, select nonmembers across the locally filtered complete
snapshot, submit one atomic delta, and return cleanly; existing members and permission-denied users
cannot trigger invalid additions.

## Phase 7: Finish the Display-Amount Migration Across Detail and Analytics

### Workspace

.

### Goal

Eliminate every remaining alternate selected-currency conversion path and make detail and analytics
surfaces honest about provenance and partial totals.

### Scope

Migrate saved-view amount presentation left from Phase 4, transaction detail and delete
confirmation, analytics aggregation/cards, conversion provenance UI, and remove legacy conversion
fallback utilities.

### Non-goals

Changing analytics navigation or product formulas unrelated to amounts, changing transfer/refund
tolerances, adding backend aggregates, or changing administrative native-value behavior.

### Required context

Use the completed amount primitive and static views. Search all source and tests for
`convertCurrency`, `findNearestExchangeRate`, `amountInUsd`, direct exchange-rate arithmetic, and
selected-currency totals. Inspect `TransactionDetailPage`, `CurrencyConversionCard`,
`ExchangeRateInfo`, `DeleteTransactionModal`, `useAnalyticsData`, analytics grids/cards, and the
static view page/table.

### Execution steps

1. Ensure the static `ViewPage` builds one display-amount projection for its member transactions
   and uses it for amount filters, unavailable notices, selected-currency sorting, cells, totals,
   and clone IDs with the exact Phase 2 semantics. Do not recompute the collection in the table or
   statistics hook.
2. Change transaction detail and delete confirmation to consume a `DisplayAmount` result. Always
   disclose the positive native magnitude and ISO currency; show the quantized selected-currency
   value only when available; otherwise show a clear unavailable state without falling back to the
   native number.
3. Replace the one-rate/fallback detail model with zero-, one-, or two-leg provenance. For every
   leg show the effective transaction date and `publishedDate`; explain a prior publication date
   as weekend/holiday carry-forward supplied by Currency Service, not “nearest available.”
4. Refactor analytics to sum available per-transaction quantized display values while counting all
   qualifying transactions. Add unavailable counts to monthly and yearly models and visible cards;
   label mixed totals partial, and distinguish an all-unavailable period from a real zero. Preserve
   source selection, debit/credit selection, year logic, and LocalDate behavior.
5. Delete or narrow `convertCurrency`, `findNearestExchangeRate`, `amountInUsd`, cached nearest-date
   logic, and any raw fallback path so production selected-currency consumers can only use the
   discriminated contract. Update all affected tests and fixtures, including weekend publication,
   triangulation provenance, partial analytics, all-unavailable analytics, and native disclosure.

### Implementation notes

Keep original native values for disclosure; never include them in selected-currency totals unless
source and target currencies are equal. A count describes transactions, while a monetary total
describes only available converted values; the UI must present both facts together when they
diverge.

### Validation

Format changed files; run focused view page/table/stats, transaction detail, conversion card,
exchange-rate info, delete dialog, analytics hook/page/grid, and currency utility tests; run
`npm run lint:fix`; then run:

```bash
rg -n 'amountInUsd|findNearestExchangeRate|convertCurrency' src --glob '*.{ts,tsx}'
```

Every production match must be removed; retained test/history names must be intentionally renamed
where they still imply the obsolete behavior.

### Completion criteria

All ordinary user-facing selected-currency amounts use one discriminated projection, rate
publication provenance is accurate, analytics exposes partial/unavailable totals, and no native
fallback or nearest-date conversion remains.

## Phase 8: Expose the Administrative Native-Amount Contract

### Workspace

.

### Goal

Make cross-user transaction search fully express and explain the generated API's independent
currency criterion and stored numeric amount semantics.

### Scope

Add the existing currency query field to the admin filter UI, canonicalize it in URL state, remove
incorrect nonnegative-only restrictions, explain mixed-currency comparisons, and preserve native
server sorting and pagination.

### Non-goals

Client-side conversion, the global display-currency selector, loading all users' transactions,
requiring a currency for amount bounds, clearing bounds when currency changes, or changing backend
search/count behavior.

### Required context

Read the descriptions for `GET /v1/transactions/search` and
`GET /v1/transactions/search/count` in the generated specification. Inspect
`TransactionSearchFiltersPanel`, `TransactionSearchTable`, `AdminTransactionsPage`, admin URL state,
`transactionSearchApi`, transaction search types, and their tests.

### Execution steps

1. Add `currencyIsoCode` to the admin filter draft, applied-filter count, form patch, and visible
   controls beside `minAmount` and `maxAmount`. Use a plainly labeled ISO-code input or an
   equivalently complete catalogue control, normalize trimmed input to uppercase for canonical
   URLs, and keep empty input undefined.
2. Remove `min="0"` from administrative amount inputs because the backend compares the stored
   numeric field and the existing data contract does not guarantee nonnegative persistence. Parse
   only finite numbers and keep the stored sign; do not apply `Math.abs` in URL, request, table, or
   sort handling.
3. Add persistent mobile-visible explanatory copy near the controls: amount bounds and
   `sort=amount` compare raw stored numbers without FX normalization; an amount-only search can span
   currencies; combining a currency with bounds makes the comparison currency-specific. Do not use
   a tooltip and do not block amount-only searches.
4. Keep `TransactionSearchTable` manual/server-paged and format each returned row in its native ISO
   currency. Preserve `currencyIsoCode` as an independent request parameter, do not clear amounts
   when it changes, and keep the global selected display currency out of the admin layout.
5. Add URL, request, filter-panel, page, and table tests for currency-only, amount-only (including a
   negative bound), combined currency/amount, currency changes that preserve bounds, invalid
   non-finite inputs, raw amount sorting, deep links, clear-all, and explanatory copy.

### Implementation notes

The admin result can be sorted numerically across currencies, but that ordering is not an economic
value comparison. Use “stored numeric amount” or “raw amount,” never language suggesting FX
normalization. The query field already exists in types, URL parsing, and the adapter; integrate it
rather than creating duplicate state.

### Validation

Format changed files; run focused admin URL, filter panel, table, page, API adapter, and transaction
search utility tests; and run `npm run lint:fix`.

### Completion criteria

Administrative users can issue currency-only, amount-only, and combined searches; negative stored
criteria are not blocked; native sorting/pagination remain server-owned; and the UI clearly states
the non-normalized contract.

## Phase 9: Update Durable Contracts and Remove Legacy Guidance

### Workspace

.

### Goal

Make repository-owned documentation and discovery guidance match the implemented static-view and
amount architecture.

### Scope

Update API integration, state architecture, architecture, authentication, testing guidance, and
only the nearest other durable docs that contain affected contracts. Perform repository-wide
contract searches and remove obsolete comments and test fixture terminology.

### Non-goals

Linking this ephemeral plan from durable docs, documenting component walkthroughs, changing the
generated OpenAPI snapshot by hand, cross-repository edits, unrelated README churn, or designing a
future sync protocol.

### Required context

Read `docs/README.md` to confirm each documentation owner. Re-read every owner document being
changed and inspect the completed source, generated specification, and backend application codes.
Do not edit sibling repositories.

### Execution steps

1. Rewrite the saved-view section of `docs/api-integration.md` around static metadata, exact
   creation IDs, deterministic membership, complete-snapshot intersection, atomic add/remove
   deltas, 204 responses, stale-membership refresh, transaction-delete invalidation, and the ban on
   per-ID member hydration. Replace the exclusion-based transfer/refund contract with current-member
   removal and outside-member evidence.
2. Document the display-amount contract in the appropriate API/state owners: transaction-date
   conversion through exact dense rate rows, `publishedDate` provenance, magnitude normalization,
   minor-unit quantization before filtering/sorting/summing, unavailable and partial semantics,
   and `amountCurrency` URL behavior. State explicitly that ordinary filters are not backend
   criteria.
3. Update `docs/state-architecture.md` for static membership server state, derived member objects,
   add-mode navigation params, amount-bound currency state, and unchanged Redux ownership of the
   selected display preference. Keep row selection, pagination, sorting, and projections local or
   derived.
4. Update `docs/architecture.md` to state that current-user `GET /v1/transactions` is the complete
   active plain-array snapshot used for local filtering, sorting, and aggregation; table pagination
   is presentation only; view IDs intersect that cache; and cross-user admin search remains the
   paged stored-native exception. Record that no transport pagination or performance benchmark is
   introduced by this change.
5. Add `views:read`, `views:write`, and `views:delete` to the authentication permission taxonomy and
   document their route/action boundaries. Update `docs/testing-guide.md` examples that currently
   require matched/pinned/excluded membership cases so they instead cover static ordering, missing
   cache IDs, atomic deltas, stale additions, and zero per-ID fetches.
6. Search source and durable docs for old endpoint names, dynamic criteria, open-ended views,
   matched/pinned/excluded membership, nearest-rate fallback, USD sort authority, native selected-
   currency fallback, and claims that admin amounts are normalized. Remove stale comments,
   fixtures, and exports or document an intentional remaining non-view/native use.

### Implementation notes

Do not duplicate endpoint inventories from OpenAPI. Durable docs should explain frontend ownership,
cache behavior, amount meaning, and error handling. The generated specification is an input owned by
the generation workflow; this phase verifies it but does not manually reshape or reorder it.

### Validation

Verify every changed Markdown link and referenced repository path. Run the contract searches from
earlier phases plus targeted searches for `matched`, `pinned`, `excluded`, `open-ended`, `criteria`,
and “nearest available” across `docs/` and production source, then run
`git diff --check -- AGENTS.md README.md docs src`.

### Completion criteria

All durable owner docs encode the implemented static membership, complete-snapshot, display-amount,
permission, and administrative native-amount contracts; obsolete guidance is gone; and no durable
file links to this plan.

## Phase 10: Run Full Integration, Build, and CSP-Sensitive Gates

### Workspace

.

### Goal

Prove the completed migration is internally consistent and report any verifier that depends on an
unavailable user-managed environment.

### Scope

Final formatting, repository-wide legacy-contract audits, full lint/coverage/type/build gates,
production-smoke static scanning, and the required external CSP workflow when its prerequisites are
provided.

### Non-goals

Starting Vite or Tilt, modifying Playwright configuration or E2E tests without a discovered product
gap, changing dependencies, committing, pushing, refreshing the generated API from a sibling
repository, or hiding failures with rule disables or allowlists.

### Required context

Read the final diff, `docs/development.md` production build section,
`docs/architecture.md#content-security-policy`, and
`docs/testing-guide.md#external-browser-harness`. Check `git status` before formatting so unrelated
user work is not included.

### Execution steps

1. Run focused suites for every changed shared utility, hook, adapter, page, component, URL helper,
   permission workflow, and MSW handler. Resolve failures at their owning layer and rerun the
   affected focused suite before broader gates.
2. Format only files changed by this plan with Prettier unless `npm run format` is proven not to
   overlap unrelated user work. Run `npm run lint:fix`; never disable an ESLint rule to complete the
   migration.
3. Run final repository searches proving there are no old saved-view endpoints or concepts, no
   production nearest-date/native fallback conversion, no `amountInUsd` sort authority, no
   individual view-member fetch fan-out, and no admin use of the selected display projection.
4. Run `npm run build`. This must pass the full Vitest coverage gate, TypeScript compilation, and
   standard Vite bundle. Fix real coverage gaps with behavior-focused tests rather than threshold
   changes or trivial assertions.
5. Because dialog/overlay contents and transaction dropdown/table workflows changed, run
   `npm run build:prod-smoke`, which includes the dropdown CSP static scan. Investigate any new
   emitted capability signature rather than allowlisting it.
6. If the user-managed Tilt stack, trusted local CA, matching Chromium, and
   `https://app.budgetanalyzer.localhost/_prod-smoke/` are available, follow the Testing guide and
   run `npm run test:e2e:csp` without starting a server or disabling TLS. If any prerequisite is
   unavailable, do not improvise a local server; record the exact missing prerequisite and state
   that the browser audit remains unverified.
7. Run `git diff --check`, review `git diff --stat` and `git status --short`, confirm the generated
   OpenAPI change remains intact and no sibling repository was modified, and summarize validation
   results and any environment-bound limitation for handoff.

### Implementation notes

The current Playwright application workflow may not assert every new product semantic, but it is
still required evidence for CSP-sensitive transaction controls and overlays. Add or change E2E
source only if the implementation creates a browser-only behavior that Vitest cannot meaningfully
cover; if that happens, follow the repository rule to run `npm run typecheck:e2e` as well.

### Validation

Required non-browser gates are `npm run lint:fix`, `npm run build`,
`npm run build:prod-smoke`, the final repository searches, and `git diff --check`. The external
browser gate is `npm run test:e2e:csp` when all user-managed prerequisites are available.

### Completion criteria

All required local gates pass, the production-smoke CSP scan passes, final searches prove the old
contracts are absent, documentation matches behavior, and the browser audit either passes in the
supported external environment or is reported precisely as not run because a named prerequisite
was unavailable.
