# Testing Coverage Consistency Plan

## Context

Phase 1 and Phase 2 are complete. Shared test infrastructure now lives under
`src/testing/`, production-code tests are colocated under `__tests__`
directories, and the old `src/test/` directory has been removed.

At plan creation, this repo had two test placement styles:

- `src/test/` contained global setup plus three production-code tests:
  - `setup.ts`
  - `Button.test.tsx`
  - `parseSearchTerms.test.ts`
  - `useTransactions.test.tsx`
- Most of the suite uses colocated `__tests__` directories next to the code under test.

That split looked historical rather than intentional. `src/test/setup.ts` was legitimate shared test infrastructure because `vitest.config.ts` pointed to it. The other files in `src/test` looked like early examples that predated the current feature-colocated convention. The old `docs/testing-guide.md` reinforced that older structure and used `Button.test.tsx` as a primary example, which was misleading.

Current suite snapshot after Phase 2:

- 38 test files.
- 182 tests.
- `npm test -- --run` passes.
- No skipped or focused tests were found.
- `npm test -- --run --coverage` fails because `@vitest/coverage-v8` is not installed.
- 16 test files mock modules with `vi.mock`.
- 3 test files use MSW directly.
- 14 test files use `fireEvent`.
- 0 test files use `userEvent`; `@testing-library/user-event` is not installed.

## Bulletproof React Guidance Checked

Checked the Bulletproof React testing and project-structure guidance:

- Testing should lean on integration tests for confidence, with unit tests reserved for shared functions/components and complex isolated logic.
- Testing Library should test behavior as a user experiences it, not implementation details.
- MSW is recommended for HTTP-facing tests so app code still makes real HTTP calls against a mocked server.
- Shared test utilities and mocks belong in a dedicated `src/testing` area.
- Feature code should stay feature-oriented and isolated.

This maps well to a hybrid convention for this repo: colocate tests for production behavior near the owning feature/module, and reserve `src/testing` for setup, render helpers, factories, and MSW fixtures.

## Target Convention

Adopt one placement rule:

- Production-code tests live beside their owning code in `__tests__` directories.
- Shared test infrastructure lives in `src/testing/`.
- MSW handlers, test data builders, provider wrappers, and setup files live under `src/testing`.
- No production-code tests live directly in `src/testing`.

Examples:

- `src/utils/parseSearchTerms.ts` -> `src/utils/__tests__/parseSearchTerms.test.ts`
- `src/hooks/useTransactions.ts` -> `src/hooks/__tests__/useTransactions.test.tsx`
- `src/test/setup.ts` -> `src/testing/setup.ts`
- `src/mocks/handlers.ts` -> `src/testing/mocks/handlers.ts`

## What We Should Test

Prioritize tests that would fail for a real product regression:

- Permission gates and denied states that prevent actions or data hooks from mounting.
- URL state parsing/serialization for analytics, admin search, saved views, and drilldowns.
- API request shaping where the frontend transforms user-visible state into backend payloads.
- Error, loading, empty, and forbidden states for important pages.
- Transaction import preview/review flows, duplicate handling, edit/delete gating, bulk actions, and saved-view behavior.
- Date, currency, search, analytics, and filtering logic where edge cases are easy to regress.
- Session lifecycle behavior, timers, heartbeat, inactivity warning, and redirect behavior.

Keep unit tests for pure logic and complex hooks. Use integration-style component/page tests when the confidence comes from several pieces working together.

## What We Should Avoid

Do not chase coverage by testing facts already guaranteed by React, the browser, TypeScript, or a library:

- "Button renders a button."
- "Clicking a native button calls `onClick`."
- "A disabled native button does not click."
- Tailwind class snapshots for visual variants unless a class is part of a real behavioral contract.
- Page tests that only assert a heading renders, unless they are explicit route smoke tests and there is no better workflow assertion nearby.
- Tests that mirror implementation details such as hook internals, private state, or exact component decomposition.

The `src/test/Button.test.tsx` file is the clearest example of low-signal coverage. The useful contract of this `Button` primitive is mostly TypeScript props plus composition; asserting native button behavior and exact Tailwind classes creates churn without much regression protection. If a future UI primitive contains custom accessibility behavior, keyboard handling, or nontrivial composition, test that behavior instead.

## Implementation Plan

### Phase 1: Normalize Test Infrastructure

