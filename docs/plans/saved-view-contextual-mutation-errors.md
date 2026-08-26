# Saved-View Contextual Mutation Errors and Status Semantics

Replace transient or missing saved-view mutation failure feedback with a
persistent inline surface in the initiating dialog. Establish the shared
`MessageBanner` accessibility contract first, then migrate manual and assisted
membership removal plus rename and delete. Preserve each dialog's input or
selection after failure, use normalized API error copy, and keep finding 2 open
for the remaining application-wide mutation toasts, toast presentation, and
touch behavior.

## Phase 1: Establish Accessible Message Banner Semantics

### Workspace

.

### Goal

Make the existing shared banner a suitable accessible surface for persistent
dialog mutation feedback without changing its visual language or introducing a
second notification component.

### Scope

- Define semantic roles for every `MessageBanner` type: errors are assertive
  alerts, while success and warning messages are polite status messages.
- Make the complete message atomic for assistive-technology announcements.
- Give the icon-only dismiss control an explicit accessible name and keep its
  existing always-visible touch target.
- Add colocated shared-component behavior tests for role, message, and dismiss
  behavior.

### Non-goals

- Do not change banner colors, layout, animation variants, timing, or close
  behavior.
- Do not change `Toast`, `Toaster`, `useToast`, toast duration, toast styling,
  or the toast close affordance.
- Do not add a notification provider, Redux state, URL state, timers, effects,
  or a new dependency.
- Do not attempt to define semantics for every bespoke callout or query error
  surface in this phase.

### Required context

- Read the repository `AGENTS.md`, finding 2 in
  `docs/issues/view-dialog-notification-consistency-audit.md`,
  `docs/research/notification-inventory.md`,
  `docs/api-integration.md#user-facing-error-messages`,
  `docs/architecture.md#content-security-policy`, and
  `docs/testing-guide.md` before editing.
- Read `docs/development.md#prerequisites`. Confirm Node.js 20+, npm 10+, and
  the required sibling repositories are available; stop and report an
  unsatisfied prerequisite rather than adding a workaround.
- `MessageBanner` is the existing shared contextual feedback surface. Reuse
  its Tailwind styling and the centralized animation variants from
  `src/lib/animations.ts`; do not introduce inline styles or runtime stylesheet
  behavior.
- Follow WCAG status-message semantics without asserting implementation details
  of React, Motion, or the browser in tests.

### Execution steps

1. Inspect `MessageBanner`, its current render sites, the shared `Button`
   primitive, and existing accessibility-oriented component tests to confirm
   the smallest compatible prop and markup change.
2. Update `MessageBanner` so `error` renders with `role="alert"`, `success` and
   `warning` render with `role="status"`, and each role exposes the full message
   atomically without duplicating a live-region announcement.
3. Add an explicit accessible name to the dismiss button and mark decorative
   status and close icons so they do not become competing accessible content.
4. Add a colocated `MessageBanner` test suite that covers the error and
   non-error role mapping, visible message text, accessible dismiss control,
   and `onClose` callback.
5. Inspect the diff for visual, Motion, CSP, or public-prop changes outside the
   intended semantic contract.

### Implementation notes

Prefer the implicit live-region behavior of `role="alert"` and `role="status"`
instead of combining competing live attributes. Use `aria-atomic="true"` on
the semantic container. Keep the current required `onClose` contract unless
implementation evidence shows an optional close action is necessary; the four
saved-view dialog errors are intentionally dismissible. Tests should query by
role and accessible name rather than Tailwind classes or Motion internals.

### Validation

Format only the changed shared component and test with the repository Prettier
configuration, then run:

