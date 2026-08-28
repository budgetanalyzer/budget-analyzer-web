# Complete the View Dialog Consistency Audit

Resolve findings 3, 5, 6, and 7 in
`docs/issues/view-dialog-notification-consistency-audit.md`. Findings 1, 2, and
4 are already resolved; preserve the recorded explanation that toast removal
caused findings 2 and 4 to be completed together. The remaining work adopts
non-destructive treatment for saved-view membership removal, blocks all dialog
dismissal while a mutation is pending, centralizes dialog semantics and focus
management in the shared primitive, and then normalizes dialog hierarchy and
single-transaction context.

## Phase 1: Normalize saved-view membership removal controls

### Workspace

.

### Goal

Close finding 3 by consistently presenting saved-view membership removal as a
non-destructive, reversible operation that does not delete transaction data.

### Scope

Update the manual row action, manual bulk-selection action, compact
confirmation, and transfer/refund confirmation so equivalent membership
removal operations use the same product taxonomy. Use the default primary
treatment for confirmation and non-destructive treatment for initiating
controls. Update focused component tests and the audit finding after validation
passes.

### Non-goals

Do not change the membership API request, selection behavior, mutation
feedback, permissions, actual transaction-deletion controls, dialog dismissal,
or shared dialog behavior. Do not restyle unrelated buttons.

### Required context

- `AGENTS.md`
- `docs/development.md`, especially `#prerequisites`
- `docs/issues/view-dialog-notification-consistency-audit.md`, especially
  finding 3 and Remaining Resolution Order
- `docs/architecture.md`, especially the CSP and UI dependency rules
- `docs/testing-guide.md`
- `src/features/views/components/RemoveViewTransactionsBar.tsx`
- `src/features/views/components/ViewTransactionTable.tsx`
- `src/features/views/components/RemoveViewTransactionsModal.tsx`
- `src/features/views/components/TransferRefundReviewDialog.tsx`
- Their colocated tests under `src/features/views/components/__tests__/`

### Execution steps

1. Verify Node.js 20+, npm 10+, and the documented sibling-repository
   prerequisites before editing; stop and report any unmet prerequisite rather
   than adding a workaround.
2. Inventory every saved-view membership-removal affordance and distinguish
   initiating controls from confirmation controls and from irreversible data
   deletion.
3. Remove destructive treatment from the manual row and bulk-selection
   affordances, and use the default primary confirmation treatment in both the
   compact and transfer/refund dialogs without changing their request or
   selection behavior.
4. Add or update focused tests that protect the adopted taxonomy where a
   variant/class assertion is necessary to express this explicit visual
   contract, while retaining workflow assertions for opening and confirming
   removal.
5. After all validation passes, mark finding 3 resolved in the audit and record
   the adopted non-destructive membership-removal rule without rewriting the
   history or status of findings 1, 2, and 4.

### Implementation notes

Membership removal retains the transaction and can be reversed by adding it to
the view again. The primary confirmation may still use direct removal copy;
non-destructive means it must not borrow the red destructive taxonomy reserved
for deleting data, deactivating users, or disabling currencies. Preserve the
`views:write` permission boundary and the existing `@/*` imports. Do not add
inline styles or new UI dependencies.

### Validation

Format only the changed TypeScript/TSX files with the repository Prettier
configuration. Then run:

```bash
npm run lint:fix
npx vitest run \
  src/features/views/components/__tests__/RemoveViewTransactionsBar.test.tsx \
  src/features/views/components/__tests__/RemoveViewTransactionsModal.test.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx \
  src/features/views/components/__tests__/ViewTransactionTable.test.tsx
npm run build
git diff --check
```

Verify every changed documentation link and referenced path. Inspect the final
diff so lint fixing or formatting did not alter unrelated user work.

### Completion criteria

All saved-view membership-removal initiators are visibly non-destructive, both
confirmation paths use the same default-primary taxonomy, focused tests and the
full production build pass, and finding 3 is accurately marked resolved with
its durable rationale.

## Phase 2: Upgrade the shared dialog contract

### Workspace

.

### Goal

