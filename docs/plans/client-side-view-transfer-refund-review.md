# Client-Side Saved-View Transfer and Refund Review Plan

Add a permanently client-side saved-view workflow that discovers possible internal transfers and
full refunds, explains each deterministic suggestion, and lets the user independently exclude the
debit, the credit, or both from the current saved view. Raw imports and transactions remain
unchanged. Discovery uses the complete active transaction collection as evidence, while the
existing saved-view bulk exclusion endpoint persists only the current view membership decisions.

The workflow is credit-anchored: a credit can point backward to a same-account refund debit or to
a debit from a different owned account. It does not attempt to classify merchants, employers, or
income. The workflow remains a modal; strict CSP is satisfied by repairing the shared dialog's
body scroll lock rather than substituting a different interaction.

This plan has one hard execution prerequisite: the closure criteria in
`docs/bugs/radix-dropdown-strict-csp.md` must be satisfied and that temporary bug document must be
removed. Until the Radix dropdown dependency and its runtime style/positioning behavior are gone,
the required application-wide CSP bundle scan cannot pass. That remediation is intentionally a
separate concern and is not folded into this saved-view feature. If the prerequisite is still open,
Phase 1 must stop before editing any feature or shared-dialog code.

Execute the phases in order. The shared CSP-safe scroll lock must be complete before the new modal
is built, and the review dialog and page integration depend on the candidate contract and
deterministic behavior established in the following phase.

## Phase 1: Make Shared Body Scroll Lock CSP-Safe

### Workspace

.

### Goal

Preserve modal and mobile-overlay background scroll locking without creating DOM `style`
attributes, and establish a CSP-safe shared primitive before adding another dialog consumer.

### Scope

- Verify the open Radix dropdown CSP defect has been remediated before making changes.
- Add a small reference-counted body scroll-lock utility that toggles the statically generated
  Tailwind `overflow-hidden` class.
- Replace direct `document.body.style.overflow` mutations in the shared `Dialog` and admin mobile
  overlay with the common utility.
- Preserve an `overflow-hidden` body class that existed before the application acquired its first
  lock.
- Add focused tests for single, overlapping, closing, and unmount cleanup behavior.
- Add runtime DOM assertions that opening shared dialogs creates neither a new `<style>` element
  nor a DOM `style` attribute.

### Non-goals

- Replacing modal UX with an inline panel, drawer, or different interaction.
- Remediating `@radix-ui/react-dropdown-menu`; that is the hard prerequisite tracked by
  `docs/bugs/radix-dropdown-strict-csp.md`.
- Replacing the custom dialog system with Radix Dialog or adding any dependency.
- Redesigning dialog focus management, markup, animations, sizing, or consumer APIs.
- Changing admin sidebar behavior beyond its body scroll-lock implementation.
- Suppressing, baselining, or adding exceptions to a CSP scan.

### Required context

- Read `AGENTS.md` and `docs/bugs/radix-dropdown-strict-csp.md` completely. If the bug document
  still has `Status: Open`, if `@radix-ui/react-dropdown-menu` or its unsafe runtime behavior
  remains, or if the bug's closure criteria do not pass, stop without editing and report the
  prerequisite.
- Run the bug document's production-smoke bundle scan before implementation. A known match must
  not be waived merely because it predates this feature.
- Review `src/components/ui/Dialog.tsx`, every direct dialog consumer, and
  `src/features/admin/components/AdminLayout.tsx` before changing the shared behavior.
- Review `src/features/admin/components/__tests__/AdminLayout.test.tsx`, representative modal
  consumer tests, and `src/testing/setup.ts` for cleanup conventions.
- Confirm the only live application body-style scroll locks are the shared dialog and admin mobile
  overlay. If discovery finds another equivalent lock, include it in the common migration rather
  than leaving two mechanisms.

### Execution steps

1. Prove the prerequisite is closed by confirming the temporary Radix bug document has been
   removed, building the production smoke bundle, and running its zero-exception CSP scan. Stop
   immediately if any dropdown style injection, floating inline positioning, or other known bug
   closure criterion remains.