1. Create `src/testing/`.
2. Move `src/test/setup.ts` to `src/testing/setup.ts`.
3. Move `src/mocks/server.ts` and `src/mocks/handlers.ts` to `src/testing/mocks/`.
4. Update `vitest.config.ts` to use `./src/testing/setup.ts`.
5. Update imports from `@/mocks/server` and `@/mocks/handlers` to `@/testing/mocks/server` and `@/testing/mocks/handlers`.
6. Add `src/testing/test-utils.tsx` with:
   - `createTestQueryClient()`
   - `renderWithProviders()`
   - optional router initial entries
   - optional Redux preloaded state or a test-store factory
7. Update docs and agent guidance references from `src/test` to `src/testing`.

### Phase 2: Move or Remove Stray Tests (Complete)

1. Move `src/test/parseSearchTerms.test.ts` to `src/utils/__tests__/parseSearchTerms.test.ts`.
2. Move `src/test/useTransactions.test.tsx` to `src/hooks/__tests__/useTransactions.test.tsx`.
3. Delete `src/test/Button.test.tsx` unless a concrete, non-obvious Button contract is identified.
4. Remove the empty `src/test/` directory.
5. Update `docs/testing-guide.md` examples so they show colocated tests and shared infrastructure separately.

### Phase 3: Improve Test Ergonomics (Complete)

1. Add `@testing-library/user-event` as a dev dependency.
2. Prefer `userEvent` for user workflows such as clicking, typing, selecting, and clearing fields.
3. Keep `fireEvent` for lower-level events where `userEvent` is not a good fit, such as synthetic window activity, timer-adjacent hooks, and rare DOM events.
4. Replace repeated local `QueryClientProvider`, `Provider`, and `MemoryRouter` setup with `renderWithProviders()` where it reduces noise.
5. Keep local render helpers only when a test needs route-specific or page-specific wiring that would make the shared helper too clever.

Completion notes:
- `@testing-library/user-event` is installed.
- User workflow tests now use `userEvent` across navigation, form, modal, bulk action, and admin page interactions.
- Remaining `fireEvent` usage is limited to synthetic window activity, timer-adjacent modal behavior, and a Radix keyboard-event workaround.
- `renderWithProviders()` now supports the repo's mixed router imports with a default `react-router` memory router and an explicit `router: 'dom'` option for components that still import hooks from `react-router-dom`.

### Phase 4: Add Coverage Reporting Without Gaming It (Complete)

1. Add `@vitest/coverage-v8`.
2. Add a `test:coverage` script rather than relying on a remembered CLI flag.
3. Configure coverage excludes for:
   - `src/testing/**`
   - generated types and declaration files
   - config files
   - entrypoint glue such as `src/main.tsx` unless the app starts testing bootstrap behavior
4. Generate an initial report with no hard threshold.
5. Use the report to find meaningful blind spots, not to force tests around trivial UI primitives.
6. Add thresholds only after the suite shape is consistent. Start with modest global thresholds or targeted thresholds around high-value modules, then ratchet upward deliberately.

Completion notes:
- `@vitest/coverage-v8` is installed.
- `npm run test:coverage` runs `vitest run --coverage`.
- Coverage uses the V8 provider with terminal, HTML, and JSON summary reports.
- Coverage excludes shared test infrastructure, colocated test files, declaration files, type-only modules, config files, and `src/main.tsx`.
- No coverage thresholds were introduced.
- Initial report generated successfully: 38 test files and 182 tests passed; global coverage was 59.96% statements, 69.97% branches, 55.62% functions, and 59.96% lines.

### Phase 5: Coverage Audit And Gap Fill

Audit by product risk, not by file count. Each lettered section below is a
reasonable independent work session. Do not introduce global coverage thresholds
in this phase; use the report to choose high-value tests and keep deleting or
rewriting low-signal tests when they only assert browser, React, or library
behavior.

Coverage audit snapshot from `npm run test:coverage`:

- 38 test files and 182 tests passed.
- Global coverage: 59.96% statements, 69.97% branches, 55.62% functions,
  59.96% lines.
- Lowest-risk noise: simple layout wrappers, UI primitives, and static fallback
  pages with no workflow contract. Test these only when they protect routing,
  accessibility, session, or error behavior.
- Highest-risk uncovered or thinly covered areas: admin create/edit workflows,
  route guards, transaction import/detail flows, shared API modules, shared
  server-state hooks, view reconciliation/filter logic, and currency utilities.

A. Refresh the baseline and create a short target list. (Complete)

1. Run `npm run test:coverage`.
2. Confirm the suite is still green before adding tests.
3. Use `coverage/coverage-summary.json` to identify files below 50% line or
   function coverage.
