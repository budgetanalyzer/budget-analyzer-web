# Transfer and Refund Review Findings Remediation Plan

Fix the four review findings in the saved-view transfer/refund workflow: never allow exclusions
from candidates hidden by discovery loading or failure, avoid running quadratic pair discovery on
ordinary saved-view renders, compare same-currency amounts without depending on exchange rates,
and make case normalization deterministic across browser locales.

The implementation remains entirely client-side and preserves the existing candidate rules,
one-to-one ambiguity resolution, saved-view exclusion API, and restore workflow. Same-currency
pairs will use their original currency as the comparison unit; only cross-currency pairs will
normalize through transaction-date USD exchange rates. The quadratic scan will remain a deliberate
on-demand operation when the review is open and discovery inputs are ready, rather than running on
every saved-view load. No cross-repository or backend prerequisite is required.

Execute the phases in order. Each phase must retain the existing directly affected behavior and
leave its focused tests passing before the next phase begins.

## Phase 1: Correct Currency and Case-Normalization Semantics

### Workspace

.

### Goal

Make candidate discovery compare same-currency rows directly and normalize text and currency codes
independently of the browser locale, while preserving cross-currency FX requirements and
deterministic one-to-one selection.

### Scope

- Refactor amount preparation so valid nonzero transactions are not discarded merely because an
  exchange rate is unavailable before a pair is considered.
- Compare two rows in their original amount units when their normalized currency codes match.
- Continue converting both sides to USD at their own transaction dates for cross-currency pairs,
  omitting only those cross-currency edges whose required rate is unavailable or invalid.
- Replace locale-sensitive identity, description, and currency-code casing with deterministic
  locale-independent casing.
- Remove or replace candidate fields whose names claim all comparison amounts are USD when that is
  no longer true.
- Extend focused utility tests for the corrected behavior and update typed test fixtures affected
  by the candidate contract cleanup.

### Non-goals

- Changing refund/transfer account, direction, date, description, or one-to-one reuse rules.
- Adding a currency metadata dependency or attempting currency-specific minor-unit precision.
- Fetching exchange rates from the utility or changing exchange-rate query behavior.
- Supporting partial refunds, fees, split transfers, or one-to-many candidates.
- Indexing the debit/credit search in this phase; invocation cost is isolated in Phase 2.
- Adding a backend relationship or recommendation contract.

### Required context

- Read `AGENTS.md`, `src/features/views/utils/findTransferRefundCandidates.ts`,
  `src/features/views/types/transferRefundReview.ts`, and the complete focused utility test file.
- Review `findNearestExchangeRate` in `src/utils/currency.ts` and retain its existing nearest-rate
  semantics for cross-currency conversion.
- Review candidate-field consumers with `rg` before changing the type. At plan creation time the
  two normalized USD-cent fields are asserted only in tests and are not rendered by the dialog;
  confirm that remains true before removing them.
- The existing transaction, view-membership, and exchange-rate types are sufficient. Stop and
  report a prerequisite only if those local contracts have been removed or materially changed.

### Execution steps

1. Split transaction preparation from pairwise amount comparison. Precompute the original
   transaction, a deterministic uppercase currency code, a finite nonzero absolute amount, and
   deterministic description tokens without requiring an FX rate.
2. Add a pair-level comparison helper. When debit and credit currency codes match, round and
   compare their absolute original amounts in that currency. When the codes differ, lazily convert
   each side to USD cents using its own transaction date and require a valid rate for every non-USD
   side. Memoize per-transaction USD conversion within one discovery call so repeated cross-
   currency edges do not repeat rate lookup and conversion work.
3. Apply the existing percentage and fixed-unit tolerances to the pair's comparison currency:
   original-currency units for same-currency pairs and USD units for cross-currency pairs. Keep the
   unitless amount-difference basis points exposed to the dialog and order competing edges first by
   that unit-independent value instead of comparing native-currency cents with USD cents.
4. Remove `normalizedDebitAmountUsdCents` and `normalizedCreditAmountUsdCents` from the public
   candidate type and construction because they are unused presentation data and can no longer be
   truthfully populated for a same-currency pair without rates. Update existing candidate fixtures
   and assertions without replacing them with misleading generic amount fields.