Create one CSP-safe shared dialog contract for dismissal, accessible semantics,
initial focus, focus containment, and focus restoration, leaving feature
dialogs ready for the pending-mutation migration.

### Scope

Upgrade `src/components/ui/Dialog.tsx` and its colocated tests. Add an explicit
shared dismissibility input that controls the close button, backdrop, and
Escape behavior together. Provide `role="dialog"`, `aria-modal`, automatic
title and description associations, deterministic initial focus, Tab and
Shift+Tab containment, and restoration to the previously focused element when
the dialog closes. Record the shared overlay contract in the architecture
owner documentation.

### Non-goals

Do not add a dialog library, portal system, runtime stylesheet, animation
dependency, new toast/notification surface, or application-wide visual
restyling. Do not mark findings 5 or 7 resolved yet; consumer migration and
real-browser verification remain in later phases.

### Required context

- `AGENTS.md`
- `docs/development.md`, especially prerequisites and the production-smoke
  build gate
- `docs/architecture.md`, especially Content Security Policy and overlay
  behavior
- `docs/testing-guide.md`, especially unit/component tests and the external
  browser harness
- `docs/react-hooks-lifecycle-mental-model.md`
- `docs/issues/view-dialog-notification-consistency-audit.md`, findings 5 and 7
- `src/components/ui/Dialog.tsx`
- `src/components/ui/__tests__/Dialog.test.tsx`
- `src/utils/bodyScrollLock.ts` and its tests
- WAI-ARIA modal dialog guidance linked from the audit

### Execution steps

1. Verify the documented tool and sibling-repository prerequisites, then
   inventory current `Dialog`, `DialogContent`, `DialogTitle`, and
   `DialogDescription` consumers so the new API has a safe migration path.
2. Define and document one dismissibility contract whose disabled state hides
   or disables every apparent shared dismissal affordance and suppresses both
   backdrop and Escape dismissal without suppressing successful programmatic
   closure by the controlling feature.
3. Implement semantic title/description registration and modal attributes in
   the shared primitive, using stable React-generated identifiers and keeping
   components synchronous and CSP-safe.
4. Implement focus lifecycle behavior in effects with complete cleanup: honor
   an intentional autofocus target, otherwise choose a deterministic focusable
   target or the dialog container; contain forward and reverse Tab movement;
   and restore focus to the previously focused connected element on close.
5. Expand shared-component tests for accessible name/description, allowed and
   blocked dismissal mechanisms, initial focus, both focus-wrap directions,
   focus restoration, cleanup, body-lock preservation, and multiple dialog
   instances without testing browser-native behavior that jsdom cannot prove.

### Implementation notes

Keep dismissal requests distinct from controlled `open` state so a mutation
success can still close a non-dismissible dialog through its owner. Prefer a
clear positive or negative prop name that cannot produce contradictory
`showClose` and Escape/backdrop settings. Functions passed through context or
props must have stable identities where required. Preserve the reference-
counted `acquireBodyScrollLock()` behavior and avoid `style` props, direct body
style writes, CSSOM insertion, runtime `<style>` elements, `eval()`, and
`new Function()`.

### Validation

Format `src/components/ui/Dialog.tsx` and its changed colocated tests with
Prettier, then run:

```bash
npm run lint:fix
npx vitest run src/components/ui/__tests__/Dialog.test.tsx
npm run build
npm run build:prod-smoke
git diff --check
```

Verify changed documentation links and paths and inspect emitted-bundle scan
results rather than treating matches as an allowlist. Real-browser focus and
CSP proof is deliberately deferred to Phase 4.

### Completion criteria

The shared primitive exposes one coherent dismissal API, provides the agreed
semantic and focus behavior under focused tests, preserves body-lock and CSP
contracts, documents the shared overlay behavior, and builds successfully.
Findings 5 and 7 remain open pending consumer migration and browser evidence.

## Phase 3: Apply pending-mutation dismissal policy

### Workspace

.

### Goal

Migrate the mutation dialogs named by the audit to the shared contract so no
dismissal mechanism can imply cancellation while an in-flight request
continues.

### Scope