2. Add `src/utils/bodyScrollLock.ts` with an acquire/release API designed for use inside external-
   system effects. On the first lock, remember whether `document.body` already had the literal
   `overflow-hidden` class and add it only when absent. Reference-count active locks, make each
   returned release callback idempotent, and remove the class only after the last application-
   owned lock is released and only when the utility originally added it.
3. Replace the `document.body.style.overflow` effect in `src/components/ui/Dialog.tsx` with the
   shared acquire/release utility. Acquire only while `open` is true and release on close or
   unmount. Keep the existing `Dialog` public API and all backdrop, Escape, close-button, and
   controlled/uncontrolled behavior unchanged.
4. Replace the equivalent body-style mutation in
   `src/features/admin/components/AdminLayout.tsx` with the same shared utility while retaining its
   mobile-only open/close, media-query, Escape, and sidebar state behavior.
5. Add `src/components/ui/__tests__/Dialog.test.tsx` to cover class acquisition and cleanup,
   preservation of a pre-existing `overflow-hidden` class, controlled close, unmount cleanup, and
   two simultaneously open dialogs retaining the class until both locks release. Record the
   number of `<style>` elements before opening, then assert it does not increase and that neither
   `document.body` nor dialog descendants acquire a `style` attribute.
6. Extend `src/features/admin/components/__tests__/AdminLayout.test.tsx` to prove the mobile overlay
   uses the same static class, removes it after Escape/close/unmount, and creates no body `style`
   attribute. Ensure test cleanup leaves no scroll locks or body classes for later suites.
7. Run representative existing modal tests to catch shared primitive regressions. Do not rewrite
   consumer components unless a failure reveals an actual shared-dialog compatibility defect.

### Implementation notes

- Class changes are CSP-safe because Tailwind emits `.overflow-hidden` into the static application
  stylesheet served under `style-src 'self'`; the browser receives no inline CSS declaration.
- A plain add/remove effect is insufficient because multiple dialogs or a dialog plus the admin
  overlay can overlap. The reference count is part of the correctness requirement, not optional
  abstraction.
- Preserve a class that predates the first lock. The utility owns only the class addition it made,
  not the body's complete class list.
- `useEffect` is appropriate here because scroll locking synchronizes React state with the external
  document. Do not derive component state in that effect.
- Avoid `setAttribute('style', ...)`, `style.cssText`, individual `.style` property assignments,
  CSSOM rule insertion, or dynamic `<style>` creation anywhere in the replacement.

### Validation

Run the shared primitive, admin overlay, and representative modal suites:

```bash
npx vitest run \
  src/components/ui/__tests__/Dialog.test.tsx \
  src/features/admin/components/__tests__/AdminLayout.test.tsx \
  src/components/__tests__/CreateViewModal.test.tsx \
  src/components/__tests__/InactivityWarningModal.test.tsx \
  src/features/views/components/__tests__/RestoreExcludedTransactionsModal.test.tsx
```

Confirm migrated production files contain no inline-style mechanism:

```bash
rg -n "style=|\.style\.|setAttribute\(['\"]style|createElement\(['\"]style|cssText|insertRule" \
  src/utils/bodyScrollLock.ts \
  src/components/ui/Dialog.tsx \
  src/features/admin/components/AdminLayout.tsx
```

The search must return no implementation matches. Explanatory comments that contain a prohibited
example may remain only when they are clearly documentation rather than executable code.

### Completion criteria

- The Radix dropdown CSP bug prerequisite is closed before this phase's edits begin.
- Shared dialogs and the admin mobile overlay lock body scrolling through one reference-counted,
  static-class mechanism.
- Opening those surfaces creates no DOM `style` attribute and no runtime `<style>` element.
- Pre-existing body classes, overlapping locks, close, Escape, and unmount cleanup behave
  correctly.
- Shared-dialog and representative consumer tests pass without changing the public dialog API.

## Phase 2: Implement Deterministic Transfer and Refund Discovery

### Workspace

.

### Goal

Create a pure, tested views-feature utility that finds one-to-one possible refunds and internal
transfers from active transactions without reading or writing server state.

### Scope

- Add views-feature types for a `REFUND` or `TRANSFER` candidate, its debit and credit, explanatory
  metrics, and the candidate transaction IDs that currently belong to the saved view.
