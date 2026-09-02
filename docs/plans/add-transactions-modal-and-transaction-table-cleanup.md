# Add Transactions Modal and Transaction Table Cleanup Plan

Replace saved-view add-to-view navigation with a focused, responsive modal that starts with no
filters and therefore shows the complete active transaction snapshot by default. Preserve the
existing static-membership, permission, selection, stale-snapshot, and error contracts while
removing every add-to-view responsibility from the ordinary Transactions page and its table.

## Phase 1: Build the Dedicated Saved-View Transaction Picker

### Workspace

.

### Goal

Create a tested saved-view-owned dialog and read-only transaction picker that can add selected
nonmembers without depending on the dual-purpose Transactions page or `TransactionTable`.

### Scope

- Add focused components under `src/features/views/components/` for the add-transactions dialog
  and its selection table.
- Use the complete active current-user transaction snapshot supplied by the saved-view page.
- Keep picker filters, sorting, pagination, row selection, select-all-matching state, dialog state,
  and mutation feedback local to the workflow.
- Initialize every picker opening with a blank query and null date, bank, account, type, and amount
  filters; do not inherit the saved-view page URL filters.
- Preserve atomic addition and stale-membership recovery through the existing shared view hooks.
- Add focused component tests using MSW for request-facing behavior.

### Non-goals

- Do not wire the new dialog into `ViewPage` in this phase.
- Do not remove the legacy URL-backed add mode or change the ordinary Transactions page yet.
- Do not change the saved-view API schema, backend behavior, permissions, or membership limits.
- Do not add transaction editing, deletion, importing, detail navigation, statistics, or
  save-as-view actions to the picker.
- Do not add a UI dependency, tooltip, toast, React `style` prop, or runtime-generated stylesheet.

### Required context

- Read `AGENTS.md` and confirm the prerequisites in `docs/development.md` before running repository
  commands. Stop and report an unsatisfied prerequisite rather than adding a workaround.
- Read the dialog, navigation/action hierarchy, CSP, and state-boundary sections of
  `docs/architecture.md`.
- Read the local-component-state rules in `docs/state-architecture.md`, the saved-view permission
  rules in `docs/authentication.md`, and the membership-addition/error contracts in
  `docs/api-integration.md`.
- Read `docs/react-hooks-lifecycle-mental-model.md` before adding local hooks or lifecycle behavior,
  and read `docs/testing-guide.md` before adding tests.
- Inspect `src/features/views/components/ViewTransactionTable.tsx`,
  `src/features/views/components/TransferRefundReviewDialog.tsx`,
  `src/features/transactions/components/TransactionTable.tsx`, `src/components/TransactionFilterBar.tsx`,
  `src/components/ui/Dialog.tsx`, `src/hooks/useViews.ts`, and the adjacent tests before choosing
  component boundaries.

### Execution steps

1. Define an explicit empty `TransactionFilterValues` value or small saved-view-owned local filter
   controller. Its initial query is `''`; every optional filter and `amountCurrency` is `null`.
   Expose memoized named callbacks required by `TransactionFilterBar`, and reset by mounting a fresh
   picker for each opening rather than synchronizing derived state through an effect.
2. Implement a read-only selection table over the supplied complete transaction snapshot. Reuse
   shared table, filter, checkbox, badge, date, amount-projection, and column-width infrastructure,
   but do not import the dual-purpose `TransactionTable` or expand cross-feature imports. If a
   transaction presentation primitive is genuinely shared, re-home it to the appropriate top-level
   `src/components/` or `src/utils/` owner and update all existing consumers and tests.
3. Show existing saved-view members in the results but disable their checkboxes and label them
   `Already in view`. Limit row, page, and all-matching selections to nonmembers; support local
   filtering, deterministic sorting, presentation pagination, clearing filters, clearing
   selection, and a truthful eligible-selection count. Rows must not navigate or expose edit,
   delete, import, or other unrelated transaction actions.
