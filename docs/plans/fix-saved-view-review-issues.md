# Fix Saved-View Review Issues

Resolve the three functional review findings around stale add-to-view recovery, analytics saved-view authorization, and creation of static views from unfiltered or empty transaction snapshots. Preserve the documented permission, state-ownership, and static-membership contracts while adding regression coverage for each behavior.

## Phase 1: Make stale add-to-view recovery refresh-safe

### Workspace

.

### Goal

Prevent a stale add-to-view request from being submitted again until the required transaction and membership refreshes have settled and the user has subsequently reviewed the selection by changing it.

### Scope

Update the saved-view mutation invalidation flow and TransactionTable selection/reset behavior. Add focused hook and component coverage for deliberately delayed refreshes.

### Non-goals

Do not change the backend error contract, retry a stale mutation automatically, discard the user's selection, move selection into Redux or TanStack Query, or alter remove-from-view behavior.

### Required context

Read `docs/state-architecture.md`, especially the TanStack Query and local component state sections; `docs/api-integration.md`, especially the saved-view integration contracts; `docs/react-hooks-lifecycle-mental-model.md`; and the relevant implementations and tests in `src/hooks/useViews.ts`, `src/hooks/__tests__/useViews.test.tsx`, `src/features/transactions/components/TransactionTable.tsx`, and `src/features/transactions/components/__tests__/TransactionTable.test.tsx`.

### Execution steps

1. Change the stale-addition invalidation path in `src/hooks/useViews.ts` so it exposes and awaits the promises returned by the required TanStack Query invalidations instead of only starting them. Ensure the mutation does not settle into its stale error state until the active transaction and saved-view membership refetches have settled.
2. Audit every TransactionTable selection-change path that calls the mutation's `reset`, including individual/page selection, select-all-matching, and clear-selection. Keep an in-flight mutation attached and submission blocked when the user changes selection before stale recovery has finished; do not let `reset` erase the pending mutation observer.
3. Preserve the existing selection after `SAVED_VIEW_MEMBERSHIP_STALE`. Once refresh has settled and the stale review message is visible, keep the Add transactions action disabled until a new selection change clears the stale review requirement.
4. Extend `src/hooks/__tests__/useViews.test.tsx` to prove the stale-addition mutation awaits the relevant invalidation/refetch promises, still invalidates every documented key, and does not retry or rewrite the submitted IDs.
5. Extend `src/features/transactions/components/__tests__/TransactionTable.test.tsx` with deferred refresh coverage: change selection while refresh is unresolved and prove submission stays blocked; settle both required refreshes and prove it remains blocked; then change selection again and prove submission becomes eligible.

### Implementation notes

Use mutation callbacks and TanStack Query promises rather than effects or copied server state. A local stale-review lock is acceptable if needed, but it must represent transient table workflow state and must not duplicate membership or transaction data. Be careful that TanStack Mutation `reset` can detach the observer from an in-flight mutation; the test must cover that race rather than only an immediate refetch.

### Validation

Format the changed files with the repository's Prettier configuration, then run:

```bash
npx vitest run src/hooks/__tests__/useViews.test.tsx src/features/transactions/components/__tests__/TransactionTable.test.tsx
npm run lint:fix
```

### Completion criteria

The focused tests pass and demonstrate that no stale add-to-view resubmission is possible before both refresh settlement and a later selection change. Existing non-stale error recovery, successful additions, removals, and invalidation-key assertions continue to pass.

## Phase 2: Gate analytics saved-view query ownership

### Workspace

.

### Goal

Keep all-transaction analytics usable for a user without `views:read` while ensuring that no saved-view selector or saved-view API query mounts for that user.

### Scope

Refactor the analytics source ownership boundary under `PermissionGuard`, handle denied view-scoped URLs safely, and add analytics authorization tests.

### Non-goals

Do not gate the entire Analytics route on `views:read`, infer read permission from `views:write`, change backend grants, change the saved-view routes, or redesign unrelated analytics controls and calculations.

### Required context

Read `docs/authentication.md`, especially permission guards and the `views:read` contract; `docs/state-architecture.md`, especially analytics URL state; `docs/react-hooks-lifecycle-mental-model.md`; `src/components/Layout.tsx`; `src/features/auth/components/PermissionGuard.tsx`; `src/features/analytics/pages/AnalyticsPage.tsx`; and `src/features/analytics/pages/__tests__/AnalyticsPage.test.tsx`.

### Execution steps

1. Separate the saved-view-capable analytics source branch from the always-available all-transactions analytics branch so a `PermissionGuard permission="views:read"` can prevent the complete query-owning saved-view subtree from mounting.
2. Place the saved-view source selector and every saved-view query it requires, including list, active metadata, membership, and view transaction resolution, inside the permitted subtree. Keep ordinary transaction analytics and the remaining controls available in the denied fallback without issuing `/v1/views` requests.
3. Define denied handling for a direct `scope=view` analytics URL: ignore or canonicalize the unauthorized saved-view source to `scope=all` without briefly mounting saved-view hooks, and keep the resulting URL/render behavior deterministic.
4. Keep the analytics controls layout coherent when the saved-view source selector is absent, using existing Tailwind/CSP-safe conventions.
5. Update `src/features/analytics/pages/__tests__/AnalyticsPage.test.tsx` so existing saved-view source and drilldown cases explicitly run with `views:read`, while a denied case proves all-transaction analytics still renders and `useViews`, `useView`, and `useViewTransactions` do not run, including from a view-scoped deep link.
6. Retain and run the header selector coverage in `src/components/__tests__/Layout.test.tsx` to verify the existing Layout guard remains intact.

### Implementation notes

