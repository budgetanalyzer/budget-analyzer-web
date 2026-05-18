# Testing Coverage Consistency Plan

## Context

Phase 1 and Phase 2 are complete. Shared test infrastructure now lives under
`src/testing/`, production-code tests are colocated under `__tests__`
directories, and the old `src/test/` directory has been removed.

At plan creation, this repo had two test placement styles:

- `src/test/` contained global setup plus three production-code tests:
  - `setup.ts`
  - `Button.test.tsx`
  - `parseSearchTerms.test.ts`
  - `useTransactions.test.tsx`
- Most of the suite uses colocated `__tests__` directories next to the code under test.

That split looked historical rather than intentional. `src/test/setup.ts` was legitimate shared test infrastructure because `vitest.config.ts` pointed to it. The other files in `src/test` looked like early examples that predated the current feature-colocated convention. The old `docs/testing-guide.md` reinforced that older structure and used `Button.test.tsx` as a primary example, which was misleading.

Current suite snapshot after Phase 2:

- 38 test files.
- 182 tests.
- `npm test -- --run` passes.
- No skipped or focused tests were found.
- `npm test -- --run --coverage` fails because `@vitest/coverage-v8` is not installed.
- 16 test files mock modules with `vi.mock`.
- 3 test files use MSW directly.
- 14 test files use `fireEvent`.
- 0 test files use `userEvent`; `@testing-library/user-event` is not installed.

## Bulletproof React Guidance Checked

Checked the Bulletproof React testing and project-structure guidance:

- Testing should lean on integration tests for confidence, with unit tests reserved for shared functions/components and complex isolated logic.
- Testing Library should test behavior as a user experiences it, not implementation details.
- MSW is recommended for HTTP-facing tests so app code still makes real HTTP calls against a mocked server.
- Shared test utilities and mocks belong in a dedicated `src/testing` area.
- Feature code should stay feature-oriented and isolated.

This maps well to a hybrid convention for this repo: colocate tests for production behavior near the owning feature/module, and reserve `src/testing` for setup, render helpers, factories, and MSW fixtures.

## Target Convention

Adopt one placement rule:

- Production-code tests live beside their owning code in `__tests__` directories.
- Shared test infrastructure lives in `src/testing/`.
- MSW handlers, test data builders, provider wrappers, and setup files live under `src/testing`.
- No production-code tests live directly in `src/testing`.

Examples:

- `src/utils/parseSearchTerms.ts` -> `src/utils/__tests__/parseSearchTerms.test.ts`
- `src/hooks/useTransactions.ts` -> `src/hooks/__tests__/useTransactions.test.tsx`
- `src/test/setup.ts` -> `src/testing/setup.ts`
- `src/mocks/handlers.ts` -> `src/testing/mocks/handlers.ts`

## What We Should Test

Prioritize tests that would fail for a real product regression:

- Permission gates and denied states that prevent actions or data hooks from mounting.
- URL state parsing/serialization for analytics, admin search, saved views, and drilldowns.
- API request shaping where the frontend transforms user-visible state into backend payloads.
- Error, loading, empty, and forbidden states for important pages.
- Transaction import preview/review flows, duplicate handling, edit/delete gating, bulk actions, and saved-view behavior.
- Date, currency, search, analytics, and filtering logic where edge cases are easy to regress.
- Session lifecycle behavior, timers, heartbeat, inactivity warning, and redirect behavior.

Keep unit tests for pure logic and complex hooks. Use integration-style component/page tests when the confidence comes from several pieces working together.

## What We Should Avoid

Do not chase coverage by testing facts already guaranteed by React, the browser, TypeScript, or a library:

- "Button renders a button."
- "Clicking a native button calls `onClick`."
- "A disabled native button does not click."
- Tailwind class snapshots for visual variants unless a class is part of a real behavioral contract.
- Page tests that only assert a heading renders, unless they are explicit route smoke tests and there is no better workflow assertion nearby.
- Tests that mirror implementation details such as hook internals, private state, or exact component decomposition.

The `src/test/Button.test.tsx` file is the clearest example of low-signal coverage. The useful contract of this `Button` primitive is mostly TypeScript props plus composition; asserting native button behavior and exact Tailwind classes creates churn without much regression protection. If a future UI primitive contains custom accessibility behavior, keyboard handling, or nontrivial composition, test that behavior instead.

## Implementation Plan

### Phase 1: Normalize Test Infrastructure

1. Create `src/testing/`.
2. Move `src/test/setup.ts` to `src/testing/setup.ts`.
3. Move `src/mocks/server.ts` and `src/mocks/handlers.ts` to `src/testing/mocks/`.
4. Update `vitest.config.ts` to use `./src/testing/setup.ts`.
5. Update imports from `@/mocks/server` and `@/mocks/handlers` to `@/testing/mocks/server` and `@/testing/mocks/handlers`.
6. Add `src/testing/test-utils.tsx` with:
   - `createTestQueryClient()`
   - `renderWithProviders()`
   - optional router initial entries
   - optional Redux preloaded state or a test-store factory
