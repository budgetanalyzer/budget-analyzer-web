# Remove Transient Toasts and Localize Mutation Feedback

Remove the global transient-toast system from the application. Keep obvious
successful direct manipulations silent, discard nonessential result and
currency-change notices, move actionable mutation failures to persistent
contextual alerts that preserve the user's work, and replace the heartbeat
toast with a stable application-level session-connectivity warning. Preserve
the existing import-result banner because its counts and filter consequences
are not obvious from the refreshed table.

## Phase 1: Localize Create-View and Single-Deletion Failures

### Workspace

.

### Goal

Replace the create-view and single-transaction deletion error toasts with
persistent alerts inside their initiating dialogs while preserving successful
closure, navigation, and cache behavior.

### Scope

- Add contextual mutation-error state to `CreateViewModal` and
  `DeleteTransactionModal`.
- Preserve the saved-view name and transaction context after failure.
- Keep both dialogs open after failure and support dismiss and retry.
- Retain the saved-view stale-snapshot instruction and normalized API error
  copy.
- Update the two colocated component suites through the real mutation hooks and
  MSW.

### Non-goals

- Do not add success feedback; successful creation still closes and navigates
  to the new view, and successful deletion still closes and removes or leaves
  the transaction workflow normally.
- Do not use the page-oriented `ErrorBanner` inside either dialog.
- Do not change create-view membership selection, filter cleanup, deletion
  invalidation, confirmation copy, permissions, or pending-dismissal behavior.
- Do not remove the shared toast infrastructure in this phase.

### Required context

- Read the repository `AGENTS.md`, finding 2 in
  `docs/issues/view-dialog-notification-consistency-audit.md`,
  `docs/api-integration.md#user-facing-error-messages`,
  `docs/state-architecture.md`, `docs/react-hooks-lifecycle-mental-model.md`,
  and `docs/testing-guide.md` before editing.
- Read `docs/development.md#prerequisites` and stop if its Node.js, npm, or
  sibling-repository requirements are not satisfied.
- Read the create-view and delete-transaction operations and error responses in
  `docs/api/budget-analyzer-api.yaml` before changing API-facing tests.
- Reuse the accessible `MessageBanner` contract: mutation errors are atomic
  `role="alert"` messages with an always-visible dismiss control.

### Execution steps

1. Inspect both dialogs, their mounting parents, mutation hooks, and current
   tests to preserve their close, success, invalidation, and navigation
   boundaries.
2. Add local `string | null` mutation-error state and memoized dismiss, close,
   and submit handlers to `CreateViewModal`; clear stale feedback immediately
   before retry or close, preserve the entered name on failure, and render the
   alert above the footer.
3. Preserve the special `SAVED_VIEW_MEMBERSHIP_STALE` instruction in the
   create-view alert and use `formatApiError` for other failures.
4. Apply the same local failure contract to `DeleteTransactionModal`, using
   `formatApiError` with an action-specific fallback and keeping the
   transaction summary available after failure.
5. Remove toast imports and toast mocks from these components and suites; add
   MSW workflows covering normalized failure copy, preserved context,
   dismissal, retry, and later success without a success message.
6. Inspect the diff for unrelated request, layout, permission, or lifecycle
   changes.

### Implementation notes

Store only the formatted message in component state; TanStack Query continues
to own mutation and server state. Clear the message from event and mutation
callbacks rather than an effect. Closing either dialog may discard its local
error, but a failed request must not clear the name, close the dialog, invoke a
success callback, or navigate.

### Validation

Format only the changed source and tests with the repository Prettier
configuration, then run:

```bash
npx prettier --write \
  src/components/CreateViewModal.tsx \
  src/components/__tests__/CreateViewModal.test.tsx \
  src/features/transactions/components/DeleteTransactionModal.tsx \
  src/features/transactions/components/__tests__/DeleteTransactionModal.test.tsx
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/components/__tests__/CreateViewModal.test.tsx \
  src/features/transactions/components/__tests__/DeleteTransactionModal.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- Create-view and single-deletion failures are persistent and contextual, emit
  no toast, preserve user context, and support dismiss and retry.
- Their success paths remain silent and retain existing closure, navigation,
  callback, request, and invalidation behavior.
- Focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 2: Localize Transaction Detail Edit Failures

### Workspace

.

### Goal

Replace the transaction-detail edit error toast with a persistent alert beside
the edit controls while retaining both draft fields and edit mode after a
failed save.

### Scope

- Add local mutation-error feedback to `TransactionDetailPage`.
- Clear a prior error when dismissed, retried, cancelled, or successfully
  saved.
- Preserve description and account-ID drafts after failure.
- Update the page behavior tests through MSW and the real update hook.

### Non-goals

- Do not change transaction loading errors, delete behavior, permissions,
  display-amount presentation, routing, or mutation invalidation.
- Do not add success feedback or field validation unrelated to the API
  response.
- Do not copy the error into Redux, URL state, or TanStack Query cache data.

### Required context

- Re-read the repository `AGENTS.md`,
  `docs/api-integration.md#user-facing-error-messages`,
  `docs/state-architecture.md`, `docs/react-hooks-lifecycle-mental-model.md`,
  and `docs/testing-guide.md`.
- Read the update-transaction operation in
  `docs/api/budget-analyzer-api.yaml` and inspect the page's existing load,
  edit, and delete error boundaries.
- Reuse `MessageBanner` and `formatApiError`; keep query/load failures in
  `ErrorBanner`.

### Execution steps

1. Inspect `TransactionDetailPage`, its update hook, and its page suite to
   confirm the current draft, cancel, success, and failure behavior.
2. Add local formatted mutation-error state, clear it before a save attempt,
   and set it from the mutation `onError` callback without leaving edit mode.
3. Render the error near the edit controls and expose memoized dismiss and
   cancel behavior that does not accidentally alter the drafts before the user
   chooses to cancel.
4. Replace toast assertions with user-visible alert assertions covering draft
   retention, dismissal, retry, and a successful retry that exits edit mode
   with updated data.
5. Confirm unrelated detail loading and transaction deletion tests remain
   intact.

### Implementation notes

The unchanged draft fields do not prove persistence: they are only local edits
until the server accepts the mutation. The alert must explicitly distinguish a
failed save from a successful one. Continue using synchronous components and
TanStack Query mutation callbacks.

### Validation

```bash
npx prettier --write \
  src/features/transactions/pages/TransactionDetailPage.tsx \
  src/features/transactions/pages/__tests__/TransactionDetailPage.test.tsx
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/features/transactions/pages/__tests__/TransactionDetailPage.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- A failed detail edit keeps edit mode and both drafts available with a
  persistent normalized alert and no toast.
- Dismiss, cancel, retry, and successful retry behavior is covered without
  changing query-load or delete behavior.
- Focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 3: Preserve Inline Transaction Edits Through Mutation Completion

### Workspace

.

### Goal

Fix inline editing so a row exits edit mode only after server success and shows
a persistent row-scoped alert while retaining its draft values after failure.

### Scope

- Change the `EditableTransactionRow` save contract so the parent mutation can
  report success or formatted failure to the initiating row.
- Keep edit mode and both draft fields after failure.
- Render a full-width alert row immediately beneath the edited transaction.
- Clear the alert before retry and when editing is cancelled.
- Add integration-style `TransactionTable` coverage through MSW and the real
  update hook.

### Non-goals

- Do not change row navigation, selection, permissions, column-width
  conventions, table overflow, sorting, pagination, or display-amount logic.
- Do not optimistically overwrite server transaction data.
- Do not render a React `style` prop or hide the shared table scrollbar.
- Do not add a global or table-wide mutation-error store.

### Required context

- Re-read the repository `AGENTS.md`,
  `docs/api-integration.md#user-facing-error-messages`,
  `docs/state-architecture.md`, `docs/react-hooks-lifecycle-mental-model.md`,
  `docs/architecture.md#content-security-policy`, and
  `docs/testing-guide.md`.
- Inspect `EditableTransactionRow`, `TransactionTable`, their mutation hook,
  column composition, and current tests before changing the callback contract.
- Read the update-transaction operation and errors in
  `docs/api/budget-analyzer-api.yaml`.

### Execution steps

