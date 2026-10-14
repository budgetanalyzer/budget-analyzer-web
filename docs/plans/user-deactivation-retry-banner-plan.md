# User Deactivation Retry Banner Plan

Complete the already-started heartbeat `503` alignment and replace the fragile
page-local deactivation retry marker with a persistent, dismissible error banner
whose action safely repeats the idempotent deactivation request. This plan is the
executable replacement for `docs/plans/heartbeat-and-deactivation-implementation-plan.md`;
the earlier file is reference material only and must not be edited or treated as
the controlling design when it conflicts with this plan.

The target deactivation interaction is intentionally transient. A `503` observed
while deactivating a user produces a standard error banner with **Retry session
revocation** and **Dismiss message** controls. The banner does not auto-dismiss.
Retry calls the same endpoint for the user currently displayed; dismissal,
navigation, and reload remove the retry affordance. An initially deactivated user
does not receive a standalone revocation action because the API exposes no durable
`sessionRevocationPending` state. Do not add Redux, URL, storage, or TanStack Query
state to infer or persist one.

Preserve unrelated worktree changes and the generated API snapshots already
present at plan start. Do not perform git write operations, start Vite or Tilt,
add dependencies, or hand-edit generated API specifications. Use the repository's
documented validation commands and report any unavailable prerequisite or
user-managed browser environment honestly.

## Phase 1: Complete Heartbeat 503 Alignment

### Workspace

.

### Goal

Finish and verify the narrow in-progress frontend alignment with Session Gateway's
documented heartbeat `503` response without changing the heartbeat request,
cadence, payload, current-user query, or session model.

### Scope

- `src/hooks/useSessionHeartbeat.ts`
- `src/hooks/__tests__/useSessionHeartbeat.test.ts`
- Heartbeat comments in `src/api/auth.ts` and
  `src/features/auth/hooks/useAuth.ts`
- The heartbeat contract in `docs/authentication.md`
- Existing generated Session Gateway API snapshot changes, inspected as
  authoritative input but not hand-edited

### Non-goals

- Adding a new heartbeat request or changing activity tracking and timer cadence
- Refetching or rewriting `['auth', 'currentUser']` after a heartbeat
- Changing Session Gateway, permission-service, Redis, or orchestration
- Refactoring unrelated heartbeat control flow
- Changing deactivation UI behavior in this phase

### Required context

- `AGENTS.md`
- `docs/development.md#prerequisites`
- `docs/authentication.md#heartbeat-inactivity-and-expiry`
- `docs/react-hooks-lifecycle-mental-model.md`
- `docs/testing-guide.md#running-vitest`
- `docs/api/session-gateway-api.yaml`, especially `GET /auth/v1/session`
- `../orchestration/docs/architecture/session-edge-authorization-pattern.md`,
  especially the Session Gateway auth-layer heartbeat result table; read-only
  context only
- The current worktree status and diff, because heartbeat and generated API
  snapshot edits predate this plan and must not be discarded

### Execution steps

1. Confirm the documented prerequisites remain satisfied. Stop and report the
   missing prerequisite instead of introducing a workaround if they are not.
2. Inspect the existing heartbeat diff before editing. Preserve the in-progress
   behavior that classifies HTTP `503` with network errors and HTTP `502` for the
   existing single immediate retry.
3. Ensure only a successful heartbeat updates `expiresAt`, reschedules the local
   warning, clears the connectivity warning, or broadcasts a renewal. Repeated
   temporary failure must retain the last successful expiry/countdown and expose
   the existing persistent connectivity warning.
4. Preserve `401` as authoritative on either the initial attempt or the single
   retry, navigating to `/logout`. Do not add a current-user query invalidation:
   frontend permission affordances continue to update on the next normal
   `/auth/v1/user` fetch.
5. Finish stale heartbeat comments, including the authentication-flow comment in
   `useAuth.ts`, so they describe authorization refresh before TTL extension and
   do not imply that the browser or heartbeat contacts the identity provider.
6. Review the focused tests for initial `503`, successful retry, repeated `503`,
   retained expiry/no broadcast, and a retry returning `401`. Add or adjust only
   behavior-focused cases needed to prove the contract.
7. Format only source and test files touched by this phase with the repository's
   Prettier configuration, then run the focused heartbeat test file.

### Implementation notes