4. Classify each target as one of:
   - high-value workflow/API/authorization behavior to test now,
   - low-signal presentational code to leave alone,
   - code that should be excluded from coverage because it is type-only,
     generated, or bootstrap glue.
5. Update this phase's snapshot if the baseline materially changes.

Completion notes:
- Refreshed with `npm run test:coverage`: 38 test files and 182 tests passed.
  The global snapshot did not materially change: 59.96% statements, 69.97%
  branches, 55.62% functions, and 59.96% lines.
- `coverage/coverage-summary.json` reported these files below 50% line or
  function coverage.
- High-value workflow/API/authorization targets to test in later phase-5
  sessions: route and auth behavior (`src/App.tsx`,
  `src/features/admin/components/AdminRoute.tsx`,
  `src/features/auth/components/UserProfileDropdown.tsx`,
  `src/features/auth/hooks/useAuth.ts`, `src/features/auth/pages/LoginPage.tsx`,
  `src/features/auth/utils/role.ts`); admin create/edit/search workflows
  (`src/features/admin/currencies/components/ConfirmDisableCurrencyDialog.tsx`,
  `src/features/admin/currencies/components/CurrencyForm.tsx`,
  `src/features/admin/currencies/pages/CurrencyCreatePage.tsx`,
  `src/features/admin/currencies/pages/CurrencyEditPage.tsx`,
  `src/features/admin/statement-formats/components/StatementFormatForm.tsx`,
  `src/features/admin/statement-formats/pages/StatementFormatCreatePage.tsx`,
  `src/features/admin/statement-formats/pages/StatementFormatEditPage.tsx`,
  `src/features/admin/transactions/components/TransactionSearchFiltersPanel.tsx`,
  `src/features/admin/transactions/components/TransactionSearchTable.tsx`);
  transaction workflows (`src/features/transactions/components/BulkDeleteBar.tsx`,
  `src/features/transactions/components/BulkDeleteModal.tsx`,
  `src/features/transactions/components/DeleteTransactionModal.tsx`,
  `src/features/transactions/components/EditableTransactionRow.tsx`,
  `src/features/transactions/components/ImportButton.tsx`,
  `src/features/transactions/components/TransactionTable.tsx`,
  `src/features/transactions/hooks/usePreviewTransactions.ts`,
  `src/features/transactions/hooks/useTransactionFiltersSync.ts`,
  `src/features/transactions/pages/TransactionDetailPage.tsx`,
  `src/hooks/useBulkDeleteTransactions.ts`, `src/hooks/useTransactions.ts`);
  view workflows and utilities (`src/components/SaveAsViewButton.tsx`,
  `src/components/ViewSelector.tsx`, `src/features/views/components/EditViewModal.tsx`,
  `src/utils/filterTransactions.ts`, `src/utils/reconcileViewTransactions.ts`);
  shared API and server-state behavior (`src/api/currencyApi.ts`,
  `src/api/statementFormatApi.ts`, `src/api/transactionApi.ts`,
  `src/api/viewApi.ts`, `src/hooks/useCurrencies.ts`,
  `src/hooks/useMissingCurrencies.ts`, `src/hooks/useStatementFormats.ts`,
  `src/hooks/useTransactionCount.ts`, `src/hooks/useViews.ts`); currency and
  amount interpretation (`src/components/CurrencySelector.tsx`,
  `src/components/MissingExchangeRatesBanner.tsx`, `src/utils/currency.ts`);
  analytics controls where they affect navigation or interpretation
  (`src/features/analytics/components/TransactionTypeSelector.tsx`,
  `src/features/analytics/components/ViewModeSelector.tsx`,
  `src/features/analytics/components/YearlySpendingCard.tsx`,
  `src/features/analytics/components/YearlySpendingGrid.tsx`); and shared
  feedback behavior when it protects user-visible error or toast contracts
  (`src/components/ErrorBanner.tsx`, `src/hooks/useToast.ts`).
- Low-signal presentational/static targets to leave alone unless they become
  part of a workflow or accessibility contract: `src/components/Breadcrumbs.tsx`,
  `src/components/ErrorBoundary.tsx`, `src/components/Layout.tsx`,
  `src/components/ui/Avatar.tsx`, `src/components/ui/Toast.tsx`,
  `src/components/ui/Toaster.tsx`, `src/features/admin/components/AdminLayout.tsx`,
  `src/features/admin/components/UnauthorizedPage.tsx`,
  `src/features/admin/pages/AdminNotFoundPage.tsx`,
  `src/features/auth/pages/ErrorPage.tsx`, `src/features/auth/pages/PeacePage.tsx`,
  `src/features/transactions/components/CurrencyConversionCard.tsx`,
  `src/features/transactions/components/ExchangeRateInfo.tsx`,
  `src/features/transactions/components/TransactionMetadataCard.tsx`,
  and `src/store/uiSlice.ts`.
