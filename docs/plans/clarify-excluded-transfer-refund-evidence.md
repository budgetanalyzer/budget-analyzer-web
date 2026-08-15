# Explicitly Excluded Transfer and Refund Evidence Plan

Keep explicitly excluded saved-view transactions available as evidence when a possible related
transaction is still visible, while making that state unmistakable in discovery, ambiguity
resolution, and the review dialog. The change will distinguish explicit exclusions from
transactions that are merely outside the view criteria, group completion work separately from new
possible relationships, and preserve the reversible bulk-exclusion workflow.

The existing frontend contracts are sufficient: `GET /v1/views/{id}/transactions` already returns
`matched`, `pinned`, and `excluded` IDs. No backend, OpenAPI, persistence, authentication, or
cross-repository prerequisite is required. Execute the phases in order and keep the existing
seven-day, percentage-only five-percent transfer tolerance, refund rules, on-demand discovery,
outside-criteria evidence, and one-to-one candidate behavior unless this plan explicitly changes
them.

## Phase 1: Carry Explicit Exclusion State Through Discovery

### Workspace

.

### Goal

Make candidate discovery distinguish explicit saved-view exclusions from ordinary outside-view
evidence and use that distinction as a deterministic ambiguity tie-breaker without weakening the
existing financial-evidence ordering.

### Scope

- Add a reusable view-membership query hook backed by the existing membership query key and API.
- Supply the canonical excluded transaction IDs to on-demand transfer/refund discovery.
- Add explicit-exclusion evidence to the candidate contract without making excluded rows eligible
  for exclusion again.
- Preserve candidates containing one visible side and one explicitly excluded side.
- Prefer an all-visible edge only when its existing amount, date, and description evidence is tied
  with an edge that uses non-visible evidence.
- Extend hook and pure-utility tests for membership propagation, candidate state, and deterministic
  ambiguity resolution.

### Non-goals

- Suppressing all previously excluded transactions from discovery.
- Treating an exclusion as proof that a transfer or refund relationship was previously confirmed.
- Persisting candidate relationships, review provenance, dismissals, or exclusion reasons.
- Changing the view-membership API, backend service, database schema, or query keys.
- Changing the seven-day transfer window, percentage-only five-percent transfer tolerance, refund
  tolerances, FX conversion, description rules, or transaction-direction rules.
- Adding a one-sided `Wise` or other description-keyword exclusion heuristic.

### Required context

- Read `AGENTS.md`, `src/types/view.ts`, `src/hooks/useViews.ts`,
  `src/features/views/types/transferRefundReview.ts`, and the complete discovery utility and test
  file before editing.
- Confirm `ViewMembershipResponse.excluded` and `viewApi.getViewTransactions` still exist. They are
  the satisfied local prerequisite; stop and report a prerequisite failure if that contract has
  been removed or materially changed.
- Review `ViewPage.tsx` and preserve `allTransactions` as the evidence collection, canonical visible
  `ViewTransaction[]` as the exclusion-eligibility boundary, and URL-filtered transactions as a
  table/stat projection only.
- Preserve the current dirty-worktree changes that removed the fixed transfer amount floor. Do not
  restore the obsolete USD-five tolerance described by older ephemeral plans.

### Execution steps

1. Add `useViewMembership(id)` in `src/hooks/useViews.ts` using
   `viewKeys.transactions(id)` and `viewApi.getViewTransactions(id)`. Reuse that hook inside
   `useViewTransactions` and `useExcludedViewTransactions` so membership fetching retains one
   contract and React Query cache entry; do not change either existing hook's public result shape.
2. In `ViewPage`, subscribe to canonical membership and include its readiness/error state in the
   existing on-demand discovery gate. Pass `membership.excluded` to the pure discovery utility
   only when the review is open and all discovery inputs are ready. Preserve unconditional hook
   calls and the current retry/query-invalidation behavior.
3. Extend `TransferRefundCandidate` with an ordered, explicit field identifying candidate sides
   already excluded from this view. Populate it from a set constructed once per discovery call;
   keep `eligibleExclusionTransactionIds` restricted to currently visible membership and omit
   candidates when neither side is visible exactly as today.