1. Define the smallest typed save-callback contract that lets the row close on
   mutation success and receive normalized error text on failure without
   returning a promise to the component.
2. Move edit cleanup out of the immediate submit path and invoke it only for a
   no-change submission, explicit cancel, or mutation success.
3. Add row-local formatted error state and render a semantic table row directly
   below the edited transaction with a `MessageBanner`; derive the static
   `colSpan` from the table's visible column composition rather than using
   runtime styles.
4. Update `TransactionTable` to call `formatApiError` in the mutation failure
   callback and remove its toast dependency.
5. Add or update tests proving the request payload, retained edit mode and
   drafts, alert dismissal, successful retry, and eventual display of accepted
   server data.
6. Check table markup, keyboard submission and cancellation, selection, and
   row-click tests for regressions.

### Implementation notes

Keep the mutation in `TransactionTable`; the row owns only transient draft and
message state. Do not use `mutateAsync`. A fragment containing the transaction
row and conditional alert row is valid, but the alert must be inside table
cells and its column span must cover every currently rendered column.

### Validation

Format the exact changed files, including a new colocated row suite if one is
introduced, then run:

```bash
npx prettier --write \
  src/features/transactions/components/EditableTransactionRow.tsx \
  src/features/transactions/components/TransactionTable.tsx \
  src/features/transactions/components/__tests__/TransactionTable.test.tsx
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/features/transactions/components/__tests__/TransactionTable.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- Inline editing remains open with both drafts and a row-local persistent alert
  after failure.
- The row closes only after no-change submission, explicit cancellation, or
  successful mutation, and no toast is emitted.
- Table structure and adjacent interaction behavior remain valid and focused
  tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 4: Localize Reviewed Import Failures

### Workspace

.

### Goal

Move reviewed batch-import failures into the review dialog while retaining all
edited preview rows, and preserve the existing post-success result banner on
the transactions page.

### Scope

- Add a persistent mutation-error `MessageBanner` immediately above the review
  dialog footer.
- Keep the dialog and edited preview open after failure.
- Clear the error when dismissed, retried, or the dialog closes.
- Preserve `onImportComplete` and the existing page-level success/result
  message with created, skipped, duplicate, and filter information.
- Update the preview modal suite through MSW and the real batch-import hook.

### Non-goals

- Do not change preview-query failures, duplicate warnings, preview editing,
  import payloads, counts, success copy, filters, or footer positioning.
- Do not remove or shorten the transactions-page import result banner.
- Do not add a replacement success message inside the dialog.

### Required context

- Re-read the repository `AGENTS.md`, finding 2 and the notification inventory,
  `docs/api-integration.md#transaction-import-review-contracts`,
  `docs/state-architecture.md`, `docs/react-hooks-lifecycle-mental-model.md`,
  `docs/architecture.md#content-security-policy`, and
  `docs/testing-guide.md`.
- Read the batch-import operation and documented error codes in
  `docs/api/budget-analyzer-api.yaml`.
- Inspect `TransactionPreviewModal`, `TransactionsPage`, and
  `useImportMessageHandler` so failure and successful result feedback remain
  distinct.

### Execution steps

1. Add local formatted batch-mutation error state to
   `TransactionPreviewModal` and clear it immediately before a retry.
2. Render `MessageBanner` above the fixed footer without changing overlay,
   scrolling, or body-lock behavior.
3. Ensure failure keeps `editableFiles` intact and does not call
   `onOpenChange(false)` or `onImportComplete`; ensure dismiss and close clear
   only the transient error.
4. Remove the toast import and replace toast mocks/assertions with MSW workflows
   covering failure, retained preview edits, dismissal, retry, and success.
5. Retain explicit tests showing that success closes the dialog and delegates
   the non-obvious result counts to the existing transactions-page banner.

### Implementation notes

Use `formatApiError` with the current batch-import fallback. The page result
banner is not redundant success feedback because it explains counts and
visibility consequences that the refreshed table may not reveal.

### Validation