5. Replace every `toLocaleLowerCase()` and `toLocaleUpperCase()` in the discovery utility with
   `toLowerCase()` and `toUpperCase()`. Retain Unicode NFKC normalization, trimming, tokenization,
   and the existing boilerplate-token rules.
6. Extend the utility suite to prove that an exact EUR/EUR refund and an exact EUR/EUR transfer are
   found with no EUR rate, and that equal original EUR amounts remain a match even when available
   rates differ across the two transaction dates. Keep the existing cross-currency missing-rate
   rejection and per-row-date conversion tests.
7. Add mixed-case bank, account, description-token, and currency-code cases using values such as
   `WISE` and `Wise`. Preserve existing tolerance boundaries, deterministic tie behavior,
   outside-view evidence rules, and transaction non-reuse assertions.

### Implementation notes

- Decide comparison currency before asking for an exchange rate. Eager per-row USD normalization
  is the cause of the missing same-currency candidates.
- Treat a blank normalized currency code, non-finite amount, or zero amount as invalid. Do not let
  two blank currency strings qualify as a same-currency pair.
- For same-currency pairs, the fixed refund and transfer tolerance floors become one and five units
  of that currency respectively; percentage tolerances remain unchanged. For cross-currency pairs,
  those floors remain USD 1 and USD 5.
- Basis points are unitless and remain suitable for dialog explanation and cross-unit ambiguity
  ranking. Keep all final tie-breakers explicit so input order cannot affect output.
- `toLowerCase()` and `toUpperCase()` are intentional here: candidate identity must not vary with
  the user's browser locale.

### Validation

Run the utility and candidate-consuming dialog suites:

```bash
npx vitest run \
  src/features/views/utils/__tests__/findTransferRefundCandidates.test.ts \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx
```

Confirm locale-sensitive casing and eager API/browser coupling are absent:

```bash
rg -n "toLocaleLowerCase|toLocaleUpperCase|apiClient|localStorage|sessionStorage|date-fns|new Date" \
  src/features/views/utils/findTransferRefundCandidates.ts \
  src/features/views/types/transferRefundReview.ts
```

The search must return no matches.

### Completion criteria

- Exact same-currency non-USD refunds and transfers are discoverable without any FX rate.
- Rate movement between two dates cannot distort a same-currency amount comparison.
- Cross-currency pairs still require usable transaction-date rates for every converted side.
- Candidate casing behavior is deterministic across browser locales.
- The public candidate type contains no falsely USD-labelled same-currency comparison amounts.
- Existing deterministic selection, membership, and focused test behavior remains intact.

## Phase 2: Gate Discovery and Block Hidden-Candidate Submission

### Workspace

.

### Goal

Run pair discovery only for an open, ready review and make it impossible to submit cached or
partial candidates while the dialog is showing a loading or error state.

### Scope

- Gate `findTransferRefundCandidates` in `ViewPage` on the review being open and discovery inputs
  being ready.
- Preserve all data hooks, page rendering, local discovery error handling, retry behavior, and
  canonical membership inputs.
- Disable confirmation during discovery loading or failure even if the dialog receives nonempty
  candidates.
- Add the same loading/error checks inside the confirmation callback as a defense against stale
  renders or direct invocation.
- Add regression tests at both the dialog and page-integration boundaries.

### Non-goals

- Delaying or conditionally calling React hooks.
- Changing React Query keys, cache timing, refetch policy, or the full-transaction evidence source.
- Hiding or disabling the `Find Transfers & Refunds` action while discovery data is loading.
- Building a date/amount index in this focused remediation. The accepted scalability fix is to
  remove the quadratic work from routine navigation and run it only after explicit user action.
- Moving candidates into Redux, React Query, browser storage, or a web worker.
- Changing mutation success, partial-success, error, close, or restore behavior.

### Required context

- Confirm Phase 1 is complete and its focused suites pass.
- Read `TransferRefundReviewDialog.tsx` and its complete test suite, then read `ViewPage.tsx` and
  the transfer/refund section of `ViewPage.test.tsx`.
- Preserve the distinction between `allTransactions` as evidence, canonical `transactions` as the
  exclusion boundary, and `filteredTransactions` as the temporary table/stat projection.