- Coverage-exclude candidates because they are barrel or bootstrap glue:
  `src/features/views/index.ts` and `src/store/index.ts`.

B. Add route, authentication, and authorization coverage. (Complete)

1. Add focused tests for `src/features/admin/components/AdminRoute.tsx`.
2. Cover admin-role access, non-admin redirect/denial, unauthenticated behavior,
   and loading behavior.
3. Add route-level tests around `src/App.tsx` only where they prove important
   permission wrappers, redirects, or unauthorized states. Do not test every
   static route mapping.
4. Cover `src/features/auth/components/UserProfileDropdown.tsx` for the visible
   user identity, logout affordance, and missing optional fields.
5. Add small tests for `src/features/auth/utils/role.ts` if `AdminRoute` tests
   do not already cover the role contract.

Completion notes:
- Added focused `AdminRoute` coverage for admin access, unauthenticated redirect
  to `/login`, authenticated non-admin redirect to `/`, and loading skeleton
  behavior.
- Added narrow `App` route tests that prove representative permission wrappers:
  `currencies:read`, `currencies:write`, and `transactions:read:any`, plus the
  unauthorized redirect state and the top-level admin-role route gate.
- Added `UserProfileDropdown` coverage for visible identity, logout activation,
  null-user rendering, and fallback email identity when optional profile fields
  are missing.
- Added `role.ts` coverage for the `ADMIN` role contract.
- Verification: `npm run lint:fix`, `npm test -- --run`, and
  `npm run test:coverage` completed successfully. The full suite now has 42
  test files and 198 tests; global coverage is 62.7% statements, 70.93%
  branches, 55.95% functions, and 62.7% lines.

C. Replace heading-only admin tests with workflow tests. (Complete)

1. Expand `src/features/admin/transactions/pages/__tests__/AdminTransactionsPage.test.tsx`
   beyond "renders the search UI".
2. Cover filter submission, URL serialization/default parsing, successful result
   rendering, empty results, API error rendering, and pagination or sorting if
   exposed to the user.
3. Expand `src/features/admin/users/pages/__tests__/UsersListPage.test.tsx`
   beyond the single smoke assertion.
4. Cover search filters, URL state, successful table rendering, empty results,
   and error states.
5. Keep `UserDetailPage` tests focused on detail loading, permission-gated
   deactivation, success, and failure; add only missing states found in the
   coverage report.

Completion notes:
- Replaced the heading-only `AdminTransactionsPage` smoke test with workflow
  coverage for successful result rendering, filter submission, URL
  serialization, URL default parsing into API query params, empty results, API
  error banners after React Query retry, pagination, and sorting.
- Replaced the heading-only `UsersListPage` smoke test with workflow coverage
  for successful table rendering, email/status/advanced filter submission, URL
  serialization, URL default parsing into API query params, empty results, API
  error banners after React Query retry, and sorting.
- Added the missing `UserDetailPage` permission-gate case proving the
  `Deactivate User` action is hidden when `users:write` is absent while
  keeping the existing detail loading, deactivation success, and failure tests
  focused.
- Verification: focused admin page/detail tests passed, `npm run lint:fix`
  completed successfully, and `npm run test:coverage` completed successfully.
  The full suite now has 42 test files and 209 tests; global coverage is 65.56%
  statements, 76.82% branches, 61.64% functions, and 65.56% lines.

D. Cover admin currencies create/edit workflows. (Complete)

1. Add tests for `CurrencyCreatePage.tsx`, `CurrencyEditPage.tsx`,
   `CurrencyForm.tsx`, and `ConfirmDisableCurrencyDialog.tsx` as workflow tests
   under the owning `__tests__` directory.
2. Cover loading existing currency data, validation constraints matching the
   OpenAPI contract, submit payload shape, success navigation/feedback, API
   error banners, and disable confirmation behavior.
3. Keep `CurrenciesListPage` tests for action gates and list states; add missing
   error/empty states if not already covered.
4. Prefer MSW for API-facing create/update/disable behavior unless a narrower
   hook mock is clearly simpler and still proves the payload contract.

Completion notes:
- Added `CurrencyForm` component coverage for OpenAPI-backed required,
  `maxLength`, and pattern constraints; create value normalization; immutable
  edit fields; selected enabled status; and submit disabled state.