```bash
npx prettier --write \
  src/features/transactions/components/TransactionPreviewModal.tsx \
  src/features/transactions/components/__tests__/TransactionPreviewModal.test.tsx
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/features/transactions/components/__tests__/TransactionPreviewModal.test.tsx \
  src/features/transactions/pages/__tests__/TransactionsPage.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- Reviewed-import request failures remain in the dialog as persistent alerts,
  preserve edited review data, and emit no toast.
- Successful import still closes the dialog and produces the existing
  informative page-level result banner.
- Focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 5: Simplify Bulk-Deletion Results and Localize Request Failure

### Workspace

.

### Goal

Treat every successful bulk-delete response as a converged table result without
a detached message, while keeping transport or application request failures
persistent inside the confirmation dialog.

### Scope

- Remove partial-result and zero-deletion toast branches.
- For full, partial, and all-already-absent successful responses, close the
  dialog, clear selection through the existing success callback, invalidate or
  refresh normally, and rely on the resulting table.
- Add a persistent normalized request-failure alert inside `BulkDeleteModal`.
- Preserve selected IDs and keep the dialog open for a failed request.
- Update modal and table workflow tests through MSW.

### Non-goals

- Do not change the bulk-delete payload or backend response schema.
- Do not call a response with `notFoundIds` a failed request; those IDs are
  already absent and retrying them cannot help.
- Do not add partial-result warnings elsewhere on the page.
- Do not change selection behavior outside mutation completion.

### Required context

- Re-read the repository `AGENTS.md`, finding 2,
  `docs/api-integration.md#user-facing-error-messages`,
  `docs/state-architecture.md`, `docs/react-hooks-lifecycle-mental-model.md`,
  and `docs/testing-guide.md`.
- Read the bulk-delete operation and `deletedCount`/`notFoundIds` schema in
  `docs/api/budget-analyzer-api.yaml`.
- Inspect `BulkDeleteModal`, its `TransactionTable` caller, the bulk-delete
  hook, and both relevant suites before changing result handling.

### Execution steps

1. Add local formatted request-error state to `BulkDeleteModal`, clearing it
   before retry, on dismiss, and on dialog close.
2. Remove result classification that emits warning or error toasts after a
   successful HTTP response; keep the existing close and success-cleanup path
   identical for full, partial, and zero-deletion results.
3. On request failure, keep the dialog and selection available, show a
   `MessageBanner`, and do not invoke the success cleanup callback.
4. Replace toast-oriented tests with result-convergence tests for all three
   successful response shapes and failure/dismiss/retry tests for rejected
   requests.
5. Verify at the table boundary that every successful result clears stale
   selection and the query invalidation makes already-absent IDs harmless.

### Implementation notes

Use `formatApiError` rather than reading an unnormalized error message directly.
The successful response's counts remain part of the transport contract even
though the UI no longer announces them.

### Validation

```bash
npx prettier --write \
  src/features/transactions/components/BulkDeleteModal.tsx \
  src/features/transactions/components/__tests__/BulkDeleteModal.test.tsx \
  src/features/transactions/components/__tests__/TransactionTable.test.tsx
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/features/transactions/components/__tests__/BulkDeleteModal.test.tsx \
  src/features/transactions/components/__tests__/TransactionTable.test.tsx \
  src/hooks/__tests__/useBulkDeleteTransactions.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- Full, partial, and zero-deletion successful responses converge silently on
  the refreshed table and clear selection.
- A rejected request keeps the modal and selection intact with a persistent
  contextual error and retry path.
- No bulk-deletion toast remains, and focused tests, `npm run lint:fix`, and
  `git diff --check` pass.

## Phase 6: Localize Statement-Format Failures and Remove the Currency Notice

### Workspace

.

### Goal

Give statement-format visibility failures a stable row-scoped recovery surface
and remove the currency-change toast whose consequence is already visible in
the cleared amount filters.

### Scope

- Store one `{ formatId, message }` visibility-mutation error on
  `StatementFormatManagementPage`.
- Render the error directly beneath the affected format row in
  `StatementFormatVisibilityTable`.
- Preserve hide or restore action availability and support dismiss and retry.
- Remove the informational toast from `CurrencySelector` while preserving URL
  cleanup and display-currency changes.
- Update statement-format MSW workflows and currency-selector behavior tests.

### Non-goals

- Do not change format creation/editing, import eligibility, permissions,
  visibility endpoints, table overflow, or pending-action rules.
- Do not add a page-global format mutation banner.
- Do not add replacement feedback for cleared currency filters; the cleared
  controls and URL state are the feedback.
- Do not remove the toast infrastructure until all remaining callers migrate.

### Required context

- Re-read the repository `AGENTS.md`, finding 2,
  `docs/api-integration.md#user-facing-error-messages`,
  `docs/state-architecture.md`, `docs/react-hooks-lifecycle-mental-model.md`,
  `docs/architecture.md#content-security-policy`, and
  `docs/testing-guide.md`.