4. Add a candidate-edge membership classification used after amount difference, day distance, and
   shared-token count but before transaction-ID tie-breakers. For otherwise equal edges, prefer two
   visible sides over an edge using one non-visible side. Do not let membership status override a
   financially stronger edge, and keep input-order independence and one-to-one transaction reuse.
5. Extend `useViews.test.tsx`, `findTransferRefundCandidates.test.ts`, and the affected View page
   fixtures to prove canonical membership is shared, explicit exclusions are reported but never
   eligible, natural outside-view evidence remains distinguishable, both-excluded pairs remain
   absent, stronger financial evidence still wins, and all-visible edges win exact evidence ties.

### Implementation notes

- Explicit exclusion is saved-view-local state. The same transaction can be explicit evidence for
  one view and visible or naturally outside another view.
- A candidate admitted through an excluded side must still have at least one currently visible
  side. That invariant makes every displayed candidate actionable and prevents two handled rows
  from resurfacing together.
- Do not infer exclusion provenance. An explicit exclusion may have come from manual table action,
  transfer/refund review, or another user decision.
- Use ordered ID arrays in the public candidate contract, following debit then credit order, so
  fixtures and rendering remain deterministic.
- Quality ordering remains amount difference, date distance, and description evidence. Membership
  classification resolves only otherwise equal evidence before the stable ID fallback.

### Validation

Run the directly affected hook, utility, and page suites:

```bash
npx vitest run \
  src/hooks/__tests__/useViews.test.tsx \
  src/features/views/utils/__tests__/findTransferRefundCandidates.test.ts \
  src/features/views/pages/__tests__/ViewPage.test.tsx
```

Confirm discovery still has no server, persistence, date-library, or fixed-transfer-floor coupling:

```bash
rg -n "apiClient|localStorage|sessionStorage|date-fns|TRANSFER_FIXED_TOLERANCE|500" \
  src/features/views/utils/findTransferRefundCandidates.ts \
  src/features/views/types/transferRefundReview.ts
```

The search must return no matches.

### Completion criteria

- Canonical excluded IDs reach discovery through the existing React Query membership contract.
- Candidates distinguish explicitly excluded evidence from natural outside-view evidence.
- Explicitly excluded rows can support one visible counterpart but cannot be submitted for
  exclusion again.
- Pairs with no visible side remain suppressed.
- Existing financial quality controls ambiguity; all-visible membership wins only an otherwise
  exact evidence tie before stable ID ordering.
- Focused hook, utility, and page tests pass.

## Phase 2: Present Completion Candidates Clearly

### Workspace

.

### Goal

Make the review dialog clearly separate possible relationships that can complete a previous
exclusion from newly discovered relationships, without claiming that an earlier exclusion
confirmed the relationship.

### Scope

- Partition candidates in the dialog by whether they contain explicitly excluded evidence.
- Add a `Complete previous exclusions` section with concise explanatory copy.
- Keep new candidates in a separately labelled section while preserving their current ordering.
- Render `Previously excluded from this view` only for explicit exclusions.
- Retain `Not currently in this view` for non-visible transactions outside the canonical view for
  any other reason.
- Preserve checkbox eligibility, default selection, confirmation counts, loading/error handling,
  responsive layout, accessibility, and strict CSP compliance.

### Non-goals

- Adding a tooltip, new dependency, inline style, runtime stylesheet, or browser persistence.
- Calling an explicit exclusion a confirmed, accepted, matched, or previously reviewed
  relationship.
- Adding a toggle that hides excluded evidence or changing default candidate-selection behavior.
- Automatically restoring an excluded transaction or automatically excluding its visible
  counterpart.
- Redesigning the shared dialog primitive or other saved-view controls.

### Required context

- Confirm Phase 1 is complete and its focused validation passes.
- Read the complete `TransferRefundReviewDialog.tsx` and dialog test suite, plus the transfer/refund
  section of `ViewPage.test.tsx`.