- Added `ConfirmDisableCurrencyDialog` component coverage for loading,
  transaction-count warning, no-active-transactions copy, confirm, and cancel
  behavior. Fixed invalid nested paragraph markup in the dialog body while
  covering it.
- Added MSW-backed `CurrencyCreatePage` workflow coverage for create request
  payload shape, success navigation/feedback, and mapped 422 API error
  rendering.
- Added MSW-backed `CurrencyEditPage` workflow coverage for loading existing
  currency data, immutable fields, disable confirmation with transaction count,
  update request payload shape, success navigation/feedback, load failure, and
  update failure.
- Expanded `CurrenciesListPage` coverage for empty and API error states while
  keeping existing permission-gate tests.
- Updated `docs/testing-guide.md` with the convention for asserting API request
  payload/query shape inside MSW handlers for API-facing workflow tests.
- Verification: focused currency tests passed (`16` tests across `5` files),
  `npm run lint:fix` completed successfully, and `npm run test:coverage`
  completed successfully. The full suite now has 46 test files and 223 tests;
  global coverage is 69.06% statements, 78.66% branches, 65.04% functions,
  and 69.06% lines.

E. Cover admin statement-format create/edit workflows. (Complete)

1. Add tests for `StatementFormatCreatePage.tsx`,
   `StatementFormatEditPage.tsx`, and `StatementFormatForm.tsx`.
2. Cover required fields, field constraints, row/column mapping behavior,
   submit payload shape, success navigation/feedback, and API error rendering.
3. Keep `StatementFormatsListPage` tests for action gates and list states; add
   missing error/empty states if not already covered.
4. Prefer user-event workflows over direct prop calls.

Completion notes:
- Added `StatementFormatForm` component coverage for OpenAPI-backed required,
  `maxLength`, and pattern constraints; CSV column mapping normalization;
  non-CSV mapping omission; immutable edit fields; selected enabled status; and
  submit disabled state.
- Added MSW-backed `StatementFormatCreatePage` workflow coverage for create
  request payload shape, success navigation/feedback, and mapped 422 API error
  rendering.
- Added MSW-backed `StatementFormatEditPage` workflow coverage for loading
  existing format data, immutable fields, update request payload shape, success
  navigation/feedback, load failure, and update failure.
- Fixed `StatementFormatEditPage` so edited `displayName` values are included
  in the update request payload; the form already exposed the field as mutable
  and the OpenAPI schema accepts it.
- Expanded `StatementFormatsListPage` coverage for empty and API error states
  while keeping existing permission-gate tests.
- Updated `docs/testing-guide.md` to document that this repo's custom Select
  primitive exposes menu items as buttons in tests, matching the current
  component implementation.
- Verification: focused statement-format tests passed (`14` tests across `4`
  files), `npm run lint:fix`, `npm run test:coverage`, and
  `npm test -- --run` completed successfully. The full suite now has `49` test
  files and `235` tests; global coverage is 73.61% statements, 80.76%
  branches, 68.51% functions, and 73.61% lines.

F. Cover transaction import, preview, and detail flows.

1. Add tests for `ImportButton.tsx` that cover file selection, preview request
   shaping, disabled/loading states, preview modal opening, and preview errors.
2. Add hook or integration coverage for `usePreviewTransactions.ts` if the
   `ImportButton` tests do not exercise its request and error behavior.
3. Expand transaction preview tests only where product behavior is missing:
   duplicate resolution, edited-field payloads, batch import payloads, and cache
   invalidation after successful import.
4. Add tests for `TransactionDetailPage.tsx` covering loading, successful detail
   rendering, 404/403/error states, edit success/failure, delete success/failure,
   and permission-gated write/delete affordances.
5. Keep existing table permission tests; add mutation/cache-update coverage only
   if the behavior is not covered by page or detail tests.

Completion notes:
- Added `ImportButton` coverage for file selection, format/account preview
  request shaping, disabled submit state, pending preview state, preview modal
  opening, and preview error callbacks.
- Expanded `TransactionPreviewModal` coverage for edited preview-field payloads
  and React Query invalidation of `['transactions']` and
  `['transactionCount']` after successful batch import.
- Added detail-page edit/delete affordances gated by
  `transactions:write` and `transactions:delete`, using the existing
  transaction update hook and delete confirmation modal.
- Added `TransactionDetailPage` workflow coverage for loading, successful detail
  rendering, 404/403/500 error states, permission-gated action visibility, edit
  success/failure, and delete success/failure.
- Adjusted preview upload request construction so Axios sets the multipart
  boundary instead of forcing a static `Content-Type` header.