- Read the statement-format hide and unhide operations and errors in
  `docs/api/budget-analyzer-api.yaml`.
- Inspect the management page, visibility table, currency selector, their
  callers, and their unit/integration suites.

### Execution steps

1. Add row-keyed formatted error state to the management page; include the
   affected display name in fallback copy, clear stale feedback before a new
   action, and retain it after request failure.
2. Pass the error and memoized dismiss callback into the visibility table and
   render an adjacent full-width table row containing `MessageBanner`.
3. Cover hide and restore failure, row locality, dismissal, retry, later
   success, and unchanged import eligibility through MSW.
4. Remove `CurrencySelector`'s toast import and emission while leaving its
   amount-filter URL cleanup and Redux preference update untouched.
5. Replace currency toast assertions with visible control and URL assertions
   proving only the affected amount filters are cleared.
6. Inspect table semantics, static column spanning, and source imports for
   unrelated changes.

### Implementation notes

Only one visibility mutation is pending today, so one row-keyed error is
sufficient. Use static Tailwind classes and valid table markup. A failed row
action must not be confused with a statement-format list query failure, which
continues to use `ErrorBanner`.

### Validation

```bash
npx prettier --write \
  src/features/statement-formats/pages/StatementFormatManagementPage.tsx \
  src/features/statement-formats/components/StatementFormatVisibilityTable.tsx \
  src/features/statement-formats/pages/__tests__/StatementFormatManagementPage.test.tsx \
  src/features/statement-formats/pages/__tests__/StatementFormatManagementPage.integration.test.tsx \
  src/components/CurrencySelector.tsx \
  src/components/__tests__/CurrencySelector.test.tsx
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/features/statement-formats/pages/__tests__/StatementFormatManagementPage.test.tsx \
  src/features/statement-formats/pages/__tests__/StatementFormatManagementPage.integration.test.tsx \
  src/components/__tests__/CurrencySelector.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- Hide and restore failures are persistent, normalized, row-scoped, and
  retryable without a toast.
- Currency changes still clear incompatible amount filters and update the
  display preference without emitting a redundant message.
- Focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 7: Replace the Heartbeat Toast with Global Session Status

### Workspace

.

### Goal

Replace the background heartbeat warning toast with a persistent
application-level warning that remains in a stable top-of-application location
until dismissed or a later heartbeat establishes healthy session status.

### Scope

- Expose transient session-connectivity warning state and a dismiss callback
  from `useSessionHeartbeat`.
- Set the warning only after the existing immediate retry also fails for a
  network error or HTTP 502.
- Clear the warning after a successful local or cross-tab heartbeat, and allow
  a later failed attempt to show it again.
- Render the warning through `MessageBanner` from
  `SessionHeartbeatProvider` in stable document flow above the route tree.
- Update hook, provider, and application composition tests.

### Non-goals

- Do not change heartbeat cadence, activity detection, retry count, session
  extension, inactivity countdown, 401 logout behavior, or BroadcastChannel
  ownership.
- Do not put session state in Redux or TanStack Query.
- Do not make the warning fixed-position, time-based, or toast-like.
- Do not alter public-route authentication behavior or start a local runtime.

### Required context

- Re-read the repository `AGENTS.md`,
  `docs/authentication.md#heartbeat-inactivity-and-expiry`,
  `docs/state-architecture.md`, `docs/react-hooks-lifecycle-mental-model.md`,
  `docs/architecture.md#content-security-policy`, and
  `docs/testing-guide.md`.
- Read the session operation in `docs/api/session-gateway-api.yaml` and inspect
  `App`, `SessionHeartbeatProvider`, `useSessionHeartbeat`,
  `InactivityWarningModal`, and their tests.