- Preserve the current rule that only `eligibleExclusionTransactionIds` render checkboxes and that
  all eligible unique IDs default to selected until the user deselects them.
- Follow the repository's no-tooltip, callback memoization, no-inline-function-in-JSX, and strict
  CSP instructions.

### Execution steps

1. Derive two stable candidate arrays at the top of `TransferRefundReviewDialog`: completion
   candidates containing explicit exclusion evidence and new candidates without it. Preserve the
   incoming deterministic order inside each group and render completion work first.
2. Render the completion group under `Complete previous exclusions` with copy explaining that a
   possible related transaction remains in the view while another transaction is already
   excluded. Render remaining candidates under `New possible transfers and refunds`; omit empty
   group headings without changing the existing global empty state.
3. Pass explicit-exclusion state to each candidate row. Render `Previously excluded from this
   view` for those rows, retain `Not currently in this view` for natural outside-view evidence,
   and keep the visible related side's normal checked exclusion control. Do not add a checkbox or
   selection ID for an excluded row.
4. Extend dialog tests for completion-only, new-only, and mixed candidate collections; assert
   group order, precise status copy, natural outside-view copy, unique accessible checkbox names,
   selected-ID counts, and mutation payloads containing only visible eligible IDs.
5. Extend View page integration coverage with one visible transaction paired to an explicitly
   excluded transaction. Assert the completion copy and status are rendered, the visible side is
   selected, the excluded side has no checkbox, and ordinary outside-criteria evidence retains its
   existing label.

### Implementation notes

- The language must remain probabilistic. `Previously excluded` describes membership state, not
  why the user excluded the transaction or whether the proposed relationship is correct.
- Candidate grouping is presentation only. It must not mutate candidate order, membership, or the
  final unique selected-ID calculation.
- Both groups may contain refunds and transfers. Do not assume explicit evidence is transfer-only.
- Keep all status information inline and visible on mobile; do not encode the distinction only in
  color, iconography, hover, or DOM order.
- Reuse existing Tailwind classes and dialog components. No dynamic sizing or inline style is
  required.

### Validation

Run the dialog and page integration suites:

```bash
npx vitest run \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx \
  src/features/views/pages/__tests__/ViewPage.test.tsx
```

Confirm the new UI introduces no prohibited styling or stale ambiguous status copy:

```bash
rg -n "style=|\.style\.|createElement\(['\"]style|cssText|insertRule" \
  src/features/views/components/TransferRefundReviewDialog.tsx
rg -n "Complete previous exclusions|New possible transfers and refunds|Previously excluded from this view|Not currently in this view" \
  src/features/views/components/TransferRefundReviewDialog.tsx \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx \
  src/features/views/pages/__tests__/ViewPage.test.tsx
```

The first search must return no matches. The second must find every required state in production
code and focused tests.

### Completion criteria

- Completion candidates and new candidates are visibly and accessibly separated.
- Explicitly excluded rows say `Previously excluded from this view` and never expose an exclusion
  checkbox.
- Natural outside-view evidence retains `Not currently in this view`.
- Copy never claims that exclusion proves or confirms a relationship.
- Confirmation counts and mutation payloads include only currently visible, user-selected IDs.
- Dialog and View page focused suites pass with no CSP violation.

## Phase 3: Document and Harden the Membership Semantics

### Workspace

.

### Goal

Record the durable distinction between visible membership, outside-criteria evidence, and explicit
exclusion evidence, then pass repository-wide quality, coverage, production, and CSP gates.

### Scope

- Update durable saved-view transfer/refund behavior documentation.
- Review feature copy and tests for consistent exclusion terminology and probabilistic language.
- Run repository-required automatic fixes, formatting, full coverage/build, and production CSP
  smoke validation.
- Correct only regressions caused by this feature or directly affected contracts.

### Non-goals

- Linking non-plan documentation to this or any other plan file.
- Adding backend relationship state, audit history, exclusion provenance, or API changes.
- Documenting live financial examples, transaction IDs, names, descriptions, or debugging data.
- Changing unrelated components, formatting unrelated documentation, or performing git writes.
- Starting the development server.

