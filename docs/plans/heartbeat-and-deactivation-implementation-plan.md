The correct frontend rule is: do not try to infer whether session revocation is pending. The API does not expose that as durable state, so the current page-local marker in [UserDetailPage.tsx](/srv/budget-analyzer/worktrees/budget-analyzer-web/src/features/admin/users/pages/UserDetailPage.tsx:40) is lost on refresh, navigation, another tab, or another administrator’s browser.

Instead, derive the available action entirely from the user record:

| User state | `users:write` | Action |
| --- | --- | --- |
| `ACTIVE` | Yes | **Deactivate User** |
| `DEACTIVATED` | Yes | **Revoke Any Remaining Sessions** |
| Either | No | No mutation action |

The deactivated-user action would call the same idempotent deactivation endpoint. Its wording should not imply that the frontend knows revocation previously failed.

A selective “retry only when needed” button would require the backend to expose durable state such as `sessionRevocationPending`. Neither the user detail response nor search response currently contains that information.

### Current state

- The interrupted heartbeat changes are nearly complete:
  - 503 participates in the existing one-retry flow.
  - Failed refreshes do not advance expiry or broadcast renewal.
  - A retry returning 401 logs out.
  - Documentation and focused tests were added.
- The existing deactivation implementation already refreshes user detail and search caches after a 503, which is correct.
- Its `deactivationRetryUserId` local state is the fragile part.
- [useAuth.ts](/srv/budget-analyzer/worktrees/budget-analyzer-web/src/features/auth/hooks/useAuth.ts:17) still has one stale heartbeat comment.
- The two focused suites pass: 31 tests.
- `git diff --check` passes.

### Implementation plan

1. Finish the heartbeat update

   - Keep HTTP 503 classified with network errors and 502 as temporarily retryable.
   - Preserve the last successful expiration and countdown after repeated failure.
   - Keep 401 authoritative on either attempt.
   - Do not immediately refresh the current-user permission query; the orchestration contract explicitly leaves that outside this change.
   - Update the remaining stale `useAuth.ts` comment.

2. Make deactivation recovery stateless

   - Remove `deactivationRetryUserId`.
   - Continue invalidating the affected detail query and all user-search queries after either 200 or 503 in [useUsers.ts](/srv/budget-analyzer/worktrees/budget-analyzer-web/src/hooks/useUsers.ts:23).
   - For an active user, retain the existing confirmation flow.
   - For every deactivated user with `users:write`, expose **Revoke Any Remaining Sessions**.
   - Have that action call the same endpoint. I recommend a status-specific confirmation explaining that the operation preserves the original deactivation audit fields and role state.
   - Do not automatically retry this mutation; retries remain administrator-driven.

3. Handle feedback accurately

   - On 503, close the pending dialog, refresh server state, and retain a persistent contextual error.
   - Use wording that also handles a client-generated 503 where the response was lost, for example: “Session revocation could not be confirmed. The account state was refreshed, and it is safe to try again.”
   - On a successful re-run for an already-deactivated user, show persistent contextual success because the visible user status will not change.
   - Keep the re-run action available afterward; idempotency makes that consistent across reloads and administrators.

4. Expand user-detail coverage

   - Verify an initially deactivated user gets the session-revocation action after a cold mount.
   - Verify both actions remain hidden without `users:write`.
   - Verify active-user 503 refreshes the page to `DEACTIVATED` and exposes the action.
   - Verify repeated 503 retains the error and action.
   - Verify a successful re-run clears the error and displays completion feedback.
   - Retain the existing heartbeat 503 cases.

5. Update durable documentation

   - Clarify in `docs/api-integration.md` that all deactivated users expose the safe re-run action because pending revocation is not represented by the API.
   - Finish heartbeat comments and authentication documentation.
   - Preserve the generated API snapshots as authoritative inputs; no payload type changes are needed.

6. Validate

   - Format only changed source/test files.
   - Run the focused heartbeat and user-detail tests.
   - Run `npm run lint:fix`.
   - Run `npm run build`.
   - Because the confirmation dialog is an overlay change, run the required CSP static gate and browser audit if the user-managed environment is available.
   - Finish with `git diff --check`.

This avoids storing guessed backend state in React while guaranteeing that a failed cleanup can be retried after any reload or handoff to another administrator.