- Updated `docs/testing-guide.md` with current conventions for multipart upload
  assertions, explicit React Query retry waits, and the custom dialog primitive.
- Verification: focused transaction import/preview/detail tests passed
  (`21` tests across `3` files), `npm run lint:fix`, `npx tsc --noEmit`, and
  `npm run test:coverage` completed successfully. The full suite now has `51`
  test files and `250` tests; global coverage is `78.76%` statements, `80.8%`
  branches, `71.04%` functions, and `78.76%` lines.

G. Cover view list and view-state workflows.

1. Expand `ViewsPage.test.tsx` beyond the current smoke coverage.
2. Cover list loading, empty state, API error state, create view success/failure,
   delete view success/failure, pin/unpin, and opening an existing view.
3. Add focused tests for `useViewTransactionFiltersSync.ts` if page tests do not
   cover URL parsing and serialization.
4. Add utility tests for `src/utils/reconcileViewTransactions.ts` covering pinned,
   excluded, restored, duplicate, and missing transaction cases.
5. Add utility tests for `src/utils/filterTransactions.ts` if its behavior is
   still product-owned rather than a duplicate of already tested search helpers.

Completion notes:
- Expanded `ViewsPage` coverage for loading, empty, API error with retry, saved
  view card counts, analytics links, and opening an existing view.
- Expanded saved-view creation coverage in `CreateViewModal` for success
  navigation and no-success/no-navigation failure behavior, keeping the existing
  payload-shape assertions.
- Added `DeleteViewModal` coverage for delete impact copy, successful close and
  home navigation, no-success/no-navigation failure behavior, and pending
  disabled state.
- Expanded `ViewTransactionTable` coverage for per-row pin, unpin, and exclude
  actions through the row actions menu while keeping existing bulk membership
  tests.
- Added focused `useViewTransactionFiltersSync` tests for URL parsing, search
  serialization, date clearing with analytics return context removal, and clear
  all behavior.
- Added `reconcileViewTransactions` utility tests for pinned, excluded,
  restored, duplicate, missing, and unavailable-cache cases. Fixed the utility
  so excluded IDs are not fetched as missing visible rows and duplicate visible
  membership IDs render once.
- Added `filterTransactionsByCriteria` tests for inclusive LocalDate bounds,
  description-only saved-view search, bank/account/currency/type filters,
  absolute amount ranges, and AND semantics across filter groups.
- Updated `docs/api-integration.md` with the saved-view reconciliation contract
  and `docs/testing-guide.md` with URL-backed hook and saved-view membership
  utility testing conventions.
- Verification: focused Phase 5G tests passed (`45` tests across `7` files),
  `npm run lint:fix` completed successfully, and `npm run test:coverage`
  completed successfully. The full suite now has `55` test files and `277`
  tests; global coverage is `80.25%` statements, `81.65%` branches, `72.35%`
  functions, and `80.25%` lines.

H. Cover analytics gaps that affect navigation or data interpretation. (Complete)

1. Keep existing `AnalyticsPage` URL and drilldown tests.
2. Add tests for yearly spending grid/card behavior only where they prove user
   navigation, empty-state behavior, or amount/date interpretation.
3. Cover `YearSelector` edge cases if year defaults, bounds, or unavailable
   years are product behavior.
4. Do not add tests that only assert card layout or Tailwind classes.

Completion notes:
- Expanded `AnalyticsPage` coverage for monthly year defaulting to the latest
  transaction year, redirecting a too-early monthly year to the earliest
  transaction year, yearly debit amount interpretation with absolute values,
  yearly drilldown date bounds, and yearly no-data behavior for a selected
  transaction type.
- Added an explicit empty state to `YearlySpendingGrid` so yearly analytics do
  not render a blank content area when no rows match the selected transaction
  type.
- Updated `docs/testing-guide.md` with the analytics testing convention:
  protect URL state, aggregation, transaction-type interpretation, and
  drilldown date/return paths rather than layout classes.
- Verification: focused analytics tests passed (`10` tests in
  `AnalyticsPage.test.tsx`), `npm run lint:fix` completed successfully, and
  `npm run test:coverage` completed successfully. The full suite remains at
  `55` test files and now has `281` tests; global coverage is `81.23%`
  statements, `82.74%` branches, `72.89%` functions, and `81.23%` lines.

I. Cover shared API modules and server-state hooks. (Complete)

1. Add direct API tests for request paths, methods, query params, and payloads in
   `currencyApi.ts`, `statementFormatApi.ts`, and `viewApi.ts`.