```bash
npx prettier --write \
  src/components/MessageBanner.tsx \
  src/components/__tests__/MessageBanner.test.tsx
npx vitest run src/components/__tests__/MessageBanner.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- Error banners expose one atomic alert; success and warning banners expose one
  atomic status message.
- The dismiss control has a discoverable accessible name and still invokes the
  supplied callback.
- Banner presentation, animation, dependencies, and CSP-sensitive behavior are
  otherwise unchanged.
- The focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 2: Migrate Saved-View Membership Removal Failures

### Workspace

.

### Goal

Replace the two saved-view membership-removal error toasts with persistent,
normalized errors inside their initiating dialogs while preserving the
selection and retry workflow.

### Scope

- Migrate `RemoveViewTransactionsModal` from `toast.error` to an inline error
  `MessageBanner`.
- Apply the same mutation-error behavior to
  `TransferRefundReviewDialog` without conflating it with the existing
  discovery/load `ErrorBanner`.
- Clear a prior mutation error when the user dismisses it, retries the
  mutation, or closes the dialog.
- Preserve selected transaction IDs and keep each dialog open after failure.
- Update both component suites with API-facing failure and retry coverage.

### Non-goals

- Do not change the membership delta payload, query invalidation, candidate
  discovery, dialog copy, removal-button variant, pending-dismissal behavior,
  or success callbacks.
- Do not replace the transfer/refund discovery `ErrorBanner`; it represents a
  query/load failure with its own Retry action.
- Do not add success feedback after a successful removal.
- Do not migrate transaction, import, statement-format, or other retained
  mutation toasts.
- Do not add or change animation definitions, use `AnimatePresence` with
  `mode="popLayout"`, or add CSP-sensitive styling.

### Required context

- Re-read the repository `AGENTS.md`, finding 2 and finding 4 in the audit,
  the saved-view rows in `docs/research/notification-inventory.md`, and
  `docs/api-integration.md#user-facing-error-messages`.
- Read `docs/state-architecture.md`,
  `docs/react-hooks-lifecycle-mental-model.md`,
  `docs/architecture.md#content-security-policy`, and
  `docs/testing-guide.md` before editing because this phase adds local
  transient state, mutation callbacks, and existing Motion-backed banner
  instances.
- Read the saved-view membership endpoint and error responses in
  `docs/api/budget-analyzer-api.yaml` before changing API-facing tests.
- Use `formatApiError` with the existing shared membership-removal fallback so
  documented application codes and normalized server messages remain
  authoritative.

### Execution steps

1. Inspect both dialogs, their callers, their current tests, and
   `useUpdateViewTransactions` to identify the close, retry, success, and
   pending boundaries that must remain unchanged.
2. Add local mutation-error message state and memoized clear/close handlers to
   `RemoveViewTransactionsModal`; clear stale feedback immediately before a
   new attempt and render `MessageBanner` between the confirmation context and
   actions when an error exists.
3. Add the same local mutation-error contract to
   `TransferRefundReviewDialog`, positioning it with the mutation action while
   leaving discovery loading and query errors in the scrollable review
   content.
4. Remove obsolete toast imports and test mocks from the two components and
   suites.
5. Exercise both failure paths through the real TanStack Query hook and MSW,
   converting the assisted-dialog suite to `renderWithProviders` as needed;
   assert normalized inline alert text, dialog persistence, preserved
   transaction selection, dismiss behavior, and a subsequent successful retry
   that closes and completes normally.
6. Retain focused success tests proving that closure and completion occur with
   no replacement success notification and that the atomic membership request
   remains unchanged.

### Implementation notes

Store only the formatted mutation message in local component state; server
state stays in TanStack Query. Set and clear that state from event and mutation
callbacks, not an effect. Memoize handlers passed as props. The assisted
dialog's candidate-rendering assertions can continue at the component boundary
while the provider-aware renderer supplies the real mutation hook. Reuse
`MessageBanner` and the existing animation system without adding inline
styles.

### Validation

Format only the changed saved-view source and tests with Prettier, then run:

```bash
npx prettier --write \
  src/features/views/components/RemoveViewTransactionsModal.tsx \
  src/features/views/components/TransferRefundReviewDialog.tsx \
  src/features/views/components/__tests__/RemoveViewTransactionsModal.test.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/features/views/components/__tests__/RemoveViewTransactionsModal.test.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- Both membership-removal failures appear as persistent inline alerts and emit
  no error toast.
- Each failure keeps the dialog open and preserves its transaction selection;
  dismiss and retry behavior is covered.
- A later successful retry clears the workflow, closes the dialog, and invokes
  the existing caller callbacks without a success message.
- Discovery/load failure presentation and membership API behavior are
  unchanged.
- The focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 3: Add Rename and Delete View Failure Feedback

### Workspace

.

### Goal

Give rename and delete-view mutations the same normalized, persistent dialog
failure behavior, closing the audit's missing-feedback finding without losing
user input or changing successful navigation.

### Scope

- Add contextual rename failure feedback to `EditViewModal`.
- Add contextual delete failure feedback to `DeleteViewModal`.
- Preserve the edited name and keep the rename dialog open after failure.
- Keep the delete dialog open and remain on the current view after failure.
- Clear a prior error when dismissed, retried, or when the dialog closes.
- Add behavior tests through MSW and the real mutation hooks.

### Non-goals

- Do not change title casing, warning iconography, confirmation copy, delete
  navigation destination, mutation schemas, or pending-dismissal behavior;
  those belong to other audit findings.
- Do not add success banners or toasts.
- Do not copy mutation errors into Redux, router state, or TanStack Query
  cached data.
- Do not change the saved-view hooks' invalidation responsibilities unless a
  focused test proves an existing defect required for this failure surface.

### Required context

- Re-read the repository `AGENTS.md`, finding 4 in
  `docs/issues/view-dialog-notification-consistency-audit.md`,
  `docs/api-integration.md#user-facing-error-messages`,
  `docs/state-architecture.md`,
  `docs/react-hooks-lifecycle-mental-model.md`, and
  `docs/testing-guide.md`.