- Keep hook calls unconditional and at the top level. Only the derived computation is gated.

### Execution steps

1. In `ViewPage`, derive the combined discovery loading and error states before the candidate
   memo. Change the memo so it returns an empty list without calling
   `findTransferRefundCandidates` unless the dialog is open, discovery is not loading, and no
   discovery error is present.
2. Keep `isTransferRefundReviewOpen`, `allTransactions`, canonical view transactions, exchange
   rates, and discovery readiness in the memo dependency list. When the dialog opens with ready
   data, compute candidates once; recompute while open only when one of those real inputs changes.
3. In `TransferRefundReviewDialog`, derive one confirmation-eligibility boolean that requires a
   nonempty selection, no pending mutation, no discovery loading, and no discovery error. Use it
   for the button's disabled state.
4. Guard `handleConfirm` with the same four conditions before invoking the bulk exclusion mutation.
   Include loading and error in the memoized callback dependencies. Do not rely only on the DOM
   `disabled` attribute for correctness.
5. Extend dialog tests with nonempty stale candidates in both loading and error states. Assert the
   candidate rows are hidden, confirmation remains disabled, and attempts to activate it never
   call the mutation. Retain the existing empty-loading and retry coverage.
6. Instrument candidate discovery in `ViewPage.test.tsx` with a mock wrapper or spy that preserves
   real behavior for integration cases. Assert routine page render performs zero discovery calls,
   opening a ready dialog triggers discovery, and opening during loading or error does not invoke
   discovery until the inputs become ready. Also assert closing the dialog prevents subsequent
   unrelated page rerenders from performing discovery.
7. Run all directly affected suites and correct only regressions in discovery, dialog selection,
   saved-view integration, or their fixtures.

### Implementation notes

- Do not conditionally call `useTransactions`, `useExchangeRatesMap`, or any other hook. Gating the
  pure `useMemo` body is sufficient to remove the O(credits x debits) work from normal saved-view
  renders.
- Returning `[]` while closed/loading/failed also avoids retaining hidden candidates in page props,
  but the dialog-level disabled state and callback guard are still mandatory defense in depth.
- Keep the dialog conditionally mounted so selection continues to reset on each fresh opening
  without a synchronization effect.
- Loading and error states may coexist with cached React Query data. Treat the state flags, not the
  presence of candidate data, as authoritative for whether confirmation is safe.

### Validation

Run the three directly affected suites:

```bash
npx vitest run \
  src/features/views/utils/__tests__/findTransferRefundCandidates.test.ts \
  src/features/views/components/__tests__/TransferRefundReviewDialog.test.tsx \
  src/features/views/pages/__tests__/ViewPage.test.tsx
```

Inspect the integration to confirm the full scan has one gated call site and no hook is called
conditionally:

```bash
rg -n "findTransferRefundCandidates|isTransferRefundReviewOpen|isTransferRefundDiscoveryLoading|transferRefundDiscoveryError" \
  src/features/views/pages/ViewPage.tsx \
  src/features/views/pages/__tests__/ViewPage.test.tsx
```

### Completion criteria

- Rendering or rerendering a saved view with the review closed performs no pair discovery.
- Opening a ready review computes from all active transactions and canonical membership.
- Loading and failed discovery states neither compute nor submit hidden candidates.
- The confirmation button and callback independently enforce the same safe conditions.
- Retry, selection, exclusion mutation, close, and temporary-filter behavior remain unchanged.
- All directly affected suites pass.

## Phase 3: Document and Validate the Remediation

### Workspace

.

### Goal

Record the corrected durable behavior and complete repository-level formatting, coverage, build,
and strict-CSP validation.

### Scope

- Update existing architecture and API-integration documentation at the level of durable behavior.
- State that same-currency discovery is direct, cross-currency discovery uses transaction-date FX,
  and candidate derivation is on demand while the review is open.
- Run repository-required automatic lint fixes and formatting.
- Run the full coverage/build gate and production CSP smoke build.
- Inspect source and bundle output for prohibited style/runtime behavior and relevant stale wording.

### Non-goals

- Linking durable documentation to this plan or the original feature plan.
- Documenting component internals, test mechanics, review history, or performance benchmark numbers.
- Changing product thresholds or candidate wording beyond what Phases 1 and 2 require.
- Adding dependencies, starting the development server, or performing git write operations.
- Unrelated cleanup discovered by lint, formatting, or searches.

