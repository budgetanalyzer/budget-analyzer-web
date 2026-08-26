# Remove Redundant Success Notifications: First Pass

Remove success toasts and notifications whose result is already visible in the
changed interface, as the first implementation pass for finding 2 in
`docs/issues/view-dialog-notification-consistency-audit.md`. This plan is
deliberately removal-only: it does not add replacement banners, inline status
components, live regions, or new toast behavior.

The removal set is eight `toast.success` branches—transaction table edit,
transaction detail edit, single deletion, fully successful bulk deletion,
statement-format hide and restore, and both saved-view membership-removal
flows—plus the user-deactivation success `MessageBanner`. Keep all errors,
warnings, partial or zero-result messages, import summaries, cross-route flash
messages, continuing-condition callouts, the currency-filter consequence
notice, and the session-heartbeat warning. Those messages carry information
that is not safely removable without a separate presentation decision or
replacement implementation.

## Phase 1: Remove Redundant Transaction Success Toasts

### Workspace

.

### Goal

Make successful transaction edits and deletions rely on their already-visible
interface changes while preserving every transaction failure and partial-result
message.

### Scope

- Remove the success toast after an inline transaction edit in
  `src/features/transactions/components/TransactionTable.tsx`.
- Remove the success toast after a transaction-detail edit in
  `src/features/transactions/pages/TransactionDetailPage.tsx` while retaining
  the callback that exits edit mode.
- Remove the success toast from
  `src/features/transactions/components/DeleteTransactionModal.tsx` while
  retaining dialog closure and the optional `onDeleted` callback.
- Remove only the fully-successful bulk-delete toast in
  `src/features/transactions/components/BulkDeleteModal.tsx`.
- Update or add colocated behavior tests for these success paths.

### Non-goals

- Do not remove or replace transaction edit, single-delete, bulk-delete, or
  reviewed-import error toasts.
- Do not remove the partial bulk-delete warning or zero-deletion error.
- Do not alter mutation requests, query invalidation, selection cleanup,
  navigation, dialog dismissal, copy unrelated to the removed messages, or the
  shared toast infrastructure.
- Do not add inline messages, banners, live regions, or other replacement
  success UI.

### Required context

- Read the repository `AGENTS.md`,
  `docs/issues/view-dialog-notification-consistency-audit.md` finding 2,
  `docs/research/notification-inventory.md`,
  `docs/api-integration.md#user-facing-error-messages`,
  `docs/react-hooks-lifecycle-mental-model.md`, and
  `docs/testing-guide.md` before editing.
- Read `docs/development.md#prerequisites`. Confirm Node.js 20+ and npm 10+ are
  available before running repository validation; stop and report an
  unsatisfied prerequisite rather than adding a workaround.
- The governing criterion is that an obvious successful direct manipulation
  needs no detached confirmation. An error, partial result, or non-obvious
  consequence is not removable in this pass.
- Preserve unrelated work in the working tree, including the existing audit
  and notification-inventory changes.

### Execution steps

1. Inspect the four production call sites and their nearest tests, and identify
   which existing callbacks provide the visible success outcome after each
   mutation.
2. Remove `toast.success` from the inline and detail edit success paths without
   changing their `onError` callbacks; keep the detail page's edit-mode cleanup
   in `onSuccess`.
3. Remove `toast.success` from single-delete success without changing dialog
   closure, cache invalidation, caller callbacks, or detail-page navigation.
4. Restructure the bulk-delete result branch so a complete success proceeds
   directly to closure and caller cleanup, while partial success still emits
   its warning and zero deletion still emits its error.
5. Update existing tests and add a focused bulk-delete test if needed so they
   assert the visible success outcomes and absence of a redundant success
   notification while continuing to cover retained error and partial-result
   behavior.

### Implementation notes

Keep components synchronous and retain TanStack Query mutation callbacks. It is
acceptable for a file to continue importing `toast` when an error or warning
branch still uses it. Tests should prefer the user-visible result—updated
values, closed dialog, removed rows, cleared selection, or navigation—as the
primary assertion; a focused negative assertion may protect the explicit
no-success-notification contract. Do not weaken existing failure-path coverage.

### Validation

Format the changed transaction source and test files with the repository's
Prettier configuration. Then run:

```bash
npx vitest run \
  src/features/transactions/components/__tests__/TransactionTable.test.tsx \
  src/features/transactions/components/__tests__/DeleteTransactionModal.test.tsx \
  src/features/transactions/components/__tests__/BulkDeleteModal.test.tsx \
  src/features/transactions/pages/__tests__/TransactionDetailPage.test.tsx
npm run lint:fix
git diff --check
```

If no dedicated bulk-delete test exists before this phase, create it beside the
component and use MSW for its API-facing workflow unless a direct hook mock is
intentionally narrower and documented by the test.

### Completion criteria

- Successful transaction edits, single deletion, and fully successful bulk
  deletion emit no success toast.
- Their visible success behavior, callbacks, invalidation, cleanup, and
  navigation remain intact and are behavior-tested.
- Transaction mutation errors, partial bulk-delete warnings, and zero-delete
  errors are unchanged.
- The focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 2: Remove Redundant View, Statement-Format, and User Success Messages

### Workspace

.

### Goal

Remove the remaining success notifications whose underlying view, row, or user
status visibly changes, without changing any failure presentation.

### Scope

- Remove the success toasts from manual and transfer/refund-assisted saved-view
  membership removal.
- Remove the success toasts from statement-format hide and restore.
- Remove the success-message state and success `MessageBanner` from user
  deactivation because the status badges, action availability, and deactivation
  details show the result.
- Update the nearest behavior tests for all five removed notification branches.

### Non-goals

- Do not remove or replace saved-view membership errors, statement-format
  errors, or the user-deactivation error banner.
- Do not change saved-view membership requests, candidate selection,
  statement-format visibility rules, permissions, query invalidation, user
  deactivation behavior, or dialog behavior.
- Do not remove `MessageBanner`, `Toast`, `Toaster`, `useToast`, Motion, or any
  other shared notification infrastructure still used by retained surfaces.
- Do not add replacement success UI or address the audit's separate mutation
  error, toast styling, touch affordance, or accessibility work.

### Required context

- Re-read the repository `AGENTS.md`, finding 2 in
  `docs/issues/view-dialog-notification-consistency-audit.md`, and the removal
  boundary in `docs/research/notification-inventory.md` before editing.
- Read `docs/api-integration.md` for saved-view membership and statement-format
  behavior, `docs/authentication.md` for user permissions, and
  `docs/testing-guide.md` for component and MSW test conventions.
- Read `docs/react-hooks-lifecycle-mental-model.md` because this phase removes
  component state and callbacks from `UserDetailPage`; do not introduce an
  effect or replacement lifecycle state.
- Rely on the successful query invalidations already owned by the mutation
  hooks to expose the updated memberships, formats, and user status.

### Execution steps

1. Remove the manual and assisted membership-removal success toast calls while
   preserving close/complete callbacks and the existing persistent workflow on
   failure.
2. Update both membership-removal test suites to prove successful closure and
   completion without a success notification and to retain failure behavior and
   selection.
3. Remove the statement-format hide and restore success toast calls while
   retaining their error callbacks and `onSettled` pending-state cleanup; update
   the management-page test accordingly.
4. Remove only `successMessage`, its clear callback, its mutation-time resets,
   its success assignment, and its rendered `MessageBanner` from
   `UserDetailPage`; keep the independent error-message state and banner.
5. Update the user-detail success test to assert the refreshed deactivated
   status, hidden action, and deactivation details without looking for a success
   banner, and retain the failure-banner test.

### Implementation notes

The two saved-view flows perform the same membership operation and must keep
the same notification behavior. Statement-format errors continue to require the
`toast` import even after success calls are gone. `UserDetailPage` continues to
use `AnimatePresence` and `MessageBanner` for its error state, so remove only
imports and callbacks that become genuinely unused. Do not turn the user status
badge into a new status message in this pass.

### Validation

Format the changed source and test files with the repository's Prettier
configuration. Then run:

```bash
npx vitest run \
  src/features/views/components/__tests__/RemoveViewTransactionsModal.test.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx \
  src/features/statement-formats/pages/__tests__/StatementFormatManagementPage.test.tsx \
  src/features/admin/users/pages/__tests__/UserDetailPage.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- Saved-view removal, statement-format hide/restore, and user deactivation emit
  no redundant success notification.
- Each success remains visibly reflected in its owning interface and is covered
  by a behavior test.
- All affected error surfaces and failure behavior remain unchanged and
  covered.
- The focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 3: Record the First-Pass Contract and Run Full Validation

### Workspace

.

### Goal

Document the removal-only product rule, reconcile the audit inventory with the
implemented surface, and verify the complete application change.

### Scope

- Update the durable notification guidance in `docs/api-integration.md`.
- Reconcile `docs/research/notification-inventory.md` counts and entries with
  the implemented first pass.
- Record first-pass progress in
  `docs/issues/view-dialog-notification-consistency-audit.md` without presenting
  the broader finding as resolved.
- Run source scans and the required production-change validation gates.

### Non-goals

- Do not declare finding 2 resolved while mutation errors still use transient
  toasts or while the remaining checklist decisions are open.
- Do not prescribe or implement the later replacement surfaces for retained
  mutation errors or consequential information.
- Do not restyle toasts, change their timeout or close affordance, add ARIA live
  semantics, remove toast infrastructure, or touch unrelated audit findings.
- Do not run Vite, Tilt, Playwright, or browser audits; this pass does not change
  a UI dependency, Motion behavior, overlays, or CSP-sensitive runtime styling.

### Required context

- Re-read the repository `AGENTS.md` documentation and validation rules,
  `docs/README.md`, finding 2 and its checklist, the complete notification
  inventory, `docs/api-integration.md#user-facing-error-messages`,
  `docs/development.md`, and `docs/testing-guide.md`.
- Treat `docs/api-integration.md` as the durable owner for feature-boundary
  feedback behavior. The issue tracks unresolved work; the research inventory
  records the observed surface.
- The implemented contract is narrow: obvious direct-manipulation success is
  communicated by the changed interface. Explicit messages remain when they
  convey non-obvious counts, partial outcomes, consequences, next steps,
  cross-route results, ongoing conditions, failures, or background/global
  events.

### Execution steps

1. Update `docs/api-integration.md` to record the success-feedback rule and the
   retained categories, while honestly describing transient mutation errors as
   remaining work rather than claiming the full no-toast-by-default policy is
   implemented.
2. Remove the eight obsolete success-toast rows from the inventory, remove the
   user-deactivation success-banner row, update counts, and add a concise note
   that this first pass removed only self-evident success feedback.
3. Add a concise progress record to finding 2 in the audit, keep its status
   open, and leave replacement, toast styling/touch behavior, and accessibility
   decisions for later work.
4. Scan production source to confirm there are no `toast.success` emissions and
   that the retained toast calls match the explicit keep set; inspect the final
   diff for accidental removal of errors, warnings, partial results, or
   unrelated behavior.
5. Run the full required validation suite and report any unavailable verifier
   or unsatisfied prerequisite explicitly.

### Implementation notes

Do not make the inventory timeless or vague: its counts and tables should match
production source after this pass. Link documentation using repository-relative
paths and avoid linking this plan from durable non-plan documents. If the final
source scan finds another success notification, classify it against the stated
criteria; do not expand the removal set unless its outcome is unquestionably
visible and its removal does not discard counts, consequences, instructions, or
cross-route context.

### Validation

Verify changed documentation links and paths, then run:

```bash
rg -n "toast\.success" src
rg -n "toast\.(error|warning|info)|toast\(" src --glob '!**/__tests__/**'
npm run lint:fix
npm run build
git diff --check
```

The first `rg` command is expected to return no matches and therefore exit with
status 1; treat output matches, not that expected status, as failure. The build
includes the full coverage, TypeScript, and production-bundle gates. Review
`git diff --name-only` and `git diff` after validation to ensure formatting or
lint fixes did not alter unrelated user work.

### Completion criteria

- Durable documentation states the first-pass success-feedback rule and does
  not claim that retained mutation-error presentation is solved.
- The notification inventory matches production source: eight success-toast
  branches and one redundant success-banner site are removed from its counts
  and tables.
- Finding 2 remains open with the completed removal pass and remaining work
  clearly distinguished.
- Production source contains no `toast.success` emissions, and every retained
  notification belongs to the explicit keep set.
- `npm run lint:fix`, `npm run build`, documentation checks, and
  `git diff --check` pass, or any environmental limitation is reported without
  claiming full verification.