- Read the update and delete saved-view operations and schemas in
  `docs/api/budget-analyzer-api.yaml` before editing API-facing tests.
- Preserve the current TanStack Query mutation callback style and use
  `formatApiError` with action-specific fallback copy.
- Use the shared `MessageBanner` contract completed in Phase 1; do not create
  field validation for a request-level mutation failure.

### Execution steps

1. Inspect `EditViewModal`, `DeleteViewModal`, their parent mounting behavior,
   mutation hooks, and tests to confirm when local feedback must be reset and
   which successful callbacks must remain intact.
2. Add local formatted error state to `EditViewModal`, clear it immediately
   before submission and on dialog dismissal, and supply an `onError` mutation
   callback that leaves the typed name and dialog intact.
3. Add the equivalent state and callbacks to `DeleteViewModal`, ensuring a
   failed deletion neither calls `onClose` nor navigates away.
4. Render a dismissible error `MessageBanner` in each dialog near the affected
   form or confirmation action using layout spacing that does not override the
   shared `DialogFooter` convention.
5. Replace or supplement narrow hook-mock tests with
   `renderWithProviders` and MSW workflows that assert the request, normalized
   alert, retained rename input, retained delete context, no navigation on
   failure, dismissal, and successful retry.
6. Retain successful rename/delete coverage for closure, invalidation-visible
   behavior where observable at this boundary, and delete navigation to `/`.

### Implementation notes

Use local component state because the message belongs to the mounted dialog.
Do not clear the rename field when the request fails or merely because the
error banner is dismissed. Prefer a shared close handler that clears transient
feedback before invoking the existing parent callback, while keeping all
pending-interaction decisions unchanged for the later dismissal-consistency
finding. Tests should assert user-visible alert text and workflow outcomes, not
state setters or hook internals.

### Validation

Format only the changed dialog source and tests with Prettier, then run:

```bash
npx prettier --write \
  src/features/views/components/EditViewModal.tsx \
  src/features/views/components/DeleteViewModal.tsx \
  src/features/views/components/__tests__/EditViewModal.test.tsx \
  src/features/views/components/__tests__/DeleteViewModal.test.tsx
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/features/views/components/__tests__/EditViewModal.test.tsx \
  src/features/views/components/__tests__/DeleteViewModal.test.tsx \
  src/features/views/components/__tests__/RemoveViewTransactionsModal.test.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx
npm run lint:fix
git diff --check
```

### Completion criteria

- Rename and delete failures render normalized persistent inline alerts.
- A rename failure preserves the typed name; a delete failure preserves the
  confirmation dialog and current route.
- Dismiss and retry behavior is covered, and successful retry retains the
  existing closure and navigation behavior without success feedback.
- Finding 4's behavior and test requirements are fully implemented without
  expanding into other dialog-consistency findings.
- The focused tests, `npm run lint:fix`, and `git diff --check` pass.

## Phase 4: Reconcile Notification Documentation and Run Full Validation

### Workspace

.

### Goal

Record the implemented saved-view error contract, accurately preserve the
remaining finding 2 work, and run the production, CSP-sensitive, and
documentation validation applicable to the completed slice.

### Scope

- Update `docs/api-integration.md` with the durable accessible contextual-error
  contract.
- Reconcile the production counts and saved-view entries in
  `docs/research/notification-inventory.md`.
- Record the partial finding 2 migration and resolve finding 4 in
  `docs/issues/view-dialog-notification-consistency-audit.md`.
- Scan for obsolete saved-view toast imports and verify the remaining toast
  inventory.
- Run full application validation plus the production-smoke and available
  browser CSP gates required by the added Motion-backed banner render sites.

### Non-goals

- Do not mark finding 2 resolved while other mutation failures still use
  transient toasts and toast styling, touch discoverability, and broader
  status-message coverage remain undecided.
- Do not check the audit item for replacing all retained transient mutation
  errors; this slice migrates only the two membership-removal errors and adds
  the two previously missing view errors.