- Scan every credit in the full active transaction collection and compare it with eligible debits.
- Use canonical saved-view membership only to determine which candidate sides can be excluded;
  transactions outside the view may still provide evidence.
- Normalize amounts to USD cents with transaction-date exchange rates before cross-currency
  comparison.
- Apply separate account, date, amount, and description rules for refunds and transfers.
- Resolve ambiguous candidates with deterministic ordering and prevent one transaction from being
  proposed in more than one accepted candidate.
- Add focused unit tests beside the discovery utility.

### Non-goals

- Adding or changing an API, backend recommendation engine, database field, or saved-view contract.
- Modifying import preview, duplicate detection, batch import, or transaction persistence.
- Classifying a credit as merchant income, payroll, employer income, or any other counterparty
  category.
- Automatically excluding transactions or treating a suggestion as authoritative.
- Supporting partial refunds, one-to-many transfers, split deposits, transfer fees as separate
  linked rows, or persistent candidate dismissal in the first iteration.
- Using machine learning, remote services, configurable rules, or a new dependency.

### Required context

- Confirm Phase 1 is complete, its focused tests pass, and the shared dialog no longer creates a
  body `style` attribute.
- Read `AGENTS.md` and confirm that this phase has no cross-repository prerequisite. The existing
  `GET /v1/transactions`, `GET /v1/views/{id}/transactions`, exchange-rate queries, and
  `POST /v1/views/{id}/exclude` contract are sufficient; stop if any of those contracts has been
  removed or materially changed.
- Review `src/types/transaction.ts`, `src/types/view.ts`, `src/utils/currency.ts`, and
  `src/utils/dates.ts` before defining candidate semantics.
- Review `src/hooks/useTransactions.ts` and `src/hooks/useViews.ts` to distinguish the complete
  active transaction collection from canonical visible saved-view membership.
- Keep all LocalDate arithmetic in `src/utils/dates.ts`; use its exported helpers rather than
  importing `date-fns` or constructing dates in the views feature.

### Execution steps

1. Add `src/features/views/types/transferRefundReview.ts` with explicit candidate types. Include a
   stable candidate key, kind, debit, credit, absolute day distance, normalized USD-cent amounts,
   amount difference in basis points, meaningful shared description tokens, and an ordered list of
   candidate transaction IDs that are currently eligible for exclusion from this view.
2. Add `src/features/views/utils/findTransferRefundCandidates.ts` as a pure function accepting the
   full active `Transaction[]`, canonical `ViewTransaction[]`, and the existing exchange-rate map.
   Normalize signs with `Math.abs`, reject zero-value rows, convert non-USD values only when a rate
   is available, and round converted values to integer USD cents before comparing them. Never
   compare unconverted values from different currencies when a rate is missing.
3. Implement normalized account and description helpers inside the views feature. Treat accounts
   as known-same when normalized bank and account identities agree. Treat them as known-different
   when banks differ or when the same bank has two present, unequal account IDs. Normalize
   descriptions case-insensitively into Unicode letter/number tokens, discard short punctuation
   noise and a small documented set of transaction boilerplate tokens, and do not add merchant or
   employer dictionaries.
4. Generate refund candidates only when the credit occurs on or after a known-same-account debit,
   the rows are at most 90 days apart, they share at least one meaningful description token, and
   the normalized amount difference is no more than the greater of 3 percent or USD 1. Generate
   transfer candidates only for known-different accounts at most 7 absolute days apart whose
   normalized amount difference is no more than the greater of 5 percent or USD 5. Transfer words
   such as `transfer`, `wise`, `remittance`, and `xfer` may be retained as explanatory evidence but
   must not be required for eligibility. Before ambiguity resolution, discard an edge when neither
   side belongs to canonical visible saved-view membership so an irrelevant outside-view pair
   cannot reserve a transaction needed by an in-view candidate.
5. Order eligible edges deterministically by lower amount difference, lower day distance, greater
   meaningful token overlap, then debit ID and credit ID. Traverse that order once, retaining an
   edge only when neither transaction was retained previously. Return retained candidates by
   descending credit date and descending credit ID so rerenders and repeated review runs produce
   the same suggestions and order.
6. For retained candidates, expose only the debit and/or credit IDs that are current members as
   eligible exclusion IDs; keep an outside-view or already-excluded counterpart visible only as
   evidence.
