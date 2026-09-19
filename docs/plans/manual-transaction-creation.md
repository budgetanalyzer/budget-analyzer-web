# Manual Transaction Creation Plan

Add permission-gated manual transaction entry to the Transactions page for cash and other transactions that do not come from statement import, while making every transaction surface safe when bank or account metadata is absent. The implementation must follow the generated contract in [the unified API specification](../api/budget-analyzer-api.yaml), preserve the user's existing specification change, and keep request state in TanStack Query and transient form state in the dialog.

This plan uses the following product assumptions: manual entry opens a modal over the Transactions page; the existing file-import control remains the page's primary action and `Create transaction` is an adjacent secondary action; new forms default to `DEBIT`, the current LocalDate, and the selected display currency; blank bank and account fields are omitted from the request; and successful creation closes the dialog without a generic success toast. If active list filters can hide the new row, the page instead shows a persistent, dismissible status explaining that outcome.

The OpenAPI 3.1 schema currently describes absent `bankName` and `accountId` response properties by removing them from `required`, while the feature request describes `bankName` as nullable. Frontend response types and renderers should therefore tolerate omitted properties and explicit `null` defensively, but the request adapter must continue to send the documented shape. Do not add a route, Redux state, dependency, toast system, cross-repository workaround, or duplicate-suppression behavior.

## Phase 1: Make optional transaction metadata safe across the application

### Workspace

.

### Goal

Align frontend transaction models and all current-user, saved-view, and administrative transaction surfaces with responses that may not contain bank or account metadata, without introducing bogus filter values or runtime failures.

### Scope

Transaction response types, shared missing-metadata presentation, bank/account filter-option derivation, transaction list and detail presentation, saved-view transaction presentation and transfer/refund review, administrative transaction search presentation, and focused regression tests.

### Non-goals

Do not add manual creation transport or UI, change statement-format bank requirements, change import preview/request types whose bank name remains required by their own schemas, alter URL filter contracts, or modify the generated OpenAPI file.

### Required context

- `docs/development.md#prerequisites`
- `docs/api-integration.md`, especially collection validation and selected-currency contracts
- `docs/architecture.md`, especially application structure and action/presentation conventions
- `docs/state-architecture.md`, especially transaction and saved-view filter ownership
- `docs/testing-guide.md`, especially test placement and MSW guidance
- `docs/api/budget-analyzer-api.yaml` schemas `TransactionResponse` and `PagedResponseTransactionResponse`
- `src/types/transaction.ts`, `src/types/transactionSearch.ts`, and every production `bankName`/`accountId` consumer found with `rg`

### Execution steps

1. Confirm Node.js 20+ and npm 10+, inspect `git status --short`, and preserve the existing `docs/api/budget-analyzer-api.yaml` change without rewriting or formatting it.
2. Change the ordinary and administrative transaction response models so `bankName` and `accountId` accept omitted and `null` values. Keep statement-format and import-preview models unchanged unless their own OpenAPI schemas independently permit absence.
3. Add a small shared transaction-metadata utility under `src/utils/` that turns a nullish or blank display value into the repository's missing-value marker (`—`) and derives sorted unique filter choices while excluding nullish or blank metadata. Keep filtering semantics exact and do not invent a selectable `Unknown` bank/account category.
4. Apply the shared behavior to the Transactions page and row, transaction detail account card, saved-view page and tables, add-transactions picker, transfer/refund review rows, and administrative transaction search table. Guard string operations such as `length`, `slice`, sorting, and truncation so a manual transaction with neither optional field remains usable everywhere.
5. Retain the existing transfer/refund candidate rule that missing identity metadata is ambiguous rather than equal; add or adjust utility coverage only where the widened types expose a real product edge case.
6. Update colocated fixtures and behavior tests to include transactions with omitted and explicit-null metadata. Assert the visible missing-value marker, omission from dynamic filter choices, non-crashing admin account rendering, and continued filter/candidate semantics; avoid tests that merely restate TypeScript optionality.
7. Format only changed source and test files with the repository Prettier configuration, then inspect the diff for accidental statement-format/import contract widening.

### Implementation notes

The OpenAPI response does not require either metadata property, so frontend code must not normalize absence into an empty bank filter option. A shared formatter prevents list, detail, saved-view, review, and admin surfaces from developing different labels. `findTransferRefundCandidates` already normalizes `null | undefined` to an ambiguous identity; preserve that behavior. Keep `Transaction.description`, `date`, `currencyIsoCode`, amount, type, and timestamps required.

### Validation

Run focused Vitest files covering the changed utility and affected transaction surfaces, including at minimum:

```bash
npm test -- --run \
  src/utils/__tests__/transactionFilters.test.ts \
  src/features/transactions/pages/__tests__/TransactionsPage.test.tsx \
  src/features/transactions/components/__tests__/TransactionTable.test.tsx \
  src/features/transactions/pages/__tests__/TransactionDetailPage.test.tsx \
  src/features/views/utils/__tests__/findTransferRefundCandidates.test.ts \
  src/features/views/components/__tests__/ViewTransactionTable.test.tsx \
  src/features/views/components/__tests__/ViewTransactionPicker.test.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx \
  src/features/admin/transactions/components/__tests__/TransactionSearchTable.test.tsx
npm run lint:fix
npm run build:bundle
git diff --check
```

If a listed test file does not yet exist, create it beside its production owner when that surface needs direct regression coverage; otherwise cover the behavior at the nearest existing page/component boundary and run that file instead.

### Completion criteria

The application type-checks with nullish bank/account response metadata, every affected surface renders an intentional missing-value marker instead of blank text or crashing, dynamic filters contain only meaningful values, transfer/refund matching remains conservative, focused tests pass, and the existing OpenAPI edit remains untouched.

## Phase 2: Add the create mutation and accessible manual-entry dialog

### Workspace

.

### Goal

Implement the documented `POST /v1/transactions` request, cache integration, validation/error mapping, and a tested feature-owned dialog that can create one manual transaction.

### Scope

Create-request types, transaction API adapter, TanStack Query mutation, current-LocalDate helper if needed, application error-code mapping, manual-entry dialog, and focused API/hook/component tests through the real Axios/MSW boundary.

### Non-goals

Do not place the dialog on the page yet, add a route, save draft state outside the component, call Axios from the component, use `mutateAsync`, add duplicate detection, restrict currency to only configured exchange-rate series, or add dependencies.

### Required context

- `docs/development.md#prerequisites`
- `docs/api-integration.md`, especially shared client, user-facing error messages, and TanStack Query boundaries
- `docs/state-architecture.md`
- `docs/react-hooks-lifecycle-mental-model.md`
- `docs/architecture.md`, especially dialog accessibility, pending-mutation dismissal, action hierarchy, and CSP rules
- `docs/testing-guide.md`, especially API-facing component tests
- `docs/api/budget-analyzer-api.yaml` operation `createTransaction` and schema `CreateTransactionRequest`
- Existing mutation/dialog references in `src/hooks/useTransactions.ts`, `src/components/CreateViewModal.tsx`, and `src/components/ui/Dialog.tsx`

### Execution steps

1. Recheck the development prerequisites and worktree before editing. Define `CreateTransactionRequest` in `src/types/transaction.ts` with the five required request properties and optional bank/account properties, preserving a positive unsigned amount whose direction comes exclusively from `type`.
2. Add `transactionApi.createTransaction` using `POST /v1/transactions` and the returned `Transaction`. Reconstruct or normalize the outgoing object so trimmed blank optional metadata is omitted rather than serialized as empty strings, `null`, or unrelated form state.
3. Add `useCreateTransaction` to the transaction hooks. On success, place the authoritative response in the transaction detail cache, insert or replace it by ID in an already-populated transaction-list cache for immediate UI convergence, and invalidate transaction-count queries. Do not invalidate saved-view membership because a new transaction is not automatically a member of a static view.
4. Add `TRANSACTION_CURRENCY_INVALID` to `src/utils/errorMessages.ts` with user-facing copy and tests, retaining the existing date-too-old and date-too-far-in-future mappings.
5. If the form defaults its date to today, add and test a LocalDate helper in `src/utils/dates.ts`; do not construct or format dates outside that module.
6. Create `src/features/transactions/components/CreateTransactionDialog.tsx` as a controlled, conditionally mounted dialog. Keep all draft values and client validation local to the component; use named callbacks, synchronous components, and `mutate(request, { onSuccess, onError })`.
7. Build labeled fields for date, description, positive amount, currency ISO code, CREDIT/DEBIT type, optional bank name, and optional account ID. Default type to `DEBIT`, date to the current LocalDate, and currency to the caller-provided display currency. Uppercase and validate the currency as exactly three letters, accept only finite amounts greater than zero without assuming two decimal places, enforce the schema's maximum string lengths, trim text for submission, preserve the schema's permitted empty description, and omit blank optional metadata.
8. Keep a normalized mutation error in a persistent `MessageBanner` inside the dialog and preserve all draft input after failure. While the request is pending, disable fields and actions, prevent duplicate submission, pass `dismissible={false}`, and disable Cancel. On success, invoke the caller with the created transaction and close; do not show a toast.
9. Add MSW-backed component tests that submit the exact JSON shape, verify defaults and optional-field omission, exercise CREDIT and DEBIT selection, reject invalid/zero amounts and malformed currencies before transport, map a 422 application code, preserve input after failure, and prove backdrop/Escape/Cancel cannot dismiss a pending request. Add API and hook tests for method/path/payload, list/detail cache updates, count invalidation, ID deduplication, and no saved-view invalidation.
10. Format only changed source and test files, then review the code for inline JSX functions, direct date imports, React `style` props, runtime stylesheet behavior, and unsupported effect-based state synchronization.