The endpoint request and successful response shape are unchanged. This is error
handling and user feedback, not a new web heartbeat implementation. A failed
refresh must never look like a renewal. The generated API snapshots are produced
by orchestration and may already be dirty; do not regenerate or manually rewrite
them in this repository.

### Validation

```bash
npx prettier --write src/hooks/useSessionHeartbeat.ts src/hooks/__tests__/useSessionHeartbeat.test.ts src/api/auth.ts src/features/auth/hooks/useAuth.ts
npx vitest run src/hooks/__tests__/useSessionHeartbeat.test.ts
git diff --check
```

### Completion criteria

- HTTP `503` follows the existing one-retry temporary-failure path.
- Failed attempts do not advance or broadcast session expiry.
- A `401` from either attempt logs out.
- No immediate current-user query refresh or heartbeat transport change exists.
- Heartbeat comments and durable authentication documentation match the backend
  contract.
- The focused heartbeat suite and `git diff --check` pass.

## Phase 2: Add an Optional Standard Banner Action

### Workspace

.

### Goal

Extend the shared `MessageBanner` with an optional accessible action so a
feature can place a deliberate retry beside a persistent message while all
existing banner callers retain their current behavior.

### Scope

- `src/components/MessageBanner.tsx`
- `src/components/__tests__/MessageBanner.test.tsx`

### Non-goals

- Introducing a toast, notification dependency, or auto-dismiss timer
- Redesigning existing banner colors, animation semantics, or message roles
- Changing existing `MessageBanner` call sites
- Implementing the user-deactivation workflow in this phase

### Required context

- `AGENTS.md`
- `docs/architecture.md#content-security-policy`
- `docs/api-integration.md#user-facing-error-messages`
- `docs/testing-guide.md#testing-policy`
- The current `MessageBanner` implementation and tests

### Execution steps

1. Add a small optional action contract to `MessageBanner` that provides a
   visible label and a caller-supplied named callback. Keep the existing close
   callback and accessible **Dismiss message** control.
2. Render the optional action as a standard `type="button"` control with a clear
   accessible name. Keep the complete message in its existing atomic `alert` or
   `status` region, and arrange the action and close controls so the banner
   remains usable at narrow widths without inline styles or runtime-generated
   CSS.
3. Preserve source compatibility and rendering behavior for callers that omit
   the action. Do not require an action and do not add timing behavior.
4. Expand the colocated component tests to prove that the optional action renders
   only when supplied, invokes its callback, remains independent from dismissal,
   and does not submit an owning form. Retain the existing role and atomic-message
   assertions.
5. Format the two changed files and run the focused `MessageBanner` test file.

### Implementation notes

Use an API that keeps event handlers named at the caller and avoids inline
function definitions in JSX. The action belongs outside the textual atomic
message while remaining visibly within the same standard banner. Reuse the
existing `Button`; do not add a dependency or custom runtime styling.

### Validation

```bash
npx prettier --write src/components/MessageBanner.tsx src/components/__tests__/MessageBanner.test.tsx
npx vitest run src/components/__tests__/MessageBanner.test.tsx
git diff --check
```

### Completion criteria

- Existing banners still render and dismiss exactly as before when no action is
  supplied.
- An optional banner action is keyboard-accessible, invokes only its own
  callback, and cannot submit an enclosing form.
- Error and non-error message roles remain atomic and unchanged.
- No auto-dismissal, dependency, inline style, or runtime stylesheet behavior is
  introduced.
- The focused component tests and `git diff --check` pass.

## Phase 3: Move Deactivation Retry into the Failure Banner

### Workspace

.

### Goal

Remove `deactivationRetryUserId` completely and make an observed deactivation
`503` recoverable only through a persistent standard error banner containing the
manual retry action.

### Scope

- `src/features/admin/users/pages/UserDetailPage.tsx`
- `src/features/admin/users/pages/__tests__/UserDetailPage.test.tsx`
- `src/hooks/useUsers.ts` only if a minimal adjustment is demonstrated necessary;
  preserve its existing success/`503` detail and search invalidation contract
- The generated unified API deactivation contract as read-only authoritative
  context

### Non-goals

- Persisting a revocation-pending flag anywhere
- Showing a standalone session-revocation action for every deactivated user
- Showing a retry action after cold mount, reload, navigation, or dismissal
- Automatically retrying the deactivation mutation
- Changing backend endpoint semantics, payloads, or generated API files
- Changing confirmation-dialog overlay, focus, dismissal, or scroll-lock
  behavior