Prefer `PermissionGuard` around the complete query owner rather than adding permission inference or relying solely on React Query `enabled`. Follow the rules of hooks by moving query ownership into components instead of conditionally calling hooks. Do not duplicate analytics data processing; factor shared presentation/calculation inputs where necessary.

### Validation

Format the changed files with the repository's Prettier configuration, then run:

```bash
npx vitest run src/features/analytics/pages/__tests__/AnalyticsPage.test.tsx src/components/__tests__/Layout.test.tsx
npm run lint:fix
```

### Completion criteria

The focused tests pass. A user with `views:read` retains saved-view analytics, while a user without it can use all-transaction analytics and cannot mount any saved-view selector or saved-view request, even from a crafted view-scoped URL.

## Phase 3: Keep static-view creation available for every settled snapshot

### Workspace

.

### Goal

Render Save as View whenever the authorized transaction snapshot is settled, regardless of whether filters are active and including when the visible ID array is empty.

### Scope

Decouple TransactionFilterBar's contextual action from its Clear-filter controls and add filter-bar and TransactionTable regression tests.

### Non-goals

Do not change static-view request schemas, disable empty view creation, change filter semantics, move the save action to unrelated page chrome, or weaken the existing `views:write` and snapshot-readiness gates.

### Required context

Read `docs/api-integration.md`, especially static membership and local filters; `docs/authentication.md`, especially `views:write`; `src/components/TransactionFilterBar.tsx`; `src/components/__tests__/TransactionFilterBar.test.tsx`; `src/components/SaveAsViewButton.tsx`; `src/features/transactions/components/TransactionTable.tsx`; and `src/features/transactions/components/__tests__/TransactionTable.test.tsx`.

### Execution steps

1. Refactor `src/components/TransactionFilterBar.tsx` so only the separator and Clear button depend on active filters; render `contextualAction` independently whenever the caller supplies it.
2. Preserve the current responsive layout, callback memoization, Tailwind-only styling, and behavior of every filter control.
3. Update `src/components/__tests__/TransactionFilterBar.test.tsx` to assert that the contextual action is visible with no active filters and remains visible when filters become active, while Clear remains conditional.
4. Extend `src/features/transactions/components/__tests__/TransactionTable.test.tsx` to prove an authorized user sees Save as View for an unfiltered complete snapshot and for an initially empty snapshot, with the exact empty ID array passed through to creation.
5. Preserve tests showing the action is hidden without `views:write` and disabled while the visible transaction ID set is unresolved.

### Implementation notes

An empty array is a valid, settled static snapshot and must not be treated as missing data. Continue distinguishing readiness through `isViewTransactionIdsReady`; do not infer readiness from array length.

### Validation

Format the changed files with the repository's Prettier configuration, then run:

```bash
npx vitest run src/components/__tests__/TransactionFilterBar.test.tsx src/components/__tests__/SaveAsViewButton.test.tsx src/features/transactions/components/__tests__/TransactionTable.test.tsx
npm run lint:fix
```

### Completion criteria

The focused tests pass. Save as View is available for permitted, settled filtered, unfiltered, and empty snapshots; Clear remains visible only for active filters; permission and readiness behavior is unchanged.

## Phase 4: Integrate and run production gates

### Workspace

.

### Goal

Verify that all three fixes work together, conform to repository contracts, and pass the production application gates.

### Scope

Review the combined diff, run the relevant focused suite and full build, and make only integration fixes required by those results.

### Non-goals

Do not start Vite, Tilt, or a browser environment; perform unrelated refactors; change E2E configuration; or expand the documented contracts beyond what the three fixes require.

### Required context

Read the completed changes and tests from Phases 1 through 3, `docs/development.md`, `docs/testing-guide.md`, and the cited contracts in `docs/authentication.md`, `docs/api-integration.md`, and `docs/state-architecture.md`. Inspect the worktree before formatting so unrelated user changes are not swept into broad formatting churn.

### Execution steps

1. Review the combined diff for hook-safety, permission boundaries, mutation race handling, static empty-snapshot support, CSP-safe markup, and accidental unrelated changes.
2. Format only the changed application and test files with the repository's Prettier configuration.
3. Run the complete focused regression set for views hooks, TransactionTable, TransactionFilterBar, SaveAsViewButton, AnalyticsPage, and Layout; fix any integration regressions without weakening assertions.
4. Run `npm run lint:fix`, then inspect any automatic edits and resolve remaining warnings or errors without disabling ESLint rules.
5. Run `npm run build` to execute coverage, TypeScript, and bundle gates.
6. Run `git diff --check` and verify that the existing durable documentation already states the implemented contracts. Update the appropriate owner document only if implementation exposed a genuinely missing durable rule; do not document component walkthroughs or link this plan from non-plan documentation.

### Implementation notes

The plan itself is ephemeral. The current authentication, API integration, and state architecture documents already describe the intended behavior, so no durable documentation edit is expected unless the final implementation introduces a new contract. If a required verifier cannot run because a prerequisite is unavailable, report that limitation explicitly rather than claiming full verification.

### Validation

Run:

```bash
npx vitest run src/hooks/__tests__/useViews.test.tsx src/features/transactions/components/__tests__/TransactionTable.test.tsx src/components/__tests__/TransactionFilterBar.test.tsx src/components/__tests__/SaveAsViewButton.test.tsx src/features/analytics/pages/__tests__/AnalyticsPage.test.tsx src/components/__tests__/Layout.test.tsx
npm run lint:fix
npm run build
git diff --check
```

### Completion criteria

All focused tests, lint, the production build, and whitespace checks pass. The final diff resolves all three review findings without unauthorized saved-view requests, stale pre-refresh resubmission, or suppression of unfiltered and empty static-view creation, and any unavailable verifier is clearly documented in the handoff.