- Keep warning state local to the long-lived heartbeat provider and use the
  existing accessible `MessageBanner` warning semantics.

### Execution steps

1. Add a nullable connection-warning value and memoized dismiss callback to
   `useSessionHeartbeat`; set it after the second network/502 failure and
   remove the toast dependency.
2. Clear the warning on any successful heartbeat, including a successful
   expiry update received from another tab, while preserving the existing
   inactivity-warning scheduling.
3. Extend `SessionHeartbeatProvider` to render the warning through
   `MessageBanner` without interfering with the non-dismissable expiry modal.
4. Place the provider before the route tree in `App` so an authenticated
   warning occupies one stable top-level location across user and admin
   layouts; ensure it renders nothing visible while disabled and healthy.
5. Replace hook toast spies with state assertions for retry failure, success,
   dismissal, reappearance, 401, and cross-tab recovery; add provider tests for
   the accessible status message and dismiss control.
6. Update App tests only as required by the composition change and inspect
   effect cleanup, Strict Mode behavior, and public routes for regressions.

### Implementation notes

The warning is local UI state synchronized with the heartbeat lifecycle. Do not
create a global event bus or persisted notification record. Dismissal hides the
current warning; a later independently failed heartbeat may show it again.
Successful heartbeat state is authoritative and clears the warning.

### Validation

```bash
npx prettier --write \
  src/hooks/useSessionHeartbeat.ts \
  src/hooks/__tests__/useSessionHeartbeat.test.ts \
  src/components/SessionHeartbeatProvider.tsx \
  src/components/__tests__/SessionHeartbeatProvider.test.tsx \
  src/App.tsx \
  src/__tests__/App.test.tsx
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/hooks/__tests__/useSessionHeartbeat.test.ts \
  src/components/__tests__/SessionHeartbeatProvider.test.tsx \
  src/__tests__/App.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- A twice-failed heartbeat produces one stable, dismissible application-level
  status warning instead of a toast.
- Local or cross-tab success clears the warning; inactivity warning and logout
  behavior remain unchanged.
- Focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 8: Remove Toast Infrastructure, Reconcile Documentation, and Validate

### Workspace

.

### Goal

Delete the now-unused toast implementation and dependency, record the final
no-toast product contract, resolve audit finding 2 without overstating unrelated
accessibility coverage, and run all required application, dependency, CSP, and
documentation gates.

### Scope

- Remove `Toaster` from `App` and delete `Toast.tsx`, `Toaster.tsx`, and
  `useToast.ts` after proving they have no callers.
- Remove `@radix-ui/react-toast` from `package.json` and `package-lock.json`
  using npm's normal dependency-management command.
- Remove obsolete toast mocks and assertions from remaining tests.
- Update the durable notification, API, authentication, architecture,
  inventory, and audit documentation to match production source.
- Run full validation, the production-smoke static scan, and available external
  CSP browser gates.

### Non-goals

- Do not remove `MessageBanner`, `ErrorBanner`, informative import-result flash
  banners, persistent condition callouts, or the inactivity warning modal.
- Do not migrate or restyle unrelated load-error and condition components.
- Do not add Sonner or another notification dependency.
- Do not edit `e2e/` or Playwright configuration merely to broaden browser
  coverage in this plan.
- Do not start Tilt, Vite, or another user-managed service.

### Required context

- Re-read the repository `AGENTS.md`, `docs/README.md`, finding 2 and its full
  checklist, `docs/research/notification-inventory.md`,
  `docs/api-integration.md`, `docs/authentication.md`,
  `docs/architecture.md#content-security-policy`, `docs/development.md`, and
  `docs/testing-guide.md#external-browser-harness`.
- Reconfirm `docs/development.md#prerequisites` before dependency changes and
  stop if they are unsatisfied.
- Treat `docs/api-integration.md` as the durable owner for contextual mutation
  feedback, `docs/authentication.md` as the heartbeat owner, and the inventory
  as a source-accurate snapshot rather than timeless guidance.
- Because this phase removes a UI dependency and earlier phases add
  Motion-backed banner render sites, follow the repository's required static
  and available browser CSP audit procedures.

