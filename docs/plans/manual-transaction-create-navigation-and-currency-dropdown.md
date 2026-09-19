# Manual Transaction Creation Navigation and Currency Dropdown Plan

Change manual transaction creation so the form offers only enabled currency choices and a successful submission navigates to the newly created transaction's detail page. The detail page becomes the unambiguous success result even when list filters, sorting, or pagination would hide the new row. The implementation must preserve the existing mutation cache writes, request/error behavior, permission gate, pending-state dismissal protection, and strict CSP constraints.

The currency control uses a native labeled `select`, not a new application overlay or dependency. Its choices are USD, which is always available as the base currency, followed by deduplicated enabled non-USD currencies in alphabetical order. It defaults to the currently selected display currency when that currency is available and defensively falls back to USD if a stale preference is no longer enabled. The existing `useCurrencies(true)` TanStack Query remains the source of server state; a first-load failure must keep submission unavailable and expose retryable contextual feedback rather than silently restoring free-form entry.

Successful creation uses the authoritative response ID and normal push navigation to `/transactions/:id`. This preserves the originating list URL, including filters, in browser history so the detail page's existing Back action can return to it. Do not add a success toast/banner, clear filters, encode table-local sorting or pagination in navigation state, change the backend/OpenAPI contract, or add a dependency.

## Phase 1: Replace free-form currency entry with enabled choices

### Workspace

.

### Goal

Make the manual-creation currency field a resilient native dropdown backed by enabled currency server state, with the selected display currency as its normal default and focused component coverage for loading, failure, retry, selection, submission, and pending behavior.

### Scope

`CreateTransactionDialog`, enabled-currency query integration, local draft/validation logic, and colocated component tests.

### Non-goals

Do not change post-create navigation in this phase, alter the global display-currency preference, add a custom dropdown/overlay, change currency administration, modify generated API specifications, or broaden the transaction request schema.

### Required context

- `docs/development.md#prerequisites`
- `docs/architecture.md`, especially strict CSP, overlays, and form/action conventions
- `docs/api-integration.md`, especially user-facing errors and manual transaction creation
- `docs/state-architecture.md`, especially TanStack Query and local form-state ownership
- `docs/react-hooks-lifecycle-mental-model.md`
- `docs/testing-guide.md`, especially MSW-backed component tests
- `docs/api/budget-analyzer-api.yaml` endpoint `GET /v1/currencies`, operation `createTransaction`, and their response/request schemas
- `src/hooks/useCurrencies.ts`, `src/components/CurrencySelector.tsx`, `src/features/transactions/components/CreateTransactionDialog.tsx`, and its colocated test

### Execution steps

1. Confirm Node.js 20+, npm 10+, required sibling repositories, and the current worktree state before editing. Preserve unrelated user changes and do not start Vite or Tilt.
2. Consume `useCurrencies(true)` in the creation dialog; rely on TanStack Query deduplication with the Transactions page's existing query rather than introducing copied server state or a direct Axios call.
3. Derive currency options during render: include `USD` exactly once and first, include only currency codes returned by the enabled-only query after that, deduplicate them, and sort non-USD codes alphabetically. Do not use an effect to mirror the query into draft state.
4. Replace the free-form currency `Input` and text-change normalization with a labeled native `select` styled consistently with the existing transaction-type select. Keep it disabled while either currency choices or the create mutation are pending. Use a loading option before first data arrives and persistent contextual query-error feedback with a named retry callback when no usable currency response exists.
5. Derive the effective initial selection from the caller-provided display currency after choices are available. Select it when present; otherwise select guaranteed `USD` so a stale or just-disabled preference cannot produce an out-of-list request. Keep later user selection in the existing local draft.
6. Disable form submission until currency choices are ready. Remove client behavior and tests that depend on typing or uppercasing arbitrary currency text, but retain server-side `TRANSACTION_CURRENCY_INVALID` handling because a currency can be disabled between query and submission. Preserve every other validation, trimming, optional-field omission, retry, and pending-dismissal contract.
7. Expand `CreateTransactionDialog` tests through the existing MSW/query boundary to prove USD plus enabled non-USD options, alphabetical deduplication, the selected display-currency default, USD fallback for a stale preference, user selection in the exact POST body, loading/submission gating, retryable currency-query failure, server rejection with selection preserved, and disabled controls while creation is pending.
8. Format only changed source and test files with the repository Prettier configuration and inspect the diff for effects, inline JSX handlers, `style` props, or accidental use of the custom overlay-based Select.

### Implementation notes

Treat `data !== undefined` as usable query completion so an empty enabled-currency array still yields the valid USD option. If a refetch fails while cached enabled data exists, keep the cached choices usable; reserve blocking error feedback for the first-load/no-data case. A small pure option builder may be extracted beside the component if it makes deduplication and ordering materially clearer, but do not create a cross-application abstraction for this one form.