4. Wrap the picker in a sentence-case `Add transactions to {view name}` dialog. Use a large
   responsive, bounded-height layout with the dialog body as the vertical scroll owner, preserve
   the shared table's native horizontal overflow, and keep the selection count and Cancel/Add
   actions in a stable footer. The initial unfiltered state must render every active transaction,
   including disabled existing members.
5. Submit one deduplicated positive-ID delta through `createAddViewTransactionsRequest` and
   `useUpdateViewTransactions`. Keep ordinary failures in a persistent dialog alert without
   dropping selection. On `SAVED_VIEW_MEMBERSHIP_STALE`, retain the relevant selection, allow the
   hook's transaction/view invalidations to converge the inputs, block resubmission until the user
   changes the selection, and never retry automatically. Disable Cancel, the shared close control,
   backdrop dismissal, and Escape dismissal while a mutation is pending; close through the success
   callback after invalidation begins.
6. Add colocated tests covering the blank initial filters and full-snapshot results, disabled
   members, page and all-matching selection, exact PATCH body, success, Cancel, ordinary failure,
   stale failure and review-before-resubmit, focus semantics supplied by the shared dialog, and
   nondismissibility during a deferred request. Test product behavior rather than re-testing React,
   TanStack Table, or native browser behavior.

### Implementation notes

- The modal is a contextual membership action, not a durable destination. Do not read or write URL
  parameters for modal visibility, picker filters, sorting, pagination, or selection.
- The picker may receive `allTransactions`, `memberTransactionIds`, `displayCurrency`, and the
  already-derived display-amount map from `ViewPage`; it must not copy API data into Redux or issue
  per-transaction requests.
- Derive filtered rows, eligible IDs, existing-member sets, available bank/account options, and
  selection counts with plain calculations or `useMemo`. User-driven selection and submission
  belong in named event handlers.
- Prefer a dedicated view-membership picker over a configurable general-purpose table. The cleanup
  objective is to eliminate mixed transaction-management and membership-selection responsibilities.
- Keep the current API limit of 10,000 additions enforceable through the generated request schema;
  do not silently truncate a selection.

### Validation

- Format only files changed in this phase with the repository Prettier configuration.
- Run `npm run lint:fix`.
- Run the focused Vitest files for the new picker/dialog and for any shared primitive that was
  moved.
- Run `git diff --check`.

### Completion criteria

- A standalone saved-view add-transactions dialog compiles and has focused passing tests.
- Its first render always uses unset filters and shows the complete active transaction snapshot.
- Only nonmembers can be selected or submitted, and API failures preserve actionable state.
- The component contains no transaction-management or route-navigation behavior and introduces no
  new feature-boundary or CSP violation.

## Phase 2: Integrate the Modal into Saved-View Detail

### Workspace

.

### Goal

Make the saved-view detail page open the new modal in place, using data it already owns, while
preserving permission gating and refreshed membership feedback.

### Scope

- Replace the `Add transactions` navigation link in `ViewPage` with a dialog-opening button.
- Supply the dialog from the saved view's already-loaded complete snapshot, canonical member IDs,
  display currency, and display amounts.
- Keep modal visibility local and conditionally mount a fresh dialog for each opening.
- Update saved-view page tests for opening, closing, permissions, defaults, and successful refresh.

### Non-goals

- Do not remove the now-unadvertised legacy URL add mode in this phase; that cleanup has its own
  independently verifiable phase.
- Do not change saved-view filtering, removal, transfer/refund review, analytics navigation, or
  object-action ordering.
- Do not add a success toast or banner for a membership addition whose refreshed count and table
  already communicate the outcome.

### Required context

- Re-read `AGENTS.md`, `docs/architecture.md`, `docs/authentication.md`,
  `docs/state-architecture.md`, `docs/api-integration.md`, and the Phase 1 components and tests.
- Inspect `src/features/views/pages/ViewPage.tsx`,
  `src/features/views/pages/__tests__/ViewPage.test.tsx`, `src/hooks/useViews.ts`, and
  `src/queryKeys.ts`.
