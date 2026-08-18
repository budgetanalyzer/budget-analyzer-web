# Documentation, Scripts, Tests, and Comments Cleanup

## Status and Goal

Open audit issue. Implementation should use the separate plans below.

Make repository guidance shorter and easier to maintain without losing durable
contracts, rationale, operating instructions, or meaningful test coverage. Each
concern should have one source of truth; summaries and agent instructions should
link to it.

## Audit Summary

- The repository has roughly 4,170 lines of handwritten Markdown outside
  generated OpenAPI files. Authentication, permissions, CSP, state, builds, and
  browser testing are repeated across documents and some copies have drifted.
- The unit suite is healthy: 87 files and 585 tests pass, with no skipped or
  focused tests and no snapshots.
- Code comments are not broadly oversized; the longest scanned block is 22
  lines. A few tutorial-like or stale comments should be curated.
- Playwright was not run because it requires the user-managed Tilt
  production-smoke environment.

## Sources of Truth

| Concern | Owner |
|---|---|
| Landing page and documentation links | [`README.md`](../../README.md) |
| Setup, commands, environment, builds | [`development.md`](../development.md) |
| Structure, browser support, CSP | [`architecture.md`](../architecture.md) |
| Authentication, sessions, permissions | [`authentication.md`](../authentication.md) |
| Frontend-specific API behavior | [`api-integration.md`](../api-integration.md) |
| Endpoint schemas and payloads | Generated specifications under [`docs/api/`](../api/) |
| State ownership | [`state-architecture.md`](../state-architecture.md) |
| Test policy, utilities, coverage, Playwright | [`testing-guide.md`](../testing-guide.md) |
| Agent-only rules and discovery commands | [`AGENTS.md`](../../AGENTS.md), linking to the owners above |

Keep `docs/README.md` only as a compact index if it remains. Do not copy
examples, status dates, onboarding sequences, or project rules into it.

## Documentation Findings

Repeated concerns:

- Permissions: `AGENTS.md`, `architecture.md`, and `authentication.md`.
- CSP: `AGENTS.md`, root `README.md`, architecture, development, and testing.
- Playwright setup: root README, development, and testing.
- State ownership: `AGENTS.md`, architecture, state architecture, and the docs
  index.
- Builds and API client behavior appear outside their intended owners.

Known drift:

- `development.md` incorrectly says the CSP audit rejects every DOM `style`
  attribute. Trusted property writes may serialize to that attribute without a
  policy violation.
- `docs/README.md` has three broken state-architecture anchors, an obsolete
  `onFilteredRowsChange` example, and an outdated Redux description.
- `AGENTS.md` references nonexistent
  `src/features/transactions/hooks/useTransactions.ts` and
  `src/api/endpoints.ts` paths.
- `development.md` documents a nonexistent top-level `src/pages/` directory.
- `api-integration.md` calls a short, incomplete list “all endpoints.” Generated
  OpenAPI should own the endpoint inventory.
- Exact emitted Motion chunk sizes in `architecture.md` are transient evidence,
  not architecture.
- The request-flow comment in `vite.config.ts` does not match the current
  Istio-to-NGINX topology.

The 956 combined lines in `useEffect-guide.md` and
`react-hooks-lifecycle-mental-model.md` largely duplicate upstream React
documentation. Some examples conflict with current project rules by teaching
manual API fetching or effect-based state synchronization. Before replacing
them, retain these repository rules:

- Effects synchronize external systems and clean up installed resources.
- Server state belongs in TanStack Query.
- Derived values and event handling do not require effects.
- Link to current local examples and official React guidance.

## Dropdown CSP Gate

[`check-dropdown-csp.mjs`](../../scripts/check-dropdown-csp.mjs) is not orphaned
plan residue: `build:prod-smoke` and GitHub Actions run it, and it blocks known
Radix menu and `react-remove-scroll` signatures.

It is still a temporary, implementation-specific gate. Do not delete it until
Playwright covers desktop and mobile dropdown interaction, real placement and
viewport fallback, top-layer clipping escape, CSP violations, and prohibited
runtime/final stylesheets. Current product coverage is one desktop transaction
selection workflow.

After equivalent browser coverage passes, remove together:

- The script and `scripts/__tests__/check-dropdown-csp.test.mjs`.
- The `check:csp:dropdown` package command and `build:prod-smoke` chaining.
- Documentation describing the temporary gate.

If the former Radix dependency must remain permanently prohibited, replace only
that durable rule with a smaller dependency/import restriction.

## Tests and Comments

Do not delete test coverage based on this audit. Consider behavior-based splits
for the largest files: `TransactionPreviewModal.test.tsx` (852 lines),
`PdfStatementFormatWizardDialog.test.tsx` (809),
`findTransferRefundCandidates.test.ts` (637), and `ViewPage.test.tsx` (591).
Extract shared builders only where they remove substantial repetition without
hiding intent.

Targeted comment cleanup:

- Shorten URL-builder examples and the generic `useDebounce` tutorial.
- Correct the stale `vite.config.ts` topology comment.
- Reduce authentication and CSP script headers that repeat durable docs, while
  preserving the CSP gate's removal condition.
- Retain non-obvious business rules such as currency triangulation, search
  parsing edge cases, membership reconciliation, and similar invariants.

## Separate Plan Boundaries

### Plan 1: Documentation Correctness and Ownership

Fix drift and broken references, establish the owners above, consolidate copied
material, reduce README/AGENTS/index content to scoped summaries and links, and
replace generic React tutorials after preserving repository-specific guidance.
Verify all local Markdown links and referenced paths.

### Plan 2: Dropdown Coverage and Gate Retirement

Add desktop and mobile browser scenarios, run the E2E type-check and browser
audit, decide whether the old dependency ban is durable, then remove or reduce
the static gate and update package, CI, CSP, development, and testing docs in the
same change.

### Plan 3: Test Organization

Review the largest test files for coherent splits and genuinely reusable fixture
builders. Preserve meaningful scenarios and coverage thresholds.

### Plan 4: Comment Curation

Correct stale comments, remove narration that restates signatures or tests, and
preserve rationale, external constraints, algorithms, and business invariants.

## Completion Criteria

- Each durable concern has one owner and other documents link to it.
- No known broken local links or nonexistent source references remain.
- Repository guidance is preserved before generic tutorials are reduced.
- The CSP gate remains until equivalent browser coverage exists.
- Test cleanup preserves meaningful behavior coverage.
- Comments explain rationale or non-obvious constraints instead of duplicating
  code, tests, or long-form documentation.