The backend remains authoritative after submission. Restricting the UI to the last enabled-currency snapshot improves normal input but cannot eliminate the existing 422 race, so the dialog must continue to preserve the draft and render normalized mutation feedback.

### Validation

Run:

```bash
npx vitest run src/features/transactions/components/__tests__/CreateTransactionDialog.test.tsx
npm run lint:fix
npm run build:bundle
git diff --check
```

### Completion criteria

The creation dialog no longer accepts free-form currency text; it renders deterministic enabled choices, defaults to the valid selected display currency, falls back safely to USD only for stale state, blocks submission when choices cannot be loaded, preserves mutation failure/pending behavior, and passes its focused tests and production-source checks.

## Phase 2: Navigate successful creation to transaction detail

### Workspace

.

### Goal

Make the created transaction's detail page the visible success result, remove list-level creation feedback that is no longer needed, and update durable navigation/API documentation and route-aware tests.

### Scope

Transactions-page success handling, the creation-dialog success callback contract, route/history behavior, page and component tests, and durable Architecture, API Integration, and State Architecture documentation.

### Non-goals

Do not change the create endpoint or mutation cache strategy, use the response `Location` header as a browser route, replace browser history with Redux, persist table-local sorting/pagination, add a generic success message, change detail-page editing/deletion behavior, or alter import success feedback.

### Required context

- `docs/architecture.md`, especially Transactions-page actions and navigation
- `docs/api-integration.md#manual-transaction-creation`
- `docs/state-architecture.md#navigation-context`
- `docs/testing-guide.md`, especially route-aware component tests
- `src/hooks/useTransactions.ts`, especially `useCreateTransaction` detail-cache seeding
- `src/features/transactions/pages/TransactionsPage.tsx` and its tests
- `src/features/transactions/components/CreateTransactionDialog.tsx` and its tests
- `src/features/transactions/pages/TransactionDetailPage.tsx`
- `src/components/BackButton.tsx` and its tests

### Execution steps

1. Recheck prerequisites and `git status --short`, then verify that `useCreateTransaction` still writes the authoritative response into `transactionKeys.detail(createdTransaction.id)` before component-level success callbacks run. Keep that cache contract unchanged.
2. Add a memoized Transactions-page success handler that receives the authoritative created transaction and calls normal push navigation to `/transactions/${createdTransaction.id}`. Do not use `replace`, discard the response ID, clear the current search parameters, or add redundant `returnTo` parameters; the originating list URL must remain in browser history.
3. Remove `createTransactionMessage`, its dismiss callback, and its `MessageBanner`. Active filters, local sorting, and pagination no longer determine whether success is understandable because the detail route renders the created object.
4. Make success ownership unambiguous between dialog and page: after the mutation succeeds, invoke `onCreated(createdTransaction)` and let the page's navigation unmount the dialog; keep `onClose` for Cancel, Escape, backdrop, and other non-success dismissal. Avoid a second state update after navigation.
5. Update dialog tests for the revised callback contract. Update Transactions-page tests with a route-aware harness or location probe that asserts successful creation reaches `/transactions/101`, including when the originating list URL has active filters. Prove the old filtered-success status is absent, permission/import behavior remains unchanged, and browser Back returns to the exact prior filtered URL. Do not assert preservation of component-local table sorting or pagination after remount.
6. Update `docs/architecture.md` to say manual creation opens over the Transactions page and success navigates to the created transaction detail while retaining the list URL in history. Preserve the existing single-primary-action and permission contracts.
7. Update `docs/api-integration.md` to replace free-form currency normalization and close-in-place/filtered-banner wording with enabled-choice behavior, first-load query handling, retained 422 race handling, cache-seeded detail navigation, and no automatic saved-view membership.
8. Update `docs/state-architecture.md` only at the durable navigation boundary: record that post-create detail navigation relies on URL/browser history and existing TanStack Query detail data, not Redux or copied transaction state.
9. Format only changed source/test files, format touched Markdown without unrelated churn, verify changed relative links and anchors, and inspect the complete phase diff.

### Implementation notes

Use the response body's numeric ID to construct the SPA route; the API's `Location` header describes the API resource and is not required for client routing. Detail rendering should normally avoid a follow-up request because the mutation hook seeds the exact detail query before its caller-level callback. Existing query behavior remains the fallback if that cache entry is absent.

Normal push navigation preserves URL-backed list filters in browser history. Table sorting and pagination intentionally remain local component mechanics and reset after the Transactions page unmounts; do not expand this fix into new URL or global state.

### Validation

Run:

```bash
npx vitest run \
  src/features/transactions/components/__tests__/CreateTransactionDialog.test.tsx \
  src/features/transactions/pages/__tests__/TransactionsPage.test.tsx \
  src/components/__tests__/BackButton.test.tsx
npm run lint:fix
npm run build:bundle
git diff --check
```

Manually verify each changed documentation link resolves to an existing file and anchor.

### Completion criteria