### Required context

- Confirm Phases 1 and 2 are complete and all three directly affected suites pass.
- Read the Saved Views section of `docs/api-integration.md` and the state/page responsibility
  sections of `docs/architecture.md` before editing.
- Re-read the documentation, lint, testing, CSP, and no-git instructions in `AGENTS.md`.
- Inspect `package.json` scripts before validation. Use `npm run lint:fix` directly and never start
  `npm run dev`.

### Execution steps

1. Update `docs/api-integration.md` so the saved-view workflow says same-currency pairs are compared
   directly in their original currency without requiring rates, while cross-currency pairs use
   each row's transaction-date rate. Preserve the client/server exclusion boundary and import-
   review separation.
2. Update `docs/architecture.md` to state that the quadratic candidate projection is derived only
   while the review dialog is open and discovery inputs are ready, so ordinary saved-view
   navigation does not perform pair discovery. Keep the statement focused on ownership and
   lifecycle rather than implementation walkthrough.
3. Run `npm run lint:fix`, followed by `npm run format`. Review automatic changes and keep any
   follow-up edits limited to the remediation, its tests, and affected durable documentation.
4. Run `npm run build`, which includes the repository coverage gate, TypeScript checking, and the
   standard production bundle. Fix meaningful affected-code regressions without disabling rules or
   adding percentage-only tests.
5. Run `npm run build:prod-smoke` and the strict-CSP bundle scan. Confirm the remediation added no
   inline styles, runtime style injection, evaluation, or dependency.
6. Run final searches for locale-sensitive casing in the utility, falsely USD-labelled candidate
   fields, and durable documentation statements. Correct actual violations and rerun the affected
   focused suite after any change.

### Implementation notes

- Documentation must describe why rates are optional for same-currency evidence and required for
  cross-currency evidence without enumerating helper functions or transient state variables.
- `npm run build` already runs full coverage; do not duplicate that expensive command unless
  diagnosing a failure.
- No styling change or dependency should be necessary. Existing strict-CSP assertions remain part
  of regression validation even though these fixes are primarily state and discovery logic.
- Do not edit the original ephemeral feature plan to masquerade as durable documentation; this
  remediation plan and the current durable docs have separate purposes.

### Validation

Run repository-required cleanup and the complete standard build:

```bash
npm run lint:fix
npm run format
npm run build
```

Run the CSP/security smoke build and scans:

```bash
npm run build:prod-smoke
rg -n "createElement\(['\"]style['\"]\)|setAttribute\(['\"]style|document\.(body|documentElement)\.style|styleSheet\.cssText|insertRule\(|eval\(|new Function\(" dist/
rg -n "style=|\.style\.|setAttribute\(['\"]style|createElement\(['\"]style|cssText|insertRule|eval\(|new Function\(" \
  src --glob '*.{ts,tsx,js,jsx}'
```

The bundle search must return no matches. The source search may find explanatory CSP comments but
must find no executable violation.

Confirm the semantic cleanup and durable documentation:

```bash
rg -n "toLocaleLowerCase|toLocaleUpperCase|normalizedDebitAmountUsdCents|normalizedCreditAmountUsdCents" \
  src/features/views
rg -n "same-currency|cross-currency|transaction-date|on-demand|review" \
  docs/api-integration.md docs/architecture.md
rg -n "docs/plans|fix-transfer-refund-review-findings|client-side-view-transfer-refund-review" \
  docs/api-integration.md docs/architecture.md README.md AGENTS.md
```

The first and third searches must return no matches. The documentation search must find the new
durable behavior.

### Completion criteria

- Durable docs accurately describe direct same-currency comparison, cross-currency FX conversion,
  and on-demand candidate derivation.
- The focused review workflow and the repository-wide coverage/build gate pass.
- Lint fixes and formatting complete without unrelated churn or disabled rules.
- The production smoke build and CSP scans remain clean.
- No locale-sensitive casing or falsely USD-labelled candidate fields remain in the views feature.
- No dependency, backend contract, or import behavior was changed, and no git write operation was
  performed by the remediation.