Apply the shared non-dismissible state while pending to create view, rename
view, delete view, manual membership removal, transfer/refund membership
removal, single-transaction deletion, and bulk-transaction deletion. Disable
Cancel, suppress the shared close control, and ignore Escape and backdrop
dismissal through the shared primitive. Remove duplicated feature-level
dismissal guards that the primitive now owns, while retaining feature cleanup
and successful-close behavior. Update focused MSW-backed workflow tests.

### Non-goals

Do not make mutation requests cancellable, close dialogs optimistically,
change retry/error behavior, clear drafts or selections, alter API contracts,
or normalize title/icon/context presentation yet. Do not claim findings 5 or 7
complete before Phase 4 supplies real-browser evidence.

### Required context

- `AGENTS.md`
- `docs/development.md#prerequisites`
- `docs/api-integration.md`, especially user-facing mutation errors
- `docs/testing-guide.md`, especially MSW guidance
- `docs/react-hooks-lifecycle-mental-model.md`
- `docs/issues/view-dialog-notification-consistency-audit.md`, findings 5 and 7
- The shared dialog contract and tests completed in Phase 2
- `src/components/CreateViewModal.tsx`
- `src/features/views/components/EditViewModal.tsx`
- `src/features/views/components/DeleteViewModal.tsx`
- `src/features/views/components/RemoveViewTransactionsModal.tsx`
- `src/features/views/components/TransferRefundReviewDialog.tsx`
- `src/features/transactions/components/DeleteTransactionModal.tsx`
- `src/features/transactions/components/BulkDeleteModal.tsx`
- The corresponding seven colocated test files

### Execution steps

1. Verify prerequisites and confirm Phase 2's shared dialog API and focused
   tests are present and passing before migrating consumers.
2. Give each audited dialog a single derived pending/non-dismissible state and
   pass it to the shared primitive; keep Cancel disabled and preserve the
   current pending label and submit-button behavior.
3. Remove `showClose` toggles and local Escape/backdrop/close-icon guards made
   redundant by the shared contract, but retain named close handlers that own
   feature cleanup and mutation-success transitions.
4. Add deferred MSW cases for each affected workflow, proving that Cancel,
   close icon availability, Escape, and backdrop behavior all agree while the
   request is pending and that successful completion can still close the
   dialog without losing failure/retry context.
5. Run an inventory of other current mutation-owning dialog consumers. Migrate
   any consumer that would otherwise contradict the documented global pending
   policy solely because it uses the shared primitive, and add proportionate
   focused coverage; record any intentionally different non-mutation/session
   behavior rather than forcing it into this rule.

### Implementation notes

Closing does not cancel a TanStack Query mutation, so a pending dialog must not
offer an apparently successful cancellation path. The error-banner dismissal
button dismisses feedback, not the dialog, and is outside the dialog-dismissal
taxonomy. Use `mutate(data, { onSuccess, onError })`; do not introduce
component-level async handlers or copy server state into local/Redux state.

### Validation

Format all changed TypeScript/TSX files with the repository Prettier
configuration, then run:

```bash
npm run lint:fix
npx vitest run \
  src/components/__tests__/CreateViewModal.test.tsx \
  src/features/views/components/__tests__/EditViewModal.test.tsx \
  src/features/views/components/__tests__/DeleteViewModal.test.tsx \
  src/features/views/components/__tests__/RemoveViewTransactionsModal.test.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx \
  src/features/transactions/components/__tests__/DeleteTransactionModal.test.tsx \
  src/features/transactions/components/__tests__/BulkDeleteModal.test.tsx \
  src/components/ui/__tests__/Dialog.test.tsx
npm run build
npm run build:prod-smoke
git diff --check
```

Also run focused tests for any additional existing mutation dialog migrated in
step 5. Inspect the diff for unrelated lint/formatting changes.

### Completion criteria

All mutation dialogs named by the audit, plus any in-scope current consumer
needed to keep the durable rule true, block every shared dismissal mechanism
while pending; feature cleanup and successful closure still work; focused and
full build gates pass; and findings 5 and 7 remain open only for the required
browser verification.

## Phase 4: Verify dialog behavior in a real browser

### Workspace

.