### Required context

- Confirm Phases 1 and 2 are complete and all focused validations pass.
- Re-read the Saved Views sections of `docs/api-integration.md` and the View detail/state ownership
  sections of `docs/architecture.md` before editing.
- Re-read the documentation discipline, testing, CSP, no-tooltip, centralized configuration, and
  no-git instructions in `AGENTS.md`.
- Inspect `package.json` scripts and use `npm run lint:fix` directly; do not run `npm run lint`
  first and do not run `npm run dev`.

### Execution steps

1. Update `docs/api-integration.md` to explain that candidate discovery can use one explicitly
   excluded transaction as evidence for a possible related transaction still visible in the same
   view. Distinguish that state from ordinary outside-criteria evidence, state that excluded rows
   are never eligible for repeat exclusion, and retain the absence of persisted relationship or
   review provenance.
2. Update `docs/architecture.md` at the existing View detail client-projection description so the
   three membership states and their presentation/eligibility roles are durable without adding a
   component walkthrough or linking this plan.
3. Search the feature, tests, and durable docs for ambiguous `Not currently in this view` usage,
   relationship-confirmation language, obsolete fixed-transfer-floor behavior, and accidental
   server persistence. Correct only actual violations and rerun the affected focused suite.
4. Run `npm run lint:fix`, then `npm run format`, and review automatic edits to ensure they are
   limited to directly affected files. Run `npm run build`, which includes the complete coverage
   gate, TypeScript compilation, and the standard production bundle.
5. Run `npm run build:prod-smoke` and the strict-CSP bundle/source scans. Investigate every match;
   remove executable violations without exceptions and rerun the affected focused tests after any
   correction.

### Implementation notes

- Durable documentation should describe why explicit exclusions can remain evidence: it allows a
  visible counterpart to be handled after partial review or incremental data arrival.
- Also document the limitation: an exclusion is not relationship provenance and therefore must be
  presented as evidence, not confirmation.
- Do not document the transient live-data investigation or implementation history.
- `npm run build` already runs `npm run test:coverage`; avoid a redundant separate full coverage
  run unless diagnosing a failure.
- No new UI dependency or CSP-sensitive mechanism is needed. If one appears necessary, stop and
  report a design blocker instead of broadening the plan.

### Validation

Run repository-required cleanup and the complete standard build:

```bash
npm run lint:fix
npm run format
npm run build
```

Run the production CSP smoke build and scan source and bundle output:

```bash
npm run build:prod-smoke
rg -n "createElement\(['\"]style['\"]\)|setAttribute\(['\"]style|document\.(body|documentElement)\.style|styleSheet\.cssText|insertRule\(|eval\(|new Function\(" dist/
rg -n "style=|\.style\.|setAttribute\(['\"]style|createElement\(['\"]style|cssText|insertRule|eval\(|new Function\(" \
  src --glob '*.{ts,tsx,js,jsx}'
```

The bundle search must return no matches. The source search may find explanatory CSP comments but
must find no executable violation. Confirm durable documentation contains the new semantics and no
non-plan document links to a plan:

```bash
rg -n "explicitly excluded|Previously excluded|outside.*view|eligible|relationship" \
  docs/api-integration.md docs/architecture.md
rg -n "docs/plans|clarify-excluded-transfer-refund-evidence" \
  docs/api-integration.md docs/architecture.md README.md AGENTS.md
```

The first search must find the durable behavior. The second must return no matches.

### Completion criteria

- Durable documentation distinguishes visible membership, outside-criteria evidence, and explicit
  exclusion evidence without exposing live financial data.
- The UI and docs consistently describe possible relationships and never infer exclusion
  provenance.
- Existing transfer/refund rules, outside-view evidence, reversible exclusion, and restore behavior
  remain intact.
- Focused suites, `npm run lint:fix`, formatting, the coverage-gated standard build, production
  smoke build, and strict-CSP scans pass.
- No backend, OpenAPI, persistence, authentication, dependency, browser-storage, development-server,
  or git change is introduced.