### Required context

- `AGENTS.md`
- `docs/api-integration.md#user-facing-error-messages`
- `docs/authentication.md#roles-and-permissions`
- `docs/state-architecture.md#local-component-state`
- `docs/react-hooks-lifecycle-mental-model.md`, especially event-driven work and
  server state
- `docs/testing-guide.md#testing-policy`
- `docs/api/budget-analyzer-api.yaml`, especially
  `POST /v1/users/{id}/deactivate`
- `UserDetailPage.tsx`, `useUsers.ts`, the existing MSW-backed user-detail tests,
  and the optional banner action completed in Phase 2

### Execution steps

1. Inspect the current page, mutation hook, generated endpoint contract, and
   tests. Preserve permission gating through `users:write`, the active-user
   confirmation flow, and query invalidation of the affected detail plus all
   user-search queries after either success or `503`.
2. Delete the `deactivationRetryUserId` state, every setter, and every condition
   based on it. Do not replace it with another user ID, a pending-revocation
   boolean, Redux, URL state, browser storage, or query data.
3. Keep **Deactivate user** available only for an active user with
   `users:write`. Do not render a page-level retry/revocation button merely
   because the authoritative user record is `DEACTIVATED`.
4. When deactivation yields a normalized `ApiError` with status `503`, close the
   confirmation dialog, retain the existing server-state reconciliation, and
   render a persistent standard error `MessageBanner`. Use wording such as
   “Session revocation could not be confirmed. It is safe to retry.” so both a
   backend `503` and a client-normalized lost response are described without
   claiming durable pending state.
5. Put a sentence-case **Retry session revocation** action inside that banner.
   Its named handler must invoke the same idempotent mutation with the currently
   displayed authoritative `user.id`. Clicking it is the user's deliberate retry;
   prevent duplicate submissions while the request is pending and never schedule
   an automatic retry.
6. Keep **Dismiss message** available. Dismissal intentionally clears both the
   error and its retry affordance. Navigation, unmount, and reload likewise do
   not recreate it from `DEACTIVATED` status.
7. If the manual retry succeeds, clear the failure and show persistent contextual
   success feedback such as “Session revocation completed.” because the visible
   account status does not change. If it returns `503` again, keep or restore the
   same actionable banner. Other failures continue to use normalized contextual
   error copy and must not gain the session-revocation retry action.
8. Revise the MSW-backed user-detail coverage to prove the complete product
   behavior:
   - ordinary active-user success still refreshes to `DEACTIVATED` and closes the
     dialog without a redundant success banner;
   - an ordinary non-`503` failure remains dismissible and offers no revocation
     retry;
   - the initial `503` closes the dialog, reconciles the deactivated user, and
     exposes retry only inside the persistent error banner;
   - dismissing the banner removes the retry action;
   - retry calls the same endpoint, repeated `503` remains actionable, and a
     later success produces contextual completion feedback;
   - a cold-mounted deactivated user has neither **Deactivate user** nor a
     session-revocation action;
   - users without `users:write` receive no mutation affordance.
9. Use `user-event` and MSW for these workflows, assert visible behavior rather
   than internal state, format the changed files, and run the focused user-detail
   suite.

### Implementation notes

The banner records only an error observed during the current mounted workflow;
it is not evidence that revocation remains pending. Keeping transient banner
feedback in component state or using the mutation's actual error/reset state is
acceptable. Storing a user identifier or synthesizing server state is not.

The shared Axios normalization can represent a no-response transport failure as
HTTP `503`, so do not state categorically that sessions remain or that account
deactivation definitely failed. The repeat request is safe because the backend
contract preserves original audit fields and role state while attempting session
revocation again for an already-deactivated user.

### Validation

```bash
npx prettier --write src/features/admin/users/pages/UserDetailPage.tsx src/features/admin/users/pages/__tests__/UserDetailPage.test.tsx src/hooks/useUsers.ts
npx vitest run src/features/admin/users/pages/__tests__/UserDetailPage.test.tsx
git diff --check
```

If `src/hooks/useUsers.ts` is unchanged, omit it from the Prettier command.

### Completion criteria

- `deactivationRetryUserId` and all equivalent inferred pending-state markers are
  absent.