7. Add `src/features/views/utils/__tests__/findTransferRefundCandidates.test.ts` covering same-
   account refunds, different-account transfers, cross-currency conversion on each row's own date,
   negative and positive stored amounts, exact tolerance and date boundaries, missing rates,
   unrelated same-account descriptions, credits preceding putative refunds, zero amounts,
   ambiguous account identity, salary without a related debit, outside-view evidence, candidates
   with no current membership, deterministic ties, and prevention of transaction reuse.

### Implementation notes

- The 90-day/3-percent/USD-1 refund thresholds and 7-day/5-percent/USD-5 transfer thresholds are
  first-iteration product constants. Give them descriptive names and test their inclusive
  boundaries so later tuning is deliberate.
- `findNearestExchangeRate(...)` may be used to follow current application conversion behavior,
  but the discovery utility must check for a usable rate and omit an incomparable cross-currency
  edge instead of relying on `convertCurrency(...)` returning the original amount on failure.
- Account IDs can repeat across banks, so never use `accountId` alone as a global identity.
- A same-bank row without enough account information to prove same or different identity is
  ambiguous and should not produce a suggestion. Favor a missed suggestion over a misleading one.
- Type, account relationship, amount proximity, and date proximity establish the structural
  relationship. Description tokens are required for refunds but only explanatory for transfers.
- Use candidate terminology throughout this feature. Do not reuse import-facing duplicate or
  transaction-matching terminology.

### Validation

Run the focused utility suite:

```bash
npx vitest run src/features/views/utils/__tests__/findTransferRefundCandidates.test.ts
```

Confirm the utility has no API, React, browser-storage, direct date-library, or component coupling:

```bash
rg -n "apiClient|localStorage|sessionStorage|use[A-Z]|date-fns|new Date" \
  src/features/views/utils/findTransferRefundCandidates.ts \
  src/features/views/types/transferRefundReview.ts
```

Any match must be removed or be an intentional type name that does not introduce the prohibited
coupling.

### Completion criteria

- The pure utility produces deterministic, credit-anchored refund and transfer candidates.
- Cross-currency comparisons use transaction-date rates and omit rows with missing required rates.
- No transaction appears in more than one returned candidate.
- Transactions outside the view can support a candidate, but at least one side is a current view
  member and only current members are eligible for exclusion.
- Employer or merchant classification, server state, imports, and persistence remain untouched.
- The focused discovery tests pass.

## Phase 3: Build the Fine-Grained Review Dialog

### Workspace

.

### Goal

Present deterministic candidates in an accessible review dialog and persist the user's selected
view exclusions through the existing bulk exclusion mutation.

### Scope

- Add a `TransferRefundReviewDialog` under `src/features/views/components/`.
- Render possible refunds and possible transfers with their original transaction details and the
  deterministic reasons supplied by Phase 2.
- Give each in-view debit and credit an independent exclusion checkbox.
- Show outside-view evidence without presenting it as eligible for exclusion.
- Default every eligible side to selected on each fresh dialog opening while requiring an explicit
  final confirmation.
- Reuse `useBulkExcludeTransactions`, existing dialog/checkbox/button primitives, toast handling,
  currency/date utilities, and query error presentation.
- Add focused React Testing Library coverage for the complete dialog workflow.

### Non-goals

- Fetching transactions or exchange rates inside the presentation component.
- Adding a second confirmation modal after the review dialog.
- Persisting rejected candidates, user-edited rules, candidate types, relationship metadata, or an
  exclusion reason.
- Automatically applying a candidate, hiding a candidate without user action, or deleting a raw
  transaction.
- Adding tooltips, inline styles, runtime CSS, animation configuration, or a UI dependency.

### Required context

- Confirm Phases 1 and 2 are complete and their focused tests pass.
- Read `AGENTS.md`, especially the component callback, `useEffect`, CSP, toast, and test-placement
  rules.
- Review `src/features/views/components/BulkViewTransactionModal.tsx` for mutation and partial-
  success behavior, `RestoreExcludedTransactionsModal.tsx` for dialog/table accessibility, and
  `src/components/ui/Checkbox.tsx` plus `src/components/ui/Dialog.tsx` for owned primitive APIs.