### Implementation notes

The request's `description` property is required but has `minLength: 0`; include it even when empty instead of adding an undocumented non-empty rule. Use `step="any"` or equivalent numeric handling because ISO currencies have different minor-unit conventions and the API schema does not impose two decimal places. Currency entry should accept any syntactically valid three-letter code and let the backend return `TRANSACTION_CURRENCY_INVALID`; the enabled exchange-rate list is not the ISO 4217 catalogue. The returned transaction, not the draft, is authoritative for the cache.

### Validation

Run focused tests and production-source checks:

```bash
npm test -- --run \
  src/api/__tests__/transactionApi.test.ts \
  src/hooks/__tests__/useTransactions.test.tsx \
  src/utils/__tests__/dates.test.ts \
  src/utils/__tests__/errorMessages.test.ts \
  src/features/transactions/components/__tests__/CreateTransactionDialog.test.tsx
npm run lint:fix
npm run build:bundle
git diff --check
```

### Completion criteria

The adapter sends the exact manual-create contract, the hook converges list/detail/count caches without changing saved-view membership, the dialog is accessible and cannot be dismissed mid-request, validation matches rather than narrows the schema, errors remain contextual with the draft intact, and all focused checks pass.

## Phase 3: Integrate creation into the Transactions page and document the contract

### Workspace

.

### Goal

Expose the manual-entry workflow from the Transactions page under the correct permission, provide clear filtered-result feedback, and record the durable frontend behavior.

### Scope

Transactions-page action composition and dialog state, permission gating, success feedback, page/component tests, API-integration documentation, and architecture action-hierarchy documentation.

### Non-goals

Do not add global navigation, an admin create flow, a detail-page redirect, a generic success toast, automatic filter clearing, saved-view membership changes, or changes to role-based layout selection.

### Required context

- `docs/architecture.md`, especially navigation/action hierarchy, dialog behavior, and CSP
- `docs/authentication.md#permissions-are-for-actions-and-features`
- `docs/api-integration.md#user-facing-error-messages`
- `docs/state-architecture.md#url-backed-route-state`
- `docs/testing-guide.md`
- `src/features/transactions/pages/TransactionsPage.tsx` and its tests
- `src/features/transactions/components/ImportButton.tsx`

### Execution steps

1. Recheck prerequisites and worktree state, then add Transactions-page component state and named callbacks to open and close the conditionally mounted creation dialog. Pass the current display currency as the form default without copying it into Redux or URL state.
2. Gate both import and manual creation with the existing unscoped `transactions:write` permission. Render no trigger and do not mount the dialog when permission is absent so no mutation-capable subtree is exposed.
3. Compose the page-header actions as a responsive group with one primary action: retain the existing primary `Import Transactions` control and add an outline `Create transaction` button. Keep visible labels sentence case where touched, and preserve the import workflow's current behavior and callbacks.
4. On creation success, rely on the mutation hook's authoritative cache update and close the dialog. When any transaction-list filter is active, show a persistent dismissible status such as `Transaction created. Active filters may hide it from this list.` Do not clear URL filters automatically; when no filter is active, the changed table is the success feedback.
5. Expand `TransactionsPage` tests to verify `transactions:write` shows both actions, missing permission shows neither, opening/closing restores the trigger workflow, the selected display currency reaches the dialog, success updates/uses the page callback, and only filtered creation produces the contextual status. Keep import success/error behavior intact.
6. Add a manual-creation subsection to `docs/api-integration.md` documenting request normalization, positive amount plus direction, optional metadata, mutation cache effects, no automatic saved-view membership, 422 error handling, and filtered-success feedback.
7. Update `docs/architecture.md` to record the Transactions-page action hierarchy and modal placement at the durable behavior level. Do not add a component walkthrough. Review `docs/authentication.md` and `docs/state-architecture.md`; change them only if implementation reveals a new durable contract not already covered by `transactions:write` and component-local form state.
8. Format changed source/tests and Markdown as appropriate, verify all new relative links and anchors, and inspect the complete diff for unrelated documentation churn.

### Implementation notes

`usePermission` must remain at a hook-safe top-level call site. The dialog should be conditionally mounted after the permission check and only while open, which gives each opening fresh defaults without an effect that mirrors props into state. Existing URL filters remain authoritative and may intentionally exclude the new transaction. The filtered-result message communicates that non-obvious outcome without introducing a transient toast.