2. Add error-normalization tests in `client.ts` only for frontend-owned behavior
   such as `ApiError` mapping and timeout/network failures.
3. Add hook tests for `useCurrencies.ts`, `useStatementFormats.ts`,
   `useViews.ts`, `useMissingCurrencies.ts`, and `useTransactionCount.ts`.
4. For hooks, cover the query key, enabled/disabled behavior when applicable,
   mutation success invalidation, and surfaced error states.
5. Do not duplicate every API module assertion in hook tests; use API tests for
   request shape and hook tests for React Query behavior.

Completion notes:
- Added direct MSW-backed API module coverage for `currencyApi.ts`,
  `statementFormatApi.ts`, and `viewApi.ts`, covering request paths, methods,
  query params, and create/update/bulk payload shapes at the module boundary.
- Added `client.ts` error-normalization coverage for structured API errors,
  network failures without responses, and preserved `ApiError` instances.
- Added server-state hook coverage for `useCurrencies.ts`,
  `useStatementFormats.ts`, `useViews.ts`, `useMissingCurrencies.ts`, and
  `useTransactionCount.ts`, covering query keys, disabled queries, surfaced
  errors, derived disabled-currency behavior, and mutation invalidation.
- Updated `docs/testing-guide.md` with the split between direct API module
  request-shape tests and React Query hook behavior tests.
- Verification: focused Phase 5I tests passed (`34` tests across `9` files),
  `npm run lint:fix` completed successfully, and `npm run test:coverage`
  completed successfully. The full suite now has `64` test files and `315`
  tests; global coverage is `82.36%` statements, `83.17%` branches, `77.91%`
  functions, and `82.36%` lines.

J. Cover shared utilities with meaningful edge cases. (Complete)

1. Expand `src/utils/currency.ts` tests for formatting, conversion, rate lookup,
   missing rates, zero/negative amounts, and unknown currency codes.
2. Expand `src/utils/dates.ts` only for uncovered timezone/local-date edge cases
   that could regress user-visible filters.
3. Expand `src/utils/errorMessages.ts` when new 422 codes or API error shapes
   are present in OpenAPI specs.
4. Avoid tests for `cn`, static column-width mappings, or trivial labels unless
   the behavior has already regressed or has a product contract.

Completion notes:
- Added `src/utils/__tests__/currency.test.ts` with focused coverage for
  currency formatting, unknown three-letter currency code display,
  exchange-rate map construction, exact/latest/earliest/in-range fallback rate
  lookup, missing-rate null behavior, USD and non-USD conversion paths, and
  zero/negative/original-amount fallback cases.
- Expanded `src/utils/__tests__/dates.test.ts` for LocalDate parsing without UTC
  day shifts, DST-sensitive start/end-of-day ISO bounds, inclusive filter
  ranges, leap-year month bounds, month keys, and calendar-day counts across
  DST.
- Added the OpenAPI-backed `CURRENCY_NOT_ENABLED` 422 mapping in
  `src/utils/errorMessages.ts` and expanded `errorMessages` tests for mapped
  codes, unknown-code fallbacks, non-422 API errors, non-API errors, and
  field-level validation error formatting.
- Stabilized an existing `AnalyticsPage` coverage assertion that raced derived
  animated content during full-suite coverage runs by waiting for the
  user-visible monthly total.
- Updated `docs/testing-guide.md` with the shared utility coverage convention:
  test product semantics and boundaries, not static maps or simple wrappers,
  and wait for derived animated content after URL-state transitions.
- Verification: focused Step J tests passed (`27` tests across `3` files),
  `npm run lint:fix` completed successfully, and `npm run test:coverage`
  completed successfully. The full suite now has `65` test files and `332`
  tests; global coverage is `83.24%` statements, `83.58%` branches, `78.62%`
  functions, and `83.24%` lines.

K. Decide what to do with console noise. (Complete)

1. Investigate the `[Stats] Starting calculation...` output from transaction and
   view page tests.
2. If it is intentional diagnostic logging, leave it and document why.
3. If it is not useful during tests, suppress it at the source or with a focused
   test helper that preserves error/warning output.
4. Do not broadly silence `console.error` or `console.warn`; those often reveal
   React, accessibility, or API-test failures.

Completion notes:
- Investigated the `[Stats] Starting calculation...` output with focused
  transaction and view page test runs. The noise came from
  `src/features/transactions/hooks/useTransactionStats.ts`, which runs during
  normal page rendering, not from a test-only diagnostic.
- Removed the routine stats timing `console.log` calls at the source while
  leaving warning and error output untouched.