- Retry is displayed only inside a persistent banner resulting from an observed
  `503` in the current mounted workflow.
- Dismissal removes the banner and retry, and cold-mounted deactivated users have
  no mutation action.
- Retry is manual, uses the same endpoint/current user ID, handles repeated
  failure, and gives clear feedback on eventual success.
- Existing permission gating, confirmation behavior, and success/`503` cache
  reconciliation remain correct.
- The focused user-detail suite and `git diff --check` pass.

## Phase 4: Document the Contract and Run Full Validation

### Workspace

.

### Goal

Make the durable frontend documentation match the final heartbeat and
deactivation behavior, then run the repository's production validation gates and
review the complete diff for scope and generated-file integrity.

### Scope

- `docs/api-integration.md`
- `docs/authentication.md` if Phase 1 left any heartbeat wording to reconcile
- All implementation and test files changed by Phases 1–3
- Final worktree validation and diff review

### Non-goals

- Editing the reference plan or this executable plan during its run
- Regenerating API specifications or changing dependencies
- Adding Playwright coverage for a workflow not currently represented in the
  external harness
- Broad documentation cleanup unrelated to these contracts

### Required context

- `AGENTS.md`
- `docs/README.md` for documentation ownership
- `docs/api-integration.md#user-facing-error-messages`
- `docs/authentication.md#heartbeat-inactivity-and-expiry`
- `docs/development.md#repository-commands`
- `docs/development.md#standard-build`
- `docs/testing-guide.md#running-vitest`
- `docs/testing-guide.md#coverage`
- The full current diff and the generated API snapshots

### Execution steps

1. Update `docs/api-integration.md` to record that a deactivation `503` remains a
   persistent contextual banner with explicit retry and dismissal. State that the
   retry is tied to the observed failure, is never automatic, and is not exposed
   solely from `DEACTIVATED` status after dismissal, navigation, or reload because
   the API has no durable pending-revocation field.
2. Ensure `docs/authentication.md` and source comments accurately describe the
   narrow heartbeat `503` behavior completed in Phase 1. Avoid duplicating
   generated endpoint schemas in prose.
3. Verify changed documentation links and referenced paths. Do not link to either
   plan from durable non-plan documentation.
4. Review the complete diff for unrelated churn, accidental generated-spec edits,
   prohibited inline styling, dependency changes, or a hidden replacement for
   `deactivationRetryUserId`. Preserve pre-existing generated snapshots and other
   user work.
5. Format only the changed application/test files with the repository's Prettier
   configuration. Do not run the broad formatter if its scope includes unrelated
   user work.
6. Run the focused banner, user-detail, and heartbeat tests together, then run
   `npm run lint:fix` and `npm run build`. The build supplies the full coverage,
   TypeScript, and bundle gates.
7. Confirm `package.json` and `package-lock.json` did not change, then finish with
   `git diff --check` and report any verifier that could not run.

### Implementation notes

This work does not add a UI dependency, change Motion APIs, or alter overlay
behavior, so no extra CSP browser audit is required beyond the normal production
build. If implementation expands into any of those areas, follow the additional
static-scan and user-managed browser-audit requirements in `AGENTS.md` instead of
silently skipping them. Never start the development server, Vite, or Tilt.

`npm run lint:fix` may modify files. Inspect its resulting diff and retain only
in-scope fixes without overwriting unrelated user changes. The pre-existing API
snapshot changes are inputs to this frontend work; package manifests must remain
unchanged.

### Validation

```bash
npx vitest run src/components/__tests__/MessageBanner.test.tsx src/features/admin/users/pages/__tests__/UserDetailPage.test.tsx src/hooks/__tests__/useSessionHeartbeat.test.ts
npm run lint:fix
npm run build
git diff --check
git status --short
```

### Completion criteria

- Durable documentation describes the implemented heartbeat and banner-bound
  deactivation recovery contracts without linking to ephemeral plans.
- Focused tests, lint-fix validation, the full coverage-gated production build,
  and `git diff --check` pass.
- No dependency, generated-spec, Playwright, E2E, or unrelated source changes
  were introduced by the plan execution.
- The final diff contains no inferred durable session-revocation state and no
  standalone action for cold-mounted deactivated users.
- Any unavailable validation is reported explicitly; otherwise the work is ready
  for user-controlled git operations.