- Confirm that `useViewTransactions` still returns the complete snapshot as `allTransactions`, the
  canonical IDs as `memberTransactionIds`, and refreshed derived members after mutation-driven
  invalidation.

### Execution steps

1. Add local open state and memoized open/close/success callbacks to `ViewPage`. Render `Add
   transactions` as the page's primary action button rather than a link, retaining the `views:write`
   gate and existing action hierarchy.
2. Remove add-mode URL construction from the saved-view page and pass the loaded `view`,
   `allTransactions`, `memberTransactionIds`, `displayCurrency`, display amounts, and relevant
   loading information into the new dialog. Do not refetch metadata or membership solely because
   the dialog opened.
3. Conditionally mount the dialog only while it is open and the user has `views:write`, so closing
   discards filters, sorting, pagination, errors, and selection and reopening starts unfiltered.
   Ensure denied users cannot mount the mutation-owning subtree.
4. Verify success closes the dialog and leaves the user on the same saved-view URL while the
   existing query invalidations refresh the count and member table. Keep failure and stale recovery
   inside the dialog, with no detached notification.
5. Update `ViewPage` tests to assert button semantics, unchanged location, all-transactions default,
   focus restoration, permission gating, clean reopening, and refreshed membership after success.
   Remove assertions that the page constructs an add-mode URL, but retain unrelated saved-view
   action and filter coverage.

### Implementation notes

- Active filters on `/views/{id}` affect only the member table behind the modal. They must neither
  seed nor change when the picker opens or filters its complete snapshot.
- Use the existing `views:write` permission for the entry button and full dialog subtree;
  `transactions:delete` must remain irrelevant to membership selection.
- The shared dialog primitive owns focus containment, restoration, body locking, Escape, and
  backdrop behavior. Feature code supplies the pending-state dismissal contract.
- Keep the dialog mounted beneath the normal user layout so its default `document.body` portal and
  theme behavior remain valid.

### Validation

- Format only files changed in this phase with the repository Prettier configuration.
- Run `npm run lint:fix`.
- Run the focused Vitest files for `ViewPage` and the add-transactions dialog/picker.
- Run `git diff --check`.

### Completion criteria

- Clicking `Add transactions` opens an accessible modal without navigating or changing the saved
  view's URL.
- The modal shows the complete active snapshot with blank filters on every opening.
- Permission-denied users cannot open or mount the workflow.
- Cancel, success, error, and stale-snapshot behavior remain contextual and covered by passing
  tests.

## Phase 3: Remove the Legacy Dual-Purpose Transactions Flow

### Workspace

.

### Goal

Return the Transactions page and `TransactionTable` to single-purpose transaction management and
delete the obsolete route-mode infrastructure and tests.

### Scope

- Remove add-mode parsing, target-view queries, return navigation, and conditional page rendering
  from `TransactionsPage`.
- Remove add-to-view selection, member awareness, membership mutation, callbacks, and feedback from
  `TransactionTable`.
- Delete the obsolete add-transactions URL utility and its tests.
- Rewrite affected tests around the simplified production contracts and prove no add-mode symbols
  remain.

### Non-goals

- Do not redesign ordinary transaction filtering, statistics, importing, editing, detail
  navigation, deletion, pagination, or save-as-view behavior.
- Do not combine the Transactions and saved-view tables into a broad generic abstraction.
- Do not preserve undocumented compatibility for `addToView` or `addToViewReturnTo`; after this
  phase those query parameters have no application meaning and ordinary unknown-query handling
  applies.
- Do not remove shared view mutation helpers now used by the dedicated dialog.

### Required context

- Re-read `AGENTS.md`, the architecture feature-boundary and action rules, the state placement
  guide, and the testing guide.
- Inspect the integrated modal before deleting legacy code so every membership-addition behavior
  has a new owner and test.
- Inspect `src/features/transactions/pages/TransactionsPage.tsx`,
  `src/features/transactions/components/TransactionTable.tsx`, their colocated tests,
  `src/utils/addTransactionsMode.ts`, `src/utils/__tests__/addTransactionsMode.test.ts`, and any App
  or E2E references found with `rg`.