### Execution steps

1. Scan all production and test source for `toast`, `useToast`, `Toast`, and
   `Toaster`; resolve every remaining caller or obsolete mock before deleting
   shared files.
2. Remove the `Toaster` render/import and its App test mock, delete the unused
   toast modules, and run `npm uninstall @radix-ui/react-toast` so both package
   manifests remain synchronized.
3. Re-scan source, package metadata, and the built dependency graph to confirm
   the application has zero toast emissions and no Radix toast dependency.
4. Update `docs/api-integration.md` to describe each retained contextual error
   category, silent converged bulk deletion, and the preserved informative
   import result; remove the obsolete statement that batch failures use a
   toast.
5. Update `docs/authentication.md` for persistent heartbeat status and
   `docs/architecture.md` to remove the toast-specific CSP exception while
   retaining the prohibition on runtime stylesheet injection and Sonner.
6. Recount and rewrite `docs/research/notification-inventory.md` from current
   production source, recording zero global transient toasts and accurately
   classifying all replacements and deliberately silent outcomes.
7. Mark finding 2 resolved in
   `docs/issues/view-dialog-notification-consistency-audit.md`: record toast
   styling and touch affordance as not applicable because the surface was
   removed, record the completed mutation-error migrations, and scope the
   accessible-status claim to the retained explicit notification surfaces
   actually covered by `MessageBanner`; do not claim unrelated query/load
   callouts were changed.
8. Run the complete focused regression set, source scans, full build,
   production-smoke static gate, documentation checks, and available external
   browser CSP audit; inspect the final diff for unrelated user work or stale
   toast language.

### Implementation notes

Use npm rather than hand-editing the lockfile. An expected no-match `rg` exits
with status 1; judge it by output rather than treating that status as a product
failure. Preserve all user changes outside this plan, including untracked issue
discussion files. If the workstation-owned production-smoke route, local CA,
or locked Chromium is unavailable, do not start or weaken the environment;
report the browser verifier as unavailable while still running non-browser
gates.

### Validation

Run the focused suites spanning all migrated behavior, then the full gates:

```bash
rg -n "toast\.|useToast|<Toaster|@radix-ui/react-toast" src package.json package-lock.json
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/components/__tests__/CreateViewModal.test.tsx \
  src/components/__tests__/CurrencySelector.test.tsx \
  src/components/__tests__/SessionHeartbeatProvider.test.tsx \
  src/hooks/__tests__/useSessionHeartbeat.test.ts \
  src/features/transactions/components/__tests__/DeleteTransactionModal.test.tsx \
  src/features/transactions/components/__tests__/BulkDeleteModal.test.tsx \
  src/features/transactions/components/__tests__/TransactionPreviewModal.test.tsx \
  src/features/transactions/components/__tests__/TransactionTable.test.tsx \
  src/features/transactions/pages/__tests__/TransactionDetailPage.test.tsx \
  src/features/transactions/pages/__tests__/TransactionsPage.test.tsx \
  src/features/statement-formats/pages/__tests__/StatementFormatManagementPage.test.tsx \
  src/features/statement-formats/pages/__tests__/StatementFormatManagementPage.integration.test.tsx \
  src/__tests__/App.test.tsx
npm run lint:fix
npm run build
npm run build:prod-smoke
git diff --check
```

The initial `rg` command is expected to print no matches and exit with status
1. Verify changed documentation links and referenced paths. If the user-managed
production-smoke environment satisfies every prerequisite in the Testing
guide, also run:

```bash
npm run test:e2e:harness
npm run test:e2e:csp
```

### Completion criteria

- Production and test source contain no toast caller, provider, primitive, or
  mock, and package metadata contains no Radix toast dependency.
- Obvious and converged successful outcomes remain silent; actionable failures
  are persistent and contextual; the informative import result and global
  heartbeat warning retain their justified stable surfaces.
- Durable documentation and finding 2 match current behavior without claiming
  unrelated status-message work.
- Focused tests, `npm run lint:fix`, `npm run build`,
  `npm run build:prod-smoke`, documentation/link checks, and
  `git diff --check` pass; available browser gates pass or their unavailable
  prerequisite is reported explicitly.