### Validation

Run the dialog and page workflow tests plus affected existing import tests, then the standard production checks for the phase:

```bash
npm test -- --run \
  src/features/transactions/components/__tests__/CreateTransactionDialog.test.tsx \
  src/features/transactions/pages/__tests__/TransactionsPage.test.tsx \
  src/features/transactions/components/__tests__/TransactionPreviewModal.test.tsx
npm run lint:fix
npm run build:bundle
git diff --check
```

Manually verify every new or changed documentation link resolves to an existing file/anchor.

### Completion criteria

Authorized users can open manual entry from the Transactions page while unauthorized users cannot mount it, import remains the single primary action, filtered successes are explained without clearing user state, unfiltered successes are visible through the updated table, existing import behavior still passes, and durable API/action contracts are documented.

## Phase 4: Add browser CSP coverage and run final validation

### Workspace

.

### Goal

Exercise the new modal workflow under the strict production CSP, update browser-test documentation, and finish with all repository-required validation or an explicit account of any unavailable user-managed verifier.

### Scope

Playwright fixture data/scenarios, one exact manual-create CSP workflow, Testing Guide coverage notes, formatting/type checking, static CSP scan, full application build, and external browser audit.

### Non-goals

Do not start Tilt, Vite, NGINX, or another server; weaken CSP/fail-closed request handling; add allowlists for findings; broaden the test into unrelated mobile/cross-browser coverage; or alter package manifests/lockfiles.

### Required context

- `docs/development.md#production-smoke-build-and-dropdown-gate`
- `docs/architecture.md#content-security-policy`
- `docs/testing-guide.md#external-browser-harness`
- Existing `e2e/csp/transaction-dialog.spec.ts`, `e2e/csp/view-add-transactions.spec.ts`, and `e2e/fixtures/`
- Repository root `AGENTS.md` validation and user-managed-runtime rules

### Execution steps

1. Recheck Node/npm prerequisites and worktree state. Inspect the existing fail-closed browser fixtures and reuse their exact-response, deferred-response, focus-restoration, and CSP-observation patterns.
2. Add deterministic created-transaction fixture data and a scenario-owned deferred `POST /api/v1/transactions` response. Include an authoritative response with absent bank/account metadata so the browser workflow also verifies the Phase 1 rendering contract.
3. Add a focused CSP spec for an authenticated user with `transactions:read` and `transactions:write`. Open `Create transaction`, fill deterministic values, submit, assert the exact positive-amount/type JSON payload and omission of blank metadata, and verify pending submission disables Cancel/submit and blocks backdrop/Escape dismissal.
4. Release the response, then verify the dialog closes, focus returns to the trigger, and the created transaction appears with intentional missing-metadata markers. Assert no unexpected protected requests, CSP violations, runtime-added stylesheets, or final `<style>` elements.
5. Update the Testing Guide's current browser-coverage inventory to name the manual-create dialog's exact pending/success/focus/CSP coverage and its remaining limits.
6. Format only changed application/E2E files, run `npm run lint:fix`, and run `npm run typecheck:e2e` because `e2e/` changed.
7. Run `npm run build`; this is the required final production gate and includes full coverage, TypeScript, and the standard bundle. Then run `npm run build:prod-smoke` so the emitted production-smoke assets receive the static dropdown/CSP capability scan. Confirm `package.json` and `package-lock.json` remain unchanged.
8. Before browser execution, verify installed Chromium with `npx playwright install --list`, ask the user for a healthy workstation-owned Tilt stack serving `https://app.budgetanalyzer.localhost/_prod-smoke/`, and verify local CA trust with `check-budget-analyzer-local-ca-trust`. Do not start the environment or disable certificate verification.
9. When the user-managed prerequisites are available, run `npm run test:e2e:csp` and investigate every finding rather than accepting or allowlisting it. If they are unavailable, stop browser validation, report the exact missing prerequisite, and state that the feature is not fully browser/CSP verified even if all local gates pass.
10. Finish with `git diff --check`, review the complete diff and test output, and report changed behavior, validation evidence, and any browser-environment limitation without committing or performing another git write operation.

### Implementation notes

The browser mock layer is deliberately fail-closed, so register every request caused by the workflow and do not let protected traffic reach real services. Prefer a new focused spec over overloading the bulk-delete dialog test. The CSP snapshot must be taken after success rendering so it covers open, pending, close, focus restoration, and the updated table. `npm run build:prod-smoke` replaces `dist/`; run it before the externally managed production-smoke route audit.

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

The new manual-create modal has deterministic fail-closed browser coverage through pending success and focus restoration, the strict CSP observer is clean, browser-coverage documentation is current, all applicable local gates pass, package manifests are unchanged, and any unavailable external browser gate is clearly reported.