- Review `src/utils/currency.ts` and `src/utils/dates.ts` and use their display helpers rather than
  formatting dates or currencies locally.

### Execution steps

1. Add `src/features/views/components/TransferRefundReviewDialog.tsx` with props for the view ID and
   name, Phase 2 candidates, discovery loading/error state, retry, close, and completion callbacks.
   Keep fetching in the page integration phase; the dialog may own only selection state and the
   existing bulk exclusion mutation.
2. Render each candidate with the inline label `Possible refund` or `Possible transfer`, then show
   the debit and credit as distinct rows containing type, formatted date, description, bank,
   account when present, and the absolute amount in its original currency. Show the day gap,
   approximate amount difference, and meaningful shared description evidence where applicable.
3. Render an independently labeled checkbox for each candidate side present in canonical view
   membership. Render a clear `Not currently in this view` label instead of a checkbox for an
   evidence-only side. Initialize the selected-ID set from all eligible IDs, deduplicate IDs before
   submission, and let the user uncheck either side without affecting the other.
4. Provide explicit loading, retryable error, and no-candidate states. The empty state must explain
   that no possible transfers or refunds were found and that manual exclusion remains available in
   the transaction table. Do not imply that the absence of a suggestion proves a credit is income.
5. Add `Cancel` and `Exclude N from this view` actions. Disable confirmation when no IDs are
   selected or the mutation is pending. Call `useBulkExcludeTransactions` with the unique selected
   IDs, close on any nonzero success, call the completion callback, and mirror existing success,
   partial-success, zero-update, and formatted error toasts.
6. Prevent dismissal while exclusion is pending and keep all JSX callbacks synchronous and
   memoized. Use a small candidate-row component where necessary so checkbox handlers are not
   created inline inside a map. Use Tailwind classes only, preserve mobile wrapping/scrolling, and
   place every explanation inline rather than in a tooltip.
7. Add `src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx` covering labels
   and explanation text, original-currency amounts, default selections, independent debit/credit
   toggles, outside-view evidence, unique submitted IDs, zero-selection disabling, loading, empty,
   error/retry, mutation-pending dismissal protection, complete success, partial success, zero
   update, API failure, toast feedback, and reopening through remount with reset default selection.
   Record the DOM's `<style>` element count before opening and assert that opening and interacting
   with this concrete dialog does not increase it or add any `style` attribute to the body or
   rendered review subtree.

### Implementation notes

- The user is reviewing exclusions, not confirming a durable relationship. Visible copy must use
  `possible`, `transfer`, `refund`, `related`, and `exclude`; do not call the operation matching,
  reconciliation, deletion, or duplicate handling.
- Both eligible sides default to selected because a full refund or internal transfer is normally
  neutral in this workflow, but no mutation occurs until the final explicit action.
- When only one side belongs to the current view, selecting that side is still valid. The other
  transaction explains why it was suggested but should not be sent to the view exclusion API.
- Conditionally mounting the dialog from the page will reset selection on every opening without a
  derived-state `useEffect`.
- The existing restore-excluded workflow remains the only undo surface and must continue to work
  without any special candidate metadata.

### Validation

Run the discovery and dialog suites together:

```bash
npx vitest run \
  src/features/views/utils/__tests__/findTransferRefundCandidates.test.ts \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx
```

Check the new component for prohibited styling and ambiguous destructive language:

```bash
rg -n "style=|\.style\.|setAttribute\(['\"]style|createElement\(['\"]style|insertRule|cssText|tooltip|Delete|Matching|Duplicate" \
  src/features/views/components/TransferRefundReviewDialog.tsx \
  src/components/ui/Dialog.tsx \
  src/utils/bodyScrollLock.ts
```

The search must produce no prohibited implementation or user-facing wording.

### Completion criteria

- The dialog explains every candidate and allows independent debit/credit selection.
- Evidence outside the view is visible but cannot be submitted for exclusion.
- No exclusion happens before explicit confirmation.
- The dialog submits unique current-view IDs through the existing bulk exclusion mutation and
  handles all success and failure outcomes consistently with existing view bulk actions.
- Selection resets through remount without a synchronization `useEffect`.
- Opening the actual review dialog produces no runtime `<style>` element or DOM `style` attribute.
- The focused utility and dialog tests pass and the UI remains strict-CSP compliant.