- Updated `docs/testing-guide.md` with the console-output convention: avoid
  routine `console.log` noise in production code exercised by page tests, use
  focused `console.log` spies only for known intentional debug output, and do
  not broadly silence `console.error` or `console.warn`.
- Verification: the focused transaction/view page tests passed without the
  `[Stats]` stdout entries, `npm run lint:fix` completed successfully, and
  `npm run test:coverage` completed successfully. The full suite remains at
  `65` test files and `332` tests; global coverage is `83.23%` statements,
  `83.58%` branches, `78.62%` functions, and `83.23%` lines.

L. Verify and document the completed phase work. (Complete)

1. Run the focused tests added in the session.
2. Run `npm run test:coverage`.
3. Run `npm run lint:fix`.
4. Update `docs/testing-guide.md` with any new testing conventions discovered
   during phase 5.
5. Update this plan with completion notes: files covered, product risks reduced,
   tests added/removed, remaining known gaps, and the new global coverage
   numbers.

Completion notes:
- No new focused tests were added in this documentation-only session. The
  Phase 5 verification used the full non-watch suite and coverage report.
- Verification passed: `npm run lint:fix`, `npm test -- --run`, and
  `npm run test:coverage`.
- Final Phase 5 suite shape: `65` test files and `332` tests passed. Global
  coverage is `83.23%` statements, `83.58%` branches, `78.62%` functions, and
  `83.23%` lines.
- Phase 5 reduced product risk around authorization and route gates, admin
  create/edit/search workflows, transaction import/preview/detail flows,
  saved-view reconciliation and URL state, analytics interpretation and
  drilldown navigation, shared API request shaping, React Query hook behavior,
  currency/date/error utility edge cases, and routine console noise.
- Tests added/expanded during Phase 5 covered admin, transactions, views,
  analytics, API modules, hooks, and shared utilities. Step K removed runtime
  diagnostic logs rather than adding test-only console suppression.
- Remaining known gaps are intentionally lower priority or still future
  candidates: static/fallback auth pages, simple layout wrappers, some UI
  primitives, lightweight selector components, and low-signal barrel/bootstrap
  files such as `src/features/views/index.ts` and `src/store/index.ts`.

### Phase 6: Documentation And Guardrails (Complete)

Update `docs/testing-guide.md` so it becomes the source of truth for:

- Test placement.
- Shared `src/testing` utilities.
- MSW usage.
- When to unit test versus integration test.
- What not to test.
- `userEvent` versus `fireEvent`.
- Coverage report usage and threshold policy.

Update `AGENTS.md` references after the structure changes:

- Vitest setup path.
- Single-test examples.
- Any discovery commands that mention `src/test`.

Add a short PR checklist item:

- New behavior has either a meaningful test or an explicit reason it does not need one.
- No tests were added just to assert native/browser/library behavior.
- New API-facing behavior uses MSW unless a direct module mock is intentionally narrower.

Completion notes:
- Updated `docs/testing-guide.md` so it is the source of truth for test
  placement, shared `src/testing` utilities, MSW usage, choosing unit vs
  integration-style tests, what not to test, `userEvent` vs `fireEvent`,
  coverage report usage, threshold policy, and console-output handling.
- Added the PR checklist guardrails to `docs/testing-guide.md`: meaningful test
  or explicit no-test reason, no native/browser/library-only assertions, and
  MSW for new API-facing behavior unless a direct module mock is intentionally
  narrower.
- Updated `AGENTS.md` with the same operational guardrails for future agents:
  colocated production-code tests, `src/testing` for shared infrastructure
  only, meaningful-test expectations, MSW preference, and no global coverage
  threshold yet.
- Updated `docs/README.md` to fix the testing-guide component-test anchor and
  refresh the Testing Guide status date.
- Confirmed live docs and agent guidance now point at `src/testing/setup.ts`,
  `src/testing/mocks/handlers.ts`, `src/testing/mocks/server.ts`, and
  `src/testing/test-utils.tsx`; the only remaining `src/test` mentions are
  historical context in this plan and the note that the old directory is no
  longer used.

## Acceptance Criteria

- `src/test/` no longer exists.
- Shared test infrastructure lives in `src/testing/`.
- Production-code tests are colocated in `__tests__`.
- `npm test -- --run` passes.
- `npm run lint:fix` passes.
- `npm run test:coverage` runs and prints a report.
- `docs/testing-guide.md` and `AGENTS.md` match the new convention.
- Low-signal tests are removed or rewritten into behavior-focused tests.
- The plan does not introduce broad coverage thresholds until the first report has been reviewed.