### Execution steps

1. Collapse `TransactionsPage` back to its ordinary page implementation. Remove
   `parseAddTransactionsMode`, malformed-mode cleanup, `AddTransactionsPage`, `ActiveAddMode`,
   target view/membership queries, `PermissionGuard`, return navigation, conditional titles, and
   add-mode-only action suppression. Preserve existing transaction filter, currency, stats,
   import, and error behavior.
2. Replace `TransactionSelectionPurpose` and its union-driven branching with an ordinary
   transaction-management table contract. Selection should mean bulk deletion only; retain the
   independent `views:write` check used by `SaveAsViewButton`, but remove add-to-view permission,
   member-ID, eligibility, selection-label, callback, and mutation concerns.
3. Remove `useUpdateViewTransactions`, add-selection reset logic, add-specific errors and stale
   handling, the add footer, and add-mode column/row branches from `TransactionTable`. Rename
   residual generic variables such as `selectedPurposeIds` to names that express their remaining
   deletion purpose, and simplify memo dependencies and conditional rendering accordingly.
4. Delete `src/utils/addTransactionsMode.ts` and its test. Remove legacy add-mode cases and mocks
   from `TransactionsPage.test.tsx` and `TransactionTable.test.tsx`; keep or strengthen focused
   ordinary-page tests so import visibility, row editing/navigation, save-as-view, deletion
   selection, amount-filter loading, and permissions remain protected.
5. Search production, tests, E2E, and documentation for `addToView`, `addToViewReturnTo`,
   `AddTransactionsPage`, `ActiveAddMode`, `add-to-view`, and `TransactionSelectionPurpose`.
   Production and test references must be gone; documentation findings are intentionally resolved
   in Phase 4.

### Implementation notes

- The dedicated saved-view dialog is the sole owner of membership-addition selection and mutation
  behavior after this phase.
- Removing the mode should reduce hooks and queries mounted by the Transactions page; do not retain
  generalized props or dead compatibility branches in anticipation of hypothetical reuse.
- Preserve the current transaction table's delete selection and all-matching semantics. Cleanup is
  not permission to alter unrelated product behavior.
- Use `@/*` imports and do not disable ESLint rules.

### Validation

- Format only files changed in this phase with the repository Prettier configuration.
- Run `npm run lint:fix`.
- Run the focused Vitest files for `TransactionsPage`, `TransactionTable`, `ViewPage`, and the new
  add-transactions dialog/picker.
- Run the legacy-symbol `rg` checks described above and inspect every remaining documentation hit.
- Run `git diff --check`.

### Completion criteria

- `TransactionsPage` has no saved-view target, return-route, or add-mode responsibility.
- `TransactionTable` has no membership-selection union, member-ID awareness, view mutation, or
  add-specific UI.
- The obsolete URL utility and its tests are deleted, with no production or test reference left.
- Ordinary transaction-management behavior and the new modal workflow both pass their focused
  tests.

## Phase 4: Document and Browser-Audit the Final Workflow

### Workspace

.

### Goal

Make the durable documentation and strict-CSP browser evidence match the modal-only design, then
run the complete repository validation gates.

### Scope

- Update the authoritative architecture, state, authentication, API-integration, and testing
  documentation affected by the behavior change.
- Add fail-closed Playwright coverage for the exact saved-view add-transactions dialog workflow.
- Run formatting, lint, focused tests, the full build, production-smoke/static scan, E2E typecheck,
  and the browser CSP audit when its user-managed prerequisites are available.

### Non-goals

- Do not change generated OpenAPI files; the endpoint and payload contract are unchanged.
- Do not start Tilt, Vite, NGINX, or any other user-managed runtime.
- Do not broaden the E2E suite into unrelated saved-view or cross-browser coverage.
- Do not link this ephemeral plan from durable non-plan documentation.

### Required context

- Re-read `AGENTS.md`, `docs/development.md`, `docs/architecture.md`,
  `docs/authentication.md`, `docs/api-integration.md`, `docs/state-architecture.md`, and
  `docs/testing-guide.md` before editing their owned contracts or running gates.