Every successful manual creation navigates to the authoritative transaction detail route, the previous list URL remains reachable through Back, list visibility no longer controls success feedback, obsolete creation-banner state is removed, route-aware regression tests pass, and durable documentation describes the new behavior.

## Phase 3: Update browser coverage and complete repository validation

### Workspace

.

### Goal

Exercise the currency dropdown and post-create detail navigation in the fail-closed production-smoke browser workflow, update the testing inventory, and complete all repository-required validation available in the user-managed environment.

### Scope

Manual-creation Playwright fixtures/scenario/spec, Testing Guide coverage notes, formatting, E2E type checking, full production build, production-smoke CSP scan, and conditional external browser execution.

### Non-goals

Do not start Tilt, Vite, NGINX, or another server; weaken fail-closed request checks or CSP assertions; add mobile/cross-browser coverage; change package manifests; or add unrelated dropdown/overlay tests.

### Required context

- `docs/development.md#production-smoke-build-and-dropdown-gate`
- `docs/architecture.md#content-security-policy`
- `docs/testing-guide.md#external-browser-harness`
- `e2e/csp/manual-transaction-creation.spec.ts`
- `e2e/fixtures/data.ts`, `e2e/fixtures/scenarios.ts`, and the fail-closed browser mock helpers
- Repository-root `AGENTS.md` validation and user-managed-runtime rules

### Execution steps

1. Recheck prerequisites and worktree state. Inspect the current browser fixture response IDs and route mocks before changing the scenario.
2. Give the transaction-page browser scenario at least one deterministic enabled non-USD currency in addition to implicit USD so the test can assert that the form exposes server-backed choices. Keep every request caused by list and detail rendering explicitly mocked or prove it is satisfied from the query cache.
3. Update the manual-creation CSP workflow to assert that Currency is a native select, USD is selected by default when it is the current display currency, and the enabled fixture currency is offered. Keep the exact POST payload assertion, blank-metadata omission, in-flight disabled state, and blocked Cancel/backdrop/Escape dismissal checks.
4. After releasing the create response, assert that the dialog unmounts, the URL is `/transactions/<created-id>`, and the detail page renders the authoritative created transaction including missing metadata markers. Remove the obsolete trigger-focus and created-table-row assertions. Optionally exercise the existing Back action to prove it returns to the originating list URL, but do not duplicate route-history coverage already made deterministic in Vitest.
5. Preserve fail-closed unexpected-request assertions and take the CSP snapshot after detail navigation so the workflow covers dialog open, native-select interaction, pending submission, unmount, route transition, and detail rendering.
6. Update `docs/testing-guide.md` to describe enabled-currency selection and post-create detail navigation in the current browser coverage and to remove active-filter feedback from the stated remaining limits. Keep the desktop/single-browser and server-failure limitations honest.
7. Format only changed application/E2E files with the repository Prettier configuration. Run `npm run lint:fix` and `npm run typecheck:e2e` because `e2e/` changed.
8. Run `npm run build`, which includes full coverage, TypeScript, and the standard production bundle. Then run `npm run build:prod-smoke` to build the externally audited base path and execute the static dropdown/CSP scan. Confirm `package.json` and `package-lock.json` remain unchanged.
9. Before browser execution, verify the locked Chromium installation, a healthy user-managed Tilt stack at `https://app.budgetanalyzer.localhost/_prod-smoke/`, and trusted local CA as required by the Testing Guide. Do not start or repair that environment on the user's behalf.
10. When those external prerequisites are available, run `npm run test:e2e:csp` and investigate every failure. If they are unavailable, report the exact missing prerequisite and state that external browser/CSP verification was not run.
11. Finish with `git diff --check`, review the entire worktree diff for unrelated changes, and report behavior, validation evidence, and any unavailable browser gate without committing or performing other git write operations.

### Implementation notes

Keep the browser scenario deterministic and fail closed. If selecting a non-USD transaction currency would trigger exchange-rate requests after cache update/detail navigation, either register the exact required exchange-rate fixtures or leave USD selected in this one browser workflow and cover non-default selection in the focused component test. Do not allow requests to escape merely to simplify the test.

Because the new control is a native select and no overlay implementation changes, no new dropdown dependency or runtime stylesheet capability should appear. The production-smoke build and existing CSP observer still provide regression evidence for the complete modal-to-route workflow.

### Validation

Run:

```bash
npm run lint:fix
npm run typecheck:e2e
npm run build
npm run build:prod-smoke
npm run test:e2e:csp
git diff --check
git status --short
```

The browser command is conditional on the documented user-managed environment and trusted local CA. Record it explicitly as not run, with the blocking prerequisite, rather than claiming complete verification when unavailable.

### Completion criteria

The fail-closed browser workflow covers the enabled-currency dropdown and cache-backed transition to the created detail page, the testing inventory is current, local lint/type/coverage/build/CSP-scan gates pass, package manifests are unchanged, and external browser results or their exact environmental blocker are reported honestly.