### Goal

Prove the shared dialog's semantics, focus lifecycle, pending dismissal, and
CSP behavior in Chromium, then close findings 5 and 7 together.

### Scope

Extend the existing fail-closed Playwright CSP harness with a deterministic
dialog workflow on the production-smoke application. Cover accessible dialog
name/description, initial focus, forward and reverse focus containment, focus
restoration, normal Escape dismissal, and blocked close/Escape/backdrop/Cancel
behavior during a deferred mutation. Update the testing guide's current
coverage statement and the audit only after the browser gates pass.

### Non-goals

Do not start Tilt, Vite, NGINX, or another server. Do not disable HTTPS or
certificate verification, contact real backend services, allowlist CSP
findings, snapshot-accept runtime styles, or claim cross-browser/mobile proof
from the desktop Chromium project.

### Required context

- `AGENTS.md`
- `docs/development.md`, especially prerequisites and production-smoke build
- `docs/architecture.md#content-security-policy`
- `docs/testing-guide.md#external-browser-harness`
- `playwright.config.ts`
- `e2e/fixtures/`, especially the fail-closed browser mocks and CSP observer
- `e2e/csp/transaction-selection.spec.ts`
- The completed shared primitive and pending-consumer work from Phases 2 and 3
- `docs/issues/view-dialog-notification-consistency-audit.md`, findings 5 and 7

### Execution steps

1. Verify Node/npm/repository prerequisites, installed locked Chromium, local
   CA trust, and a healthy user-managed
   `https://app.budgetanalyzer.localhost/_prod-smoke/` environment. Stop and
   report the missing prerequisite if any check fails; never start the stack.
2. Add the smallest deterministic mocked application scenario needed to open
   an audited transaction dialog, defer its mutation response, and complete or
   release the response without permitting unregistered auth/API requests.
3. Add Playwright assertions for modal role and associations, initial focus,
   Tab and Shift+Tab containment, permitted dismissal with restoration to the
   connected initiator, and complete dismissal blocking while pending.
4. Run the harness self-tests and strict application CSP workflow, investigate
   every policy/runtime stylesheet finding, and fix product or test code rather
   than weakening the detector.
5. After all browser and static gates pass, update the Testing guide's current
   coverage limits and mark findings 5 and 7 resolved together in the audit,
   recording the centralized contract and the exact browser evidence without
   overstating desktop Chromium coverage.

### Implementation notes

Install monitoring before navigation and use only exact scenario-registered
requests. Prefer an existing visible transaction workflow so the test proves
application integration rather than a synthetic component page. A deferred
request must always be released or cleaned up so teardown cannot hang. The
browser test complements, rather than duplicates, jsdom tests: use it for real
focus movement, restoration, keyboard behavior, and CSP/runtime-style
observations.

### Validation

Format changed E2E TypeScript and application files with Prettier, then run:

```bash
npm run lint:fix
npm run typecheck:e2e
npm run build:prod-smoke
check-budget-analyzer-local-ca-trust
npm run test:e2e:harness
npm run test:e2e:csp
git diff --check
```

Verify every changed documentation link and path. If the user-managed browser
environment is unavailable, report the verifier as blocked and leave findings
5 and 7 open; typechecking or harness source review is not a substitute for the
required application browser run.

### Completion criteria

The fail-closed browser scenario passes against the strict production-smoke
route, produces no CSP violation or prohibited runtime/final stylesheet
finding, proves the agreed focus and pending-dismissal behaviors, accurately
updates documented harness coverage, and closes findings 5 and 7 together.

## Phase 5: Normalize dialog hierarchy and transaction context

### Workspace

.

### Goal

Close finding 6 and the audit by applying explicit title, warning-icon, and
single-transaction confirmation conventions after the shared behavioral
foundation is stable.

### Scope

Use sentence case for audited dialog headings and record it as the future
dialog-title convention. Reserve warning iconography for consequential
destructive actions such as irreversible deletion, not reversible membership
removal. Make destructive confirmations in the audited comparison set follow
that rule consistently. When manual saved-view removal affects exactly one
transaction, show identifying date, description, native amount, and selected-
currency projection when available; keep bulk removal count-based. Update
focused tests, durable architecture guidance, and the audit's final status.