## Phase 4: Integrate Discovery With Saved-View Detail

### Workspace

.

### Goal

Add the complete `Find Transfers & Refunds` workflow to saved-view detail using all active
transactions as evidence and canonical view membership as the exclusion boundary.

### Scope

- Fetch the complete active transaction list explicitly from `ViewPage` through the shared React
  Query hook.
- Compute candidates from the full raw collection, canonical unfiltered saved-view membership, and
  the exchange-rate map.
- Add a saved-view header action that opens the review dialog.
- Keep discovery loading and failure isolated from the primary saved-view table and analytics.
- Ensure URL-backed temporary table filters do not silently narrow candidate discovery or change
  which canonical view members are eligible.
- Extend `ViewPage` tests for the integrated workflow and query boundaries.

### Non-goals

- Adding this action to the all-transactions page, import review, analytics, transaction detail, or
  saved-view cards.
- Changing saved-view criteria, URL filters, membership reconciliation, pin/exclude precedence, or
  restore behavior.
- Caching candidates in Redux, browser storage, React Query, or the server.
- Making discovery failure fatal to loading the saved view.
- Adding permissions beyond those already governing user-owned saved-view actions.

### Required context

- Confirm Phases 1 through 3 are complete and their focused suites pass.
- Review `src/features/views/pages/ViewPage.tsx` completely, including canonical `transactions`,
  derived `filteredTransactions`, exchange-rate loading, header actions, and conditional restore
  dialog mounting.
- Review `src/features/views/pages/__tests__/ViewPage.test.tsx` and its hook mocks before changing
  query behavior.
- Review `src/hooks/useTransactions.ts` and `src/hooks/useCurrencies.ts`. An explicit
  `useTransactions()` call in `ViewPage` shares the existing `['transactions']` query even though
  `useExchangeRatesMap` also consumes it; do not couple the feature to that hook's internal fetch as
  an undocumented side effect.

### Execution steps

1. Call `useTransactions()` explicitly from `ViewPage` and retain its data, loading, error, and
   refetch state as discovery evidence. Also retain the exchange-rate hook's error state. Do not
   add another API function or query key.
2. Derive candidates with `useMemo` from `allTransactions`, canonical `transactions` returned by
   `useViewTransactions`, and `exchangeRatesMap`. Never pass `filteredTransactions`; temporary
   `q`, date, bank, account, type, and amount URL filters affect the table and stats only.
3. Add a memoized open/close state pair and a header button labeled `Find Transfers & Refunds` near
   `Analyze View`. Keep the action available when the saved view itself is usable. Opening it while
   evidence or rates are loading must show the dialog's loading state rather than blank results.
4. Conditionally mount `TransferRefundReviewDialog` only while it is open. Pass the current view,
   derived candidates, combined discovery loading/error state, and a retry callback that refetches
   the transaction collection and invalidates the existing exchange-rate query family. Treat a
   transaction-query or exchange-rate-query error as local to this dialog; do not replace the
   saved-view page with its error state.
5. Allow same-currency discovery without currency conversion, but wait for active exchange-rate
   queries before presenting a final candidate list. When a configured currency has no usable
   rate rather than a query failure, omit only the incomparable cross-currency candidates and rely
   on the existing page-level missing-exchange-rate banner for remediation.
6. On successful exclusion, let `useBulkExcludeTransactions` invalidate view detail, membership,
   and list queries as it does today. Close the dialog and allow the refreshed canonical membership,
   stats, table, analytics source, excluded count, and Restore Excluded action to reflect the
   decision without optimistic candidate state.
7. Update `src/features/views/pages/__tests__/ViewPage.test.tsx` to mock the explicit full-
   transaction query and cover opening/closing, loading and local error isolation, retry, an
   outside-view credit supporting an in-view debit, both sides being selectable when both are
   canonical members, and temporary URL filters not narrowing the candidate input. Preserve all
   existing analytics, filtering, table, and restore assertions.

### Implementation notes

- `transactions` from `useViewTransactions` is canonical visible saved-view membership;
  `filteredTransactions` is only a temporary table/stat projection; and `allTransactions` is the
  discovery evidence pool. Keep these names and responsibilities visibly distinct.