- Do not restyle toasts, change their timeout or close control, migrate other
  features, or edit unrelated audit findings.
- Do not link this plan from durable non-plan documentation.
- Do not start Vite or Tilt; the user owns the local runtime.

### Required context

- Re-read the repository `AGENTS.md` documentation and validation rules,
  `docs/README.md`, the full notification audit, the notification inventory,
  and `docs/api-integration.md#user-facing-error-messages`.
- Re-read `docs/development.md#standard-build`,
  `docs/development.md#production-smoke-build-and-dropdown-gate`,
  `docs/architecture.md#content-security-policy`, and
  `docs/testing-guide.md#external-browser-harness` before validation.
- Treat API integration as the durable behavioral owner, the inventory as
  observed production evidence, and the audit as progress tracking. Avoid
  duplicating component walkthroughs in durable documentation.
- Browser tests require the user-managed production-smoke route, installed
  Chromium, and trusted local CA. If any is unavailable, report that explicitly
  and do not claim browser verification.

### Execution steps

1. Update the durable API integration rule to state that actionable mutation
   failures remain at the initiating feature boundary, use normalized API
   copy, preserve user effort, and expose errors as persistent alerts; describe
   remaining transient mutation toasts honestly as migration debt.
2. Recount production toast branches and `MessageBanner` render sites, move the
   two membership-removal failures from the toast inventory to contextual
   banners, add rename/delete failure entries, and retain all unrelated
   classifications.
3. Update the audit with a concise implementation record: finding 2 remains
   open after the first contextual-error migration, while finding 4 is resolved
   with normalized inline feedback and failure-path tests. Leave broader
   accessibility and toast checklist items unchecked unless the final source
   evidence fully satisfies them.
4. Scan production and tests for saved-view `toast` imports, stale toast mocks,
   the four contextual error render sites, semantic roles, and any accidental
   runtime styling or inline `style` additions; inspect the full diff for
   unrelated changes.
5. Run the focused saved-view and shared-banner tests, lint fixer, full
   coverage-gated build, production-smoke static gate, documentation checks,
   and diff checks.
6. If the user-managed external environment prerequisites are available, run
   the harness and CSP browser audit. Record that current application coverage
   does not directly exercise saved-view dialogs unless this plan separately
   added such E2E coverage; do not broaden `e2e/` merely to hide that limitation.

### Implementation notes

Expected inventory movement is two fewer toast-emission branches and four more
`MessageBanner` render sites relative to the post-success-removal inventory,
but verify actual source rather than copying those numbers blindly. Adding
existing `MessageBanner` instances changes where the current Motion component
executes but does not authorize new animation APIs, dependencies, generated
styles, or CSP exceptions. A passing dropdown static gate is supporting
evidence, not complete proof of the changed dialog workflows.

### Validation

Format only changed application and test files with the repository Prettier
configuration. Verify changed documentation links and referenced paths, then
run:

```bash
npx vitest run \
  src/components/__tests__/MessageBanner.test.tsx \
  src/features/views/components/__tests__/EditViewModal.test.tsx \
  src/features/views/components/__tests__/DeleteViewModal.test.tsx \
  src/features/views/components/__tests__/RemoveViewTransactionsModal.test.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx
npm run lint:fix
npm run build
npm run build:prod-smoke
rg -n "toast|MessageBanner|role=\"(alert|status)\"" \
  src/features/views src/components/MessageBanner.tsx \
  --glob '!**/__tests__/**'
git diff --check
```

When the external browser prerequisites are available, also run:

```bash
check-budget-analyzer-local-ca-trust
npx playwright install --list
npm run test:e2e:harness
npm run test:e2e:csp
```

Do not run `npm run dev`, start Tilt, disable HTTPS verification, or weaken a
CSP finding. Review `git diff --name-only` and `git diff` after formatter and
lint fixes to ensure they did not alter unrelated user work.

### Completion criteria

- Durable documentation defines the contextual accessible mutation-error
  contract without claiming the application-wide migration is complete.
- The inventory matches production source; finding 2 remains open with its
  remaining work explicit, and finding 4 is resolved with test evidence.
- No saved-view dialog emits a mutation error toast, and all four affected
  dialogs expose persistent normalized alerts at their initiating boundary.
- Focused tests, `npm run lint:fix`, `npm run build`,
  `npm run build:prod-smoke`, documentation checks, and `git diff --check`
  pass.
- Browser CSP results are reported when the user-managed environment is
  available; otherwise the exact unverified browser scope is reported.