7. Update docs and agent guidance references from `src/test` to `src/testing`.

### Phase 2: Move or Remove Stray Tests (Complete)

1. Move `src/test/parseSearchTerms.test.ts` to `src/utils/__tests__/parseSearchTerms.test.ts`.
2. Move `src/test/useTransactions.test.tsx` to `src/hooks/__tests__/useTransactions.test.tsx`.
3. Delete `src/test/Button.test.tsx` unless a concrete, non-obvious Button contract is identified.
4. Remove the empty `src/test/` directory.
5. Update `docs/testing-guide.md` examples so they show colocated tests and shared infrastructure separately.

### Phase 3: Improve Test Ergonomics (Complete)

1. Add `@testing-library/user-event` as a dev dependency.
2. Prefer `userEvent` for user workflows such as clicking, typing, selecting, and clearing fields.
3. Keep `fireEvent` for lower-level events where `userEvent` is not a good fit, such as synthetic window activity, timer-adjacent hooks, and rare DOM events.
4. Replace repeated local `QueryClientProvider`, `Provider`, and `MemoryRouter` setup with `renderWithProviders()` where it reduces noise.
5. Keep local render helpers only when a test needs route-specific or page-specific wiring that would make the shared helper too clever.

Completion notes:
- `@testing-library/user-event` is installed.
- User workflow tests now use `userEvent` across navigation, form, modal, bulk action, and admin page interactions.
- Remaining `fireEvent` usage is limited to synthetic window activity, timer-adjacent modal behavior, and a Radix keyboard-event workaround.
- `renderWithProviders()` now supports the repo's mixed router imports with a default `react-router` memory router and an explicit `router: 'dom'` option for components that still import hooks from `react-router-dom`.

### Phase 4: Add Coverage Reporting Without Gaming It

1. Add `@vitest/coverage-v8`.
2. Add a `test:coverage` script rather than relying on a remembered CLI flag.
3. Configure coverage excludes for:
   - `src/testing/**`
   - generated types and declaration files
   - config files
   - entrypoint glue such as `src/main.tsx` unless the app starts testing bootstrap behavior
4. Generate an initial report with no hard threshold.
5. Use the report to find meaningful blind spots, not to force tests around trivial UI primitives.
6. Add thresholds only after the suite shape is consistent. Start with modest global thresholds or targeted thresholds around high-value modules, then ratchet upward deliberately.

### Phase 5: Coverage Audit And Gap Fill

Audit by product risk, not by file count.

High-value areas to verify first:

- Authentication and authorization:
  - route guards
  - permission-gated buttons and nav items
  - 401/403 behavior
- Transactions:
  - list loading/error/empty states
  - self-scope write/delete gates
  - import preview, duplicate review, and batch payload shaping
  - edit/delete mutations and cache updates
- Admin:
  - users search/detail/deactivation
  - cross-user transactions search
  - currencies and statement formats action gates and error states
- Analytics:
  - source selection
  - URL defaults and drilldowns
  - all transactions vs saved-view scope
- Views:
  - criteria display
  - pin/exclude/restore flows
  - filter URL synchronization
- Shared utilities:
  - dates
  - currency conversion/rate lookup
  - error-message mapping
  - search query parsing/serialization

Likely gaps to inspect during implementation:

- API modules beyond `transactionApi.batchImportTransactions`.
- Shared hooks such as `useCurrencies`, `useStatementFormats`, `useUsers`, `useViews`, `useMissingCurrencies`, `useTransactionCount`, and import/preview hooks.
- Route/page tests that only assert a heading and should either become workflow tests or be deleted.
- Console noise from stats calculation during tests; decide whether it is useful signal or should be suppressed at the source/test helper level.

### Phase 6: Documentation And Guardrails

Update `docs/testing-guide.md` so it becomes the source of truth for:

- Test placement.
- Shared `src/testing` utilities.
- MSW usage.
- When to unit test versus integration test.
- What not to test.
- `userEvent` versus `fireEvent`.
- Coverage report usage and threshold policy.

Update `AGENTS.md` references after the structure changes:

- Vitest setup path.
- Single-test examples.
- Any discovery commands that mention `src/test`.

Add a short PR checklist item:

- New behavior has either a meaningful test or an explicit reason it does not need one.
- No tests were added just to assert native/browser/library behavior.
- New API-facing behavior uses MSW unless a direct module mock is intentionally narrower.

## Acceptance Criteria

- `src/test/` no longer exists.
- Shared test infrastructure lives in `src/testing/`.
- Production-code tests are colocated in `__tests__`.
- `npm test -- --run` passes.
- `npm run lint:fix` passes.
- `npm run test:coverage` runs and prints a report.
- `docs/testing-guide.md` and `AGENTS.md` match the new convention.
- Low-signal tests are removed or rewritten into behavior-focused tests.
- The plan does not introduce broad coverage thresholds until the first report has been reviewed.