- Full active transactions are not editable drafts or import preview rows. The feature must not
  inspect preview state or import file provenance.
- A candidate counterpart missing from canonical membership may be outside the view criteria or
  already excluded. Label it conservatively as `Not currently in this view`; do not claim which
  reason applies without additional membership data.
- Use an existing Lucide icon and existing primitives. Do not add a package or inline dynamic
  styles.

### Validation

Run all directly affected views-feature suites:

```bash
npx vitest run \
  src/features/views/utils/__tests__/findTransferRefundCandidates.test.ts \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx \
  src/features/views/pages/__tests__/ViewPage.test.tsx \
  src/features/views/components/__tests__/ViewTransactionTable.test.tsx \
  src/features/views/components/__tests__/RestoreExcludedTransactionsModal.test.tsx
```

Search production integration code to confirm the feature does not reach into import or create a
new client/API contract:

```bash
rg -n "preview|allowDuplicate|duplicateReason|localStorage|sessionStorage" \
  src/features/views/pages/ViewPage.tsx \
  src/features/views/components/TransferRefundReviewDialog.tsx \
  src/features/views/utils/findTransferRefundCandidates.ts
```

Any occurrence must be removed; this workflow is independent of import and persistent client
storage.

### Completion criteria

- Saved-view detail exposes `Find Transfers & Refunds` and opens the client-side review dialog.
- Discovery uses all active transactions as evidence and canonical saved-view membership as the
  only exclusion boundary.
- Temporary table filters do not alter discovery semantics.
- Discovery loading or failure does not prevent the saved view, table, or analytics action from
  rendering.
- Confirmed exclusions flow through the existing mutation and refresh/restore behavior.
- All directly affected views-feature tests pass.

## Phase 5: Document, Harden, and Validate the Complete Workflow

### Workspace

.

### Goal

Finish the feature with durable architecture/API-integration documentation, accessibility and CSP
review, formatting, coverage, and production builds.

### Scope

- Document the client/server boundary and exact saved-view behavior in existing durable docs.
- Document static-class body scroll locking in the existing strict-CSP architecture guidance.
- Review all new UI copy, keyboard labels, responsive behavior, and reversible exclusion language.
- Run automatic lint fixes and formatting as required by repository instructions.
- Run the complete coverage gate, standard production build, production smoke build, and strict-CSP
  bundle scan.
- Resolve regressions in the feature and directly affected code without unrelated cleanup.

### Non-goals

- Linking a non-plan document to this plan file.
- Adding backend/OpenAPI fields, candidate persistence, analytics modes, import behavior, or future
  partial-refund support.
- Changing thresholds based only on speculative cases after the focused tests establish the agreed
  first-iteration behavior.
- Performing any git write operation or starting the development server.

### Required context

- Confirm Phases 1 through 4 are complete and their focused validations pass.
- Confirm `docs/bugs/radix-dropdown-strict-csp.md` is absent because its closure criteria were
  satisfied, not renamed or waived, and confirm the shared body scroll-lock tests still pass.
- Read the Saved Views and Transaction Import Review sections of `docs/api-integration.md` and the
  Page Responsibilities and State Management sections of `docs/architecture.md` before editing.
- Re-read the documentation discipline, testing, CSP, no-tooltip, centralized date, and no-git
  instructions in `AGENTS.md`.
- Inspect `package.json` scripts before running validation; use `npm run lint:fix` directly and do
  not run `npm run dev`.

### Execution steps

1. Update `docs/api-integration.md` under Saved Views to describe credit-anchored client discovery,
   complete active transactions as evidence, canonical membership as the exclusion boundary,
   outside-view evidence, independent debit/credit selection, bulk exclusion persistence, and the
   existing restore path. State explicitly that no recommendation or relationship API is involved
   and that import duplicate review is unrelated.
2. Update `docs/architecture.md` so View detail owns transfer/refund review as local UI state and a
   derived client-side projection. Document that raw transaction server state and exchange rates
   feed deterministic candidates, while only confirmed excluded IDs become saved-view server
   state. In its existing CSP section, record the durable rule that modal/mobile-overlay body
   scroll locking toggles a static stylesheet-backed class through the shared reference-counted
   utility and never writes `document.body.style`. Do not link to this plan.