### Non-goals

Do not change API payloads, amount calculations, transaction selection,
permissions, mutation feedback, dialog focus/dismissal behavior, or unrelated
page/control copy. Do not duplicate date or currency behavior outside
`src/utils/dates.ts` and the existing currency/display-amount utilities.

### Required context

- `AGENTS.md`
- `docs/development.md#prerequisites`
- `docs/architecture.md`, including CSP and the dialog contract from Phase 2
- `docs/testing-guide.md`
- `docs/issues/view-dialog-notification-consistency-audit.md`, finding 6 and
  Completion Criteria
- Saved-view create, rename, delete, manual-removal, and transfer/refund dialog
  components and tests
- Single- and bulk-transaction deletion components and tests
- `src/features/views/components/ViewTransactionTable.tsx`
- `src/types/transaction.ts`, `src/types/displayAmount.ts`,
  `src/utils/dates.ts`, `src/utils/currency.ts`, and display-amount utilities

### Execution steps

1. Verify prerequisites and confirm Phases 2 through 4 completed successfully;
   do not normalize presentation on top of an unverified dialog foundation.
2. Inventory literal and computed headings in the audited dialog set, convert
   headings to sentence case, and update role/name queries without changing
   unrelated action-label copy unless necessary for grammatical consistency.
3. Define one warning-icon rule in the architecture owner, apply warning
   iconography consistently to the audited consequential destructive
   confirmations, and keep it absent from saved-view membership removal.
4. Pass the affected transaction and display-amount context from
   `ViewTransactionTable` into manual removal confirmation, render identifying
   details only when the unique removal set contains one transaction, and keep
   multi-item confirmation concise and count-based.
5. Add focused behavior tests for sentence-case accessible names, icon
   presence/absence as an explicit hierarchy contract, one-item identifying
   context including unavailable selected-currency projection, and unchanged
   bulk confirmation behavior.
6. Run all required application, CSP, and browser gates; only then mark finding
   6 resolved, set the audit overall status to resolved, complete its remaining
   checklist, and preserve the explanation for the earlier toast-driven
   reorder of findings 2 and 4.

### Implementation notes

Use shared top-level UI only if the transaction summary is genuinely reusable
without creating a cross-feature import; otherwise keep feature-specific
composition while reusing top-level date/currency utilities. Warning icons
must be decorative when the title and description already convey the warning,
or receive an accessible label only if they add unique meaning. Use static
Tailwind classes and existing Lucide assets; do not add tooltips, inline
styles, or dependencies.

### Validation

Format all changed TypeScript/TSX files with the repository Prettier
configuration, then run focused tests for every changed dialog, including at
minimum:

```bash
npm run lint:fix
npx vitest run \
  src/components/__tests__/CreateViewModal.test.tsx \
  src/features/views/components/__tests__/EditViewModal.test.tsx \
  src/features/views/components/__tests__/DeleteViewModal.test.tsx \
  src/features/views/components/__tests__/RemoveViewTransactionsModal.test.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx \
  src/features/views/components/__tests__/ViewTransactionTable.test.tsx \
  src/features/transactions/components/__tests__/DeleteTransactionModal.test.tsx \
  src/features/transactions/components/__tests__/BulkDeleteModal.test.tsx \
  src/components/ui/__tests__/Dialog.test.tsx
npm run build
npm run build:prod-smoke
npm run typecheck:e2e
check-budget-analyzer-local-ca-trust
npm run test:e2e:csp
git diff --check
```

The user-managed production-smoke environment remains required for the final
browser audit; do not start it. Verify all changed documentation links and
paths, inspect the final diff for unrelated churn, and do not mark the audit
resolved if any required verifier is unavailable or failing.

### Completion criteria

Audited dialog titles use sentence case, warning iconography follows the
documented destructive-action rule, a one-item membership removal identifies
the affected transaction while bulk removal remains count-based, all unit,
build, static CSP, E2E typecheck, and browser CSP gates pass, and all seven audit
findings are accurately resolved with their rationale preserved.