- Inspect `e2e/csp/view-actions.spec.ts`, `e2e/csp/transaction-dialog.spec.ts`,
  `e2e/fixtures/scenarios.ts`, and the fail-closed browser fixture helpers.
- Before browser execution, verify every prerequisite in
  `docs/testing-guide.md#external-browser-harness`, including the user-provided production-smoke
  route, matching Chromium, and trusted local CA. Stop and report missing prerequisites; never
  weaken HTTPS or CSP checks.

### Execution steps

1. Update `docs/state-architecture.md` to delete the URL-owned static-view-addition contract and
   record that dialog visibility, unset picker filters, sorting, pagination, and selection are
   local and discarded on close. Preserve the separate URL contract for saved-view member-table
   filters.
2. Update `docs/architecture.md` with the durable contextual modal behavior and action semantics;
   update `docs/authentication.md` so the button and dialog subtree use `views:write` without
   describing a deep link; and update `docs/api-integration.md` so add failures and stale review
   remain inside the dialog rather than beside page selection controls. Avoid component
   walkthroughs and duplicated contracts.
3. Extend the fail-closed browser fixtures with the exact saved-view membership PATCH response and
   add a focused CSP workflow that opens the dialog, verifies the unfiltered eligible/member rows,
   selects and submits a transaction, checks the exact request, proves pending dismissal is blocked,
   observes close and focus restoration after success, and asserts no unexpected requests, CSP
   violations, runtime-added stylesheets, or final style elements.
4. Update `docs/testing-guide.md` to describe the new exact browser coverage and its limits. Review
   `docs/README.md` only for ownership/link correctness; do not add a plan link or duplicate the
   workflow there.
5. Format every changed application and E2E file with the repository Prettier configuration, run
   `npm run lint:fix`, run all directly affected Vitest files, run `npm run typecheck:e2e`, then run
   `npm run build`. Run `npm run build:prod-smoke` for the production bundle and static dropdown/CSP
   capability scan.
6. When the external browser prerequisites are available, run `npm run test:e2e:csp` against
   `https://app.budgetanalyzer.localhost/_prod-smoke/` and inspect the resulting assertions and
   artifacts. If the user-managed environment is unavailable, do not start it; explicitly report
   that browser/CSP verification remains incomplete.
7. Review the complete diff for stale route-mode language, cross-feature imports introduced by the
   change, inline styling, unrelated formatting churn, and accidental changes to generated API
   specifications. Verify documentation links and paths, then run `git diff --check`.

### Implementation notes

- The browser scenario should use deterministic fixture transactions containing at least one
  existing member and one eligible nonmember so it proves both disabled-member and addition paths.
- Use a deferred PATCH response to inspect the dialog's in-flight dismissal and disabled-action
  contract before releasing success.
- `npm run build` includes full coverage, TypeScript, bundle, and threshold gates. Do not claim full
  verification if the external browser audit cannot run.
- The repository's production-smoke scan is capability evidence, not a substitute for the exact
  browser workflow.

### Validation

- `npm run lint:fix`
- Focused Vitest files for the dialog/picker, `ViewPage`, `TransactionsPage`, `TransactionTable`, and
  any moved shared primitive
- `npm run typecheck:e2e`
- `npm run build`
- `npm run build:prod-smoke`
- `npm run test:e2e:csp` when the documented user-managed environment is available
- Documentation link/path review
- Legacy-symbol and prohibited-style `rg` review
- `git diff --check`

### Completion criteria

- Durable documentation consistently describes a local, initially unfiltered add-transactions
  modal and contains no legacy add-mode URL contract.
- Fail-closed browser coverage exercises the modal's selection, pending, success, focus, and CSP
  behavior, or the unavailable user-managed prerequisite is reported explicitly.
- All available required validation gates pass with no new CSP, architecture, lint, type, test,
  coverage, or build failure.
- The final diff contains the modal workflow, complete dual-use cleanup, required tests and docs,
  and no unrelated changes.