3. Review rendered copy and accessibility semantics in tests: the action and dialog must say
   `Find Transfers & Refunds`, `Possible refund`, `Possible transfer`, `Not currently in this
   view`, and `Exclude N from this view`; every checkbox needs a unique transaction-specific
   accessible name; loading, empty, and error states must be understandable without color, hover,
   or a tooltip.
4. Run `npm run lint:fix`, then `npm run format`. Review any automatic edits and limit follow-up
   changes to the feature, its tests, and directly affected documentation/code.
5. Run `npm run build`, which enforces the complete coverage gate before the standard TypeScript
   and Vite production build. Fix meaningful behavior or test gaps; do not add percentage-only
   tests or disable lint/coverage rules.
6. Run `npm run build:prod-smoke`, then scan `dist/` for runtime style injection and evaluation.
   Confirm the scan returns zero matches with no baseline or dependency exception, no new
   dependency was added, and the feature uses Tailwind classes with no inline `style` attributes.
7. Perform a final focused search for stale or misleading feature copy, direct date-library usage,
   browser persistence, import coupling, and accidental server recommendation contracts. Correct
   only actual violations and rerun the affected focused suite after any correction.
8. Search application source for direct `.style` writes, `style` attributes, dynamic style
   elements, `cssText`, CSSOM rule insertion, and runtime evaluation. Investigate every result;
   executable violations must be removed, while explanatory CSP comments may remain. Re-run the
   Phase 1 and Phase 3 runtime DOM assertions after any CSP-related correction.

### Implementation notes

- Documentation should describe durable behavior and ownership boundaries, not threshold-tuning
  history, transient component state mechanics, or a component walkthrough.
- `npm run build` already includes `npm run test:coverage`; do not run an additional redundant full
  coverage command unless diagnosing a failure.
- The production smoke build intentionally uses a different base path for CSP verification. It is
  not the normal release artifact.
- No new UI dependency is needed. If implementation unexpectedly introduces one, stop and remove
  it rather than broadening this plan without user approval.

### Validation

Run repository-required cleanup and the full standard build:

```bash
npm run lint:fix
npm run format
npm run build
```

Run the CSP/security smoke build and inspect it for prohibited runtime behavior:

```bash
npm run build:prod-smoke
rg -n "createElement\(['\"]style['\"]\)|setAttribute\(['\"]style|document\.(body|documentElement)\.style|styleSheet\.cssText|insertRule\(|eval\(|new Function\(" dist/
rg -n "style=|\.style\.|setAttribute\(['\"]style|createElement\(['\"]style|cssText|insertRule|eval\(|new Function\(" \
  src --glob '*.{ts,tsx,js,jsx}'
test ! -e docs/bugs/radix-dropdown-strict-csp.md
```

The bundle `rg` must return no matches, with no exception for pre-existing or dependency code. The
source `rg` may find explanatory CSP comments, but it must find no executable style or evaluation
mechanism. The final command must prove the prerequisite bug was closed and its temporary document
removed. Also verify the durable docs contain the new behavior and do not link to plans:

```bash
rg -n "Transfers & Refunds|transfer|refund|client-side|bulk exclusion" \
  docs/api-integration.md docs/architecture.md
rg -n "docs/plans|client-side-view-transfer-refund-review" \
  docs/api-integration.md docs/architecture.md README.md AGENTS.md
```

The first search must find the documented workflow. The second must return no matches.

### Completion criteria

- Durable documentation accurately describes the permanently client-side discovery and existing
  server-side saved-view exclusion boundary without conflating the feature with imports.
- User-facing language consistently describes transfers, refunds, possible relationships, and
  reversible view exclusions rather than matching, reconciliation, deletion, or duplicates.
- Accessibility, responsive layout, strict CSP, centralized date/currency usage, and component
  callback rules are satisfied.
- The Radix dropdown defect is closed, all body scroll locking uses the static shared class, and
  runtime dialog tests prove no `<style>` element or DOM `style` attribute is created.
- `npm run lint:fix`, formatting, the full coverage-gated standard build, the production smoke
  build, and the CSP bundle scan pass.
- No backend, OpenAPI, import, dependency, browser-storage, or git change is introduced.
