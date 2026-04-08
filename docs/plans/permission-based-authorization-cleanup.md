# budget-analyzer-web Plan: Permission-Based Authorization Cleanup

Date: 2026-04-08

Status: Shipped (phases 1–4)

Parent plan: `architecture-conversations/docs/plans/permission-based-authorization-cleanup.md`

## Update — 2026-04-08

All four phases landed in this repo. Notable details from execution:

- **Phase 1 (Type foundation, permission primitive)**: shipped as planned.
  `User.permissions: string[]` is required (not optional) — TypeScript surfaced
  every test fixture, all of which now declare `permissions`. The role-based
  `src/lib/useAuthorization.ts` and `src/lib/authorization.tsx` were deleted
  after re-confirming zero callers.
- **Phase 2 (API rename + path migration)**: shipped as planned. The rename
  was carried in full — all type, hook, API, and component identifiers moved
  from `Admin*Transaction*` to `TransactionSearch*`. The page component
  `AdminTransactionsPage` and its directory `src/features/admin/transactions/`
  stayed as-is by design (still part of the admin layout).
  `src/features/admin/transactions/utils/urlState.ts` kept its `ADMIN_TXN_*`
  identifiers (URL contract); only the comment at line 35 was updated to
  reference the new backend path.
- **Phase 3 (Action-level gating)**: shipped as planned. `AdminLayout.tsx`
  uses the explicit-per-item hook pattern (one `usePermission` call per
  permission-dependent nav item, then conditional spread into `navItems`) to
  avoid the rules-of-hooks trap. `useTransactionSearch` accepts an
  `{ enabled }` options bag; `AdminDashboard` passes
  `enabled: canSearchAcrossUsers` so the tile and the query disappear
  together.
- **Phase 4 (Docs and cleanup)**: AGENTS.md gained an "Authorization: Roles
  vs Permissions" subsection under Frontend Architecture. `docs/authentication.md`
  gained a "Frontend Permission Checks" section and the `User` interface in
  the doc now lists `permissions`. README.md was unchanged — it does not
  document the `User` shape. The sweep for `admin/transactions` /
  `adminTransaction` references found nothing stale: the only matches in
  `src/` are the intentionally-kept `AdminTransactionsPage` page component
  and its `/admin/transactions` URL; the only matches in `docs/` are this
  plan file. The `docs/api/budget-analyzer-api.yaml` "admin endpoints"
  parameter descriptions at lines 1216/1222/1442/1448/2761 are deferred to
  the next regeneration via
  `../orchestration/scripts/generate-unified-api-docs.sh` (per the plan,
  do not hand-edit). One grammatical typo (`an TransactionSearchQuery` →
  `a TransactionSearchQuery`) left over from the Phase 2 rename was fixed
  in `urlState.ts`.

## Purpose

Finish the frontend half of the ecosystem-wide permission-based authorization
cleanup. Two concrete outcomes:

1. **Action-level UI checks** read from a new `permissions` field on `User`
   instead of piggy-backing on `isAdmin(user.roles)`. The existing `AdminRoute`
   layout guard stays — roles for layout, permissions for actions
   (bulletproof-react convention).
2. **Transaction search** moves off `/v1/admin/transactions` onto
   `/v1/transactions/search` in the API client, hook, and MSW mocks, matching
   the transaction-service rename in the parent plan.

## Prerequisites

This plan assumes the parent plan's steps 1–2 have shipped:

- permission-service V5 migration seeds `transactions:{read,write,delete}:any`.
- service-common `ClaimsHeaderTestBuilder.admin()` includes the three `:any`
  permissions (affects backend tests only, not this repo).
- transaction-service deleted `AdminTransactionController`; the new endpoints
  live at `GET /v1/transactions/search` and `GET /v1/transactions/search/count`.
- session-gateway's `/auth/v1/user` response includes a `permissions: string[]`
  field.

Until those ship, Phase 1 of this plan can land safely (extending `User` with
an optional/default `permissions: []` is forward-compatible), but Phase 2 will
break the admin transactions page because `/v1/admin/transactions` returns 404.
Deploy Phase 2 only after the transaction-service cutover.

## Current State (discovered)

Relevant files in this repo today:

- `src/types/auth.ts` — `User` has `roles: UserRole[]`, no `permissions`.
- `src/features/auth/hooks/useAuth.ts` — wraps React Query on `/auth/v1/user`.
  Whatever shape `authApi.getCurrentUser()` returns flows straight through, so
  extending `User` is automatic end-to-end.
- `src/features/auth/utils/role.ts` — `isAdmin(roles)` helper. Used by
  `AdminRoute.tsx:68`, `Layout.tsx:46`, `LoginPage.tsx:29`.
- `src/features/admin/components/AdminRoute.tsx` — the layout guard. Keeps
  using `isAdmin`. Unchanged by this plan.
- `src/lib/useAuthorization.ts` + `src/lib/authorization.tsx` — a pre-existing
  role-based `useAuthorization()` / `<Authorization>` pair. **Not imported
  anywhere outside its own module today** (confirmed via grep). Either gets
  replaced by the new permission primitive or left as dead code to delete.
- `src/api/adminTransactionApi.ts` — calls `GET /v1/admin/transactions`.
- `src/features/admin/transactions/api/useAdminTransactions.ts` — React Query
  hook wrapping the above. Used by:
  - `src/features/admin/transactions/pages/AdminTransactionsPage.tsx`
  - `src/features/admin/pages/AdminDashboard.tsx` (summary card, page=0 size=1)
- `src/mocks/handlers.ts:30` — MSW handler for `/api/v1/admin/transactions`.
- `src/types/adminTransaction.ts` — `AdminTransaction`, `PagedResponse`,
  `AdminTransactionFilters`, `AdminTransactionsQuery`. "Admin" in the name is
  purely cosmetic; the shapes aren't admin-specific.
- `src/features/admin/transactions/utils/urlState.ts:35` — comment references
  `docs/api/budget-analyzer-api.yaml:1444-1446` (line is now ~1480 after the
  spec rename — verify when regenerating).
- `src/features/admin/transactions/components/AdminTransactionFilters.tsx` and
  `AdminTransactionTable.tsx` — component names carry "Admin" in the class,
  directory, and identifier sense. Renaming is optional (see Phase 2).
- `src/features/admin/pages/AdminDashboard.tsx` — summary cards include a
  Transactions tile powered by `useAdminTransactions`.
- `src/features/admin/components/AdminLayout.tsx:33-59` — sidebar nav items
  (`currencies`, `statement-formats`, `transactions`, `users/deactivate`).
  Currently every item renders unconditionally because `AdminRoute` has
  already proven the user is `ADMIN`.
- `src/features/admin/users/pages/DeactivateUserPage.tsx` — the only
  destructive user-management page. No per-action gating today.
- `src/features/transactions/components/BulkDeleteModal.tsx` — bulk delete on
  the user-facing (self-scope) transactions page. No gating; relies on the
  backend to 403.
- `docs/api/budget-analyzer-api.yaml` — generated from backend specs by
  `../orchestration/scripts/generate-unified-api-docs.sh`. **The current file
  already has `/v1/transactions/search` and `/v1/transactions/search/count`
  (lines 1196 and 1422)** — either the generator ran against a dev branch, or
  the spec needs regenerating after the backend lands. Parameter descriptions
  still mention "admin endpoints" (lines 1216, 1222, 1442, 1448), which will
  fall out of the next regeneration.
- Test fixtures: `src/mocks/handlers.ts`,
  `src/components/__tests__/SessionHeartbeatProvider.test.tsx:41,66`,
  `src/hooks/__tests__/useSessionHeartbeat.test.ts:48` — all build `User`-ish
  objects with `roles: ['ADMIN']` and no `permissions` field. TypeScript will
  surface each site once `permissions` is added as a required field.

No tests exist for `AdminRoute`, `adminTransactionApi`, or
`useAdminTransactions`. Adding them is a Phase 4 enhancement, not a
precondition.

## Design Decisions

### Permission primitive shape

Minimal surface, no abstraction for anything not yet required:

```ts
// src/features/auth/utils/permissions.ts
export function hasPermission(user: User | null, permission: string): boolean;

// src/features/auth/hooks/usePermission.ts
export function usePermission(permission: string): boolean;
```

`hasPermission` is a plain function so non-component code (e.g., the MSW
handler guard if we ever want it) can call it. `usePermission` is a one-line
wrapper that pulls `user` from `useAuth`.

**No `<Can>` wrapper component** unless a Phase 3 site clearly benefits.
Conditional render with a hook is idiomatic React and cheaper to delete.

**No permission constants union.** The backend owns the permission catalogue
and it has 24 entries. A `string[]` with inline literals (`'transactions:read:any'`)
is honest. If a typo slips in, the check fails safe (returns `false`) and the
behavior is identical to "user doesn't have the permission" — which is what
the UI test would catch.

### Fate of existing role-based `useAuthorization` / `<Authorization>`

Delete both files. They have no callers, they model role checks only, and
leaving them around creates a split-brain between "use `usePermission` for
actions" and "there's also this role thing." Deleting unused code is cheaper
than explaining why it exists.

If a concern comes up during Phase 1 ("what if something imports it from a
feature I haven't grepped"), the grep evidence is in this doc — re-run
`rg "useAuthorization|@/lib/authorization"` before deleting.

### Type renames (adminTransaction → transactionSearch)

The cross-service plan leaves this as a repo call. Decision: **rename**.

- `src/api/adminTransactionApi.ts` → `src/api/transactionSearchApi.ts`
- `src/features/admin/transactions/api/useAdminTransactions.ts` →
  `src/features/admin/transactions/api/useTransactionSearch.ts`
- `src/types/adminTransaction.ts` → `src/types/transactionSearch.ts`
- Type renames: `AdminTransaction` → `TransactionSearchResult`,
  `AdminTransactionFilters` → `TransactionSearchFilters`,
  `AdminTransactionsQuery` → `TransactionSearchQuery`.
- Component renames: `AdminTransactionTable` → `TransactionSearchTable`,
  `AdminTransactionFilters` → `TransactionSearchFiltersPanel` (or similar —
  the component file name already collides with the type, so one of the two
  must move).

**Keep** `src/features/admin/transactions/` as the directory. The *page* is
still part of the admin layout (sits behind `AdminRoute`), and the feature
directory is the page, not the API layer.

**Keep** the URL `/admin/transactions` (React Router path in `App.tsx:48`
and the sidebar entry in `AdminLayout.tsx:50`). That's a layout convention,
not an API path.

This rename is large (touches 11 files per the Grep) but mechanical. Phase 2
carries it. If the rename turns out to be noisier than expected in review,
trim to just renaming the *API layer* (`adminTransactionApi.ts` →
`transactionSearchApi.ts`) and the *hook* — those are the files the cross-
service plan explicitly calls out. The type/component renames can be dropped
without affecting correctness.

### Action-level gating targets

Enumerated from the current tree:

| Site | File | Permission |
|---|---|---|
| Cross-user transaction search page (whole page) | `AdminTransactionsPage.tsx` | `transactions:read:any` |
| Admin dashboard "Transactions" tile + query | `AdminDashboard.tsx` | `transactions:read:any` |
| Sidebar nav item "Transactions" | `AdminLayout.tsx:50` | `transactions:read:any` |
| Sidebar nav item "Deactivate User" | `AdminLayout.tsx:55` | `users:write` |
| Deactivate user form (submit) | `DeactivateUserPage.tsx:98` | `users:write` |
| Bulk delete (self-scope) | `BulkDeleteModal.tsx` + trigger in `TransactionTable.tsx` | `transactions:delete` |

Not gated (permissions apply backend-side only):
- Currency CRUD pages — all users with `ADMIN` layout access already get the
  permissions in the `ADMIN` bundle. Revisit if/when a finer-grained role
  splits them apart.
- Statement format CRUD pages — same reasoning.
- ~~Individual transaction edit / delete on the user-facing page
  (`TransactionsPage`) — these already gate on `transactions:write` and
  `transactions:delete` at the backend; the UI currently shows the buttons
  to any authenticated user and lets the backend 403. No change unless a
  future role stops carrying those.~~ **Now gated** in
  `docs/plans/gate-transaction-action-ui.md`: per-row Edit/Delete dropdown
  items, the row selection column, and the Import button on
  `TransactionsPage` all check `transactions:write` /
  `transactions:delete` at the UI layer, matching the bulletproof-react
  convention even though the underlying role bundle is unchanged.

**Currencies and Statement Formats nav items stay ungated** in Phase 3.
They become gating candidates the day we introduce a role that has
`ADMIN` layout access but not `currencies:write` / `statementformats:write`.
The parent plan explicitly calls that out as future work.

### Backend sync points

- The new `/v1/transactions/search` endpoint uses the same query-string
  shape as the old `/v1/admin/transactions` (per the OpenAPI spec already
  in the repo). No changes to `AdminTransactionsQuery` field names — just
  change the path.
- `GET /v1/transactions/search/count` exists in the spec but the current
  frontend doesn't call it. Not adding a client for it in Phase 2 unless a
  site needs it.
- session-gateway response shape adds `permissions: string[]`. Nothing else
  in the response changes. Extending the TypeScript type is sufficient; the
  React Query cache invalidates on next `/auth/v1/user` fetch.

## Out of Scope

Explicitly not covered by this plan (may be follow-ups):

- Deleting `src/features/auth/utils/role.ts`. `AdminRoute`, `Layout`, and
  `LoginPage` still need it for layout-level decisions.
- Splitting `ADMIN` into finer roles. Parent plan calls this out.
- Adding a permission-aware test harness / fixture builder. Test fixtures
  add `permissions: []` where needed in Phase 1 and specific permission sets
  in Phase 3/4. A helper can come later if the pattern repeats.
- Caching/invalidating permissions beyond what React Query already does for
  `/auth/v1/user`.
- Audit logging of `:any` use from the frontend (backend concern).

---

## Phase 1 — Type Foundation and Permission Primitive

**Goal:** `User.permissions` exists and `usePermission(...)` works. No UI
changes. Safe to land before backend session-gateway update because an
absent `permissions` field defaults to `[]` and every check returns `false`.

**Single session scope. No backend dependency.**

### Changes

1. **`src/types/auth.ts`** — add `permissions: string[]` to `User`. No
   `Permission` type alias. Update the leading JSDoc to mention the field
   and point at the parent plan.

2. **Create `src/features/auth/utils/permissions.ts`**:
   ```ts
   import type { User } from '@/types/auth';

   export function hasPermission(user: User | null, permission: string): boolean {
     if (!user) return false;
     return user.permissions.includes(permission);
   }
   ```

3. **Create `src/features/auth/hooks/usePermission.ts`**:
   ```ts
   import { useAuth } from '@/features/auth/hooks/useAuth';
   import { hasPermission } from '@/features/auth/utils/permissions';

   export function usePermission(permission: string): boolean {
     const { user } = useAuth();
     return hasPermission(user ?? null, permission);
   }
   ```

4. **Delete** `src/lib/useAuthorization.ts` and `src/lib/authorization.tsx`
   after re-verifying with `rg "useAuthorization|@/lib/authorization" src`.
   If anything unexpected turns up, leave them for now and note it in the
   phase output — do not silently convert them.

5. **Update MSW handler** `src/mocks/handlers.ts:5-13` — add `permissions`
   to the `/auth/v1/user` response. Include the full ADMIN bundle so tests
   mimic what the backend will send post-migration:
   ```ts
   permissions: [
     'transactions:read', 'transactions:read:any',
     'transactions:write', 'transactions:write:any',
     'transactions:delete', 'transactions:delete:any',
     'currencies:read', 'currencies:write',
     'statementformats:read', 'statementformats:write',
     'users:read', 'users:write',
     // ...other admin bundle entries as of V5
   ],
   ```
   Don't hand-maintain the full 24-entry list if it's noisy. A minimal list
   containing the permissions actually checked by this repo's UI is
   acceptable — the backend list is authoritative; the frontend test only
   needs the permissions its own code tests for.

6. **Update test fixtures** that build `User` objects (TypeScript will
   surface these):
   - `src/components/__tests__/SessionHeartbeatProvider.test.tsx:37-47,62-72`
   - `src/hooks/__tests__/useSessionHeartbeat.test.ts:48` (verify shape)
   - Any new `useAuth` mock site.

   Add `permissions: []` where the test doesn't care, or a specific list
   where it does.

7. **Add unit tests** for the new primitive:
   - `src/features/auth/utils/__tests__/permissions.test.ts`:
     - `hasPermission(null, ...)` → `false`
     - User without the permission → `false`
     - User with the permission → `true`
     - Typo / unknown permission → `false`
   - `src/features/auth/hooks/__tests__/usePermission.test.tsx`:
     - Renders hook inside a mocked `useAuth` returning a user with the
       permission → `true`
     - Mocked `useAuth` returning `user: null` → `false`

### Verification

- `npm run lint:fix` clean
- `npm test` passes (no regressions; new unit tests pass)
- `npx tsc --noEmit` clean — especially verifying that every test fixture
  that constructs a `User` now has the `permissions` field
- `npm run build` clean

### Phase 1 exit criteria

- `User.permissions: string[]` exists, MSW returns it, all tests compile and
  pass, `usePermission('anything')` returns a sensible boolean everywhere.
- No UI behavior has changed.

---

## Phase 2 — API Endpoint Migration and Rename

**Goal:** The frontend calls `/v1/transactions/search` instead of
`/v1/admin/transactions`. The API/hook/type identifiers drop the "admin"
framing. No changes to action-level gating yet.

**Backend dependency:** Deploy only after transaction-service has cut over
(parent plan step 2). Before that, `/v1/transactions/search` returns 404.

**Single session scope.** Rename is large but mechanical.

### Changes

1. **Rename files** (preserve git history via `git mv`):
   - `src/api/adminTransactionApi.ts` → `src/api/transactionSearchApi.ts`
   - `src/types/adminTransaction.ts` → `src/types/transactionSearch.ts`
   - `src/features/admin/transactions/api/useAdminTransactions.ts` →
     `src/features/admin/transactions/api/useTransactionSearch.ts`
   - `src/features/admin/transactions/components/AdminTransactionTable.tsx`
     → `TransactionSearchTable.tsx`
   - `src/features/admin/transactions/components/AdminTransactionFilters.tsx`
     → `TransactionSearchFiltersPanel.tsx`

   Leave `src/features/admin/transactions/` and `AdminTransactionsPage.tsx`
   as-is — the page is still the admin layout's transactions page.

2. **Update path in the API client**:
   - `transactionSearchApi.ts`: `'/v1/admin/transactions'` →
     `'/v1/transactions/search'`. Export becomes `transactionSearchApi` with
     method `search(...)` (drop the `searchTransactions` suffix — the API
     object name already says "transaction search").

3. **Rename exports**:
   - `adminTransactionApi` → `transactionSearchApi`
   - `useAdminTransactions` → `useTransactionSearch`
   - `AdminTransaction` → `TransactionSearchResult`
   - `AdminTransactionFilters` (type) → `TransactionSearchFilters`
   - `AdminTransactionsQuery` → `TransactionSearchQuery`
   - `AdminTransactionTable` (component) → `TransactionSearchTable`
   - `AdminTransactionFilters` (component) → `TransactionSearchFiltersPanel`

4. **Update all imports.** Grep-driven sweep — the current consumer set is:
   - `src/features/admin/transactions/pages/AdminTransactionsPage.tsx`
   - `src/features/admin/transactions/utils/urlState.ts`
   - `src/features/admin/pages/AdminDashboard.tsx`
   - `src/features/admin/transactions/components/*` (mutual references)

   Verify afterwards with `rg "AdminTransaction|adminTransaction|useAdminTransactions|/v1/admin/"` — expected: zero matches in `src`, possibly matches in `docs/` from this very plan.

5. **Update `urlState.ts` identifiers**: `ADMIN_TXN_PARAMS` stays (it's the
   URL querystring contract, not the API). `parseAdminTxnQuery` →
   `parseTransactionSearchQuery`, `buildAdminTxnSearchParams` →
   `buildTransactionSearchParams`, `clearAdminTxnFilters` →
   `clearTransactionSearchFilters`. Or, to minimize churn, *keep the
   function names and just update the comment at line 35* — decide during
   the session based on how noisy the diff already is.

6. **Update the MSW handler** `src/mocks/handlers.ts:30-57` — path from
   `/api/v1/admin/transactions` to `/api/v1/transactions/search`. Response
   body unchanged.

7. **Regenerate** `docs/api/budget-analyzer-api.yaml` via the orchestration
   script (`../orchestration/scripts/generate-unified-api-docs.sh`) if the
   repo allows running it locally, otherwise note in the commit message
   that the spec is already in sync with the new paths and only parameter
   descriptions (the "admin endpoints" phrasing at lines 1216/1222/1442/
   1448/2761) will fall out of the next regeneration against updated
   backend docs. Do not hand-edit those lines in this repo.

### Verification

- `npm run lint:fix` clean
- `npm test` passes — `useTransactions.test.tsx` is the only existing test
  that touches transaction APIs and it uses `/v1/transactions` (self-scope),
  which is unchanged
- `npx tsc --noEmit` clean
- Manual smoke (only meaningful against a dev cluster with the migrated
  backend):
  - Log in as an admin user
  - Open `/admin/transactions` — page loads, data renders, filters work
  - Open `/admin` dashboard — Transactions tile shows count
- Grep check: `rg -n "adminTransaction|AdminTransaction|/v1/admin/transactions" src` returns nothing

### Phase 2 exit criteria

- No references to `/v1/admin/transactions` in `src/`
- All type/hook/api/component identifiers use the `TransactionSearch`
  prefix
- MSW handlers serve the new path
- Existing behavior is preserved (tests pass, admin transactions page still
  works functionally)

---

## Phase 3 — Action-Level UI Gating

**Goal:** Switch the sites enumerated in "Design Decisions → Action-level
gating targets" from implicit role gating (via `AdminRoute`) to explicit
permission checks. At minimum: admin transactions page, admin dashboard
transactions tile, sidebar nav items, deactivate user page, bulk delete
(user-facing).

**Backend dependency:** Must be deployed after session-gateway returns
`permissions` in `/auth/v1/user`. Otherwise every check will be `false` and
every gated control will be hidden — which is at least fail-safe but
unhelpful.

**Single session scope.**

### Changes

1. **`AdminTransactionsPage.tsx` (now `AdminTransactionsPage` in the
   renamed tree):** At the top of the component, check
   `usePermission('transactions:read:any')`. If false, render a small
   "You don't have permission to view cross-user transactions" message
   reusing `UnauthorizedPage.tsx`-style styling (or `<UnauthorizedPage />`
   inline). Do not call `useTransactionSearch` in that branch — skip the
   query to avoid a guaranteed 403.

2. **`AdminDashboard.tsx`:** Wrap the Transactions tile and its data hook
   behind `usePermission('transactions:read:any')`. If false, hide the
   tile entirely (don't render a disabled state). Also skip calling
   `useTransactionSearch` via the TanStack Query `enabled` option:
   ```ts
   const canSearchAcrossUsers = usePermission('transactions:read:any');
   const { data: transactionsPage } = useTransactionSearch(query, {
     enabled: canSearchAcrossUsers,
   });
   ```
   This requires `useTransactionSearch` to accept an options bag — add
   `enabled?: boolean` passthrough. Small, additive change.

3. **`AdminLayout.tsx`:** Add a `permission?: string` field to the
   `NavItem` interface. Populate:
   - Transactions → `'transactions:read:any'`
   - Deactivate User → `'users:write'`
   Filter the `navItems` array with `usePermission` at render time. Items
   without `permission` render unconditionally (Dashboard, Currencies,
   Statement Formats).

   Implementation nuance: `usePermission` is a hook, so the filter must
   call it once per item. Compute an array of `[item, allowed]` pairs at
   the top of the component with individual hook calls, then map. Don't
   call `usePermission` inside a `.filter()` callback — that violates the
   rules of hooks. A straightforward approach: hard-code the four
   permission-dependent items at the top of the component with their own
   `usePermission` calls and build `navItems` from those booleans. Ugly
   but correct.

   Example sketch:
   ```tsx
   const canSearchAny = usePermission('transactions:read:any');
   const canDeactivateUsers = usePermission('users:write');

   const navItems: NavItem[] = [
     { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
     { to: '/admin/currencies', label: 'Currencies', icon: DollarSign },
     { to: '/admin/statement-formats', label: 'Statement Formats', icon: FileText },
     ...(canSearchAny
       ? [{ to: '/admin/transactions', label: 'Transactions', icon: List }]
       : []),
     ...(canDeactivateUsers
       ? [{ to: '/admin/users/deactivate', label: 'Deactivate User', icon: UserMinus }]
       : []),
   ];
   ```

4. **`DeactivateUserPage.tsx`:** Top-of-component `usePermission('users:write')`
   guard. If false, render `<UnauthorizedPage />`. Form never mounts.

5. **`BulkDeleteModal.tsx` + its trigger in
   `TransactionsPage`/`TransactionTable.tsx`:** Hide the "Delete selected"
   button (the modal trigger) unless `usePermission('transactions:delete')`
   is true. The bulk delete is self-scope on the user-facing page, so the
   permission is the unscoped `transactions:delete`. Verify the actual
   trigger location — if it's a prop passed down from a parent, gate there.

6. **`useTransactionSearch` options bag:** Add an optional second argument
   for React Query passthrough (at least `enabled`). Keep the default
   behavior identical to today.

### Verification

- `npm run lint:fix` clean
- `npm test` passes. Fixture updates: the MSW `/auth/v1/user` handler from
  Phase 1 already returns a full ADMIN permission set, so existing tests
  that assume "admin can see everything" keep working.
- Add unit tests (where low cost):
  - `AdminTransactionsPage` renders the unauthorized branch when
    `usePermission` returns false (mock the hook).
  - `AdminLayout` hides the Transactions nav item when
    `transactions:read:any` is missing.
  - `DeactivateUserPage` renders unauthorized when `users:write` is
    missing.
- Manual smoke against dev cluster:
  - Admin user sees every nav item, every tile, every gated button.
  - USER role (if testable via session-gateway, e.g., a seed account) is
    kept out of `/admin` by `AdminRoute` as today — no regression.

### Phase 3 exit criteria

- Every enumerated action-level site reads `usePermission(...)` instead of
  relying on `isAdmin`.
- Hiding a nav item or page for a missing permission is visibly working in
  at least one manual test (e.g., temporarily constructing a user with a
  reduced permission list in the MSW handler).
- `isAdmin` is still used by `AdminRoute`, `Layout`, and `LoginPage` — no
  change to those three.

---

## Phase 4 — Documentation, Fixture Cleanup, Follow-Up Tests

**Goal:** Ship the docs and tests that make the new convention legible and
sticky. No behavior changes.

**Single session scope.**

### Changes

1. **`AGENTS.md`** — add a subsection under the auth area (or create one if
   absent) titled "Roles vs Permissions". Content:
   - `isAdmin(user.roles)` / `AdminRoute` is for **layout** decisions
     (which chrome surrounds the page).
   - `usePermission('...')` / `hasPermission(...)` is for **action**
     decisions (whether a specific button, form, or tile renders).
   - Never gate an action on `isAdmin`. If a button is admin-only, it's
     because it needs a specific permission that happens to be in the
     ADMIN bundle — name the permission.
   - Link to parent plan:
     `../architecture-conversations/docs/plans/permission-based-authorization-cleanup.md`
   - List the action-level gating targets from Phase 3 as examples.

2. **`README.md`** — if the README documents the auth shape or the `User`
   type (grep first), update the shape to include `permissions`. If not,
   skip.

3. **`docs/authentication.md`** — the existing guide covers the backend
   architecture in detail. Add a short subsection "Frontend permission
   checks" pointing at `usePermission` and the AGENTS.md convention note.
   Do not duplicate backend content.

4. **Delete dead references in docs/comments** — grep
   `rg -n "admin/transactions|adminTransaction"` across `docs/` and `src/`
   once more and clean any stragglers (typically comments or the plan docs
   themselves, which should stay).

5. **Verify the plan file** in `docs/plans/` is itself consistent with
   what shipped. Edit this file with a dated "Update" note if details
   drifted during execution.

6. **Optional (skip unless time allows):**
   - Test for `AdminRoute` itself — the existing test suite has none. A
     simple "renders outlet for admin user, redirects non-admin" pair is
     cheap.
   - Test for `hasPermission` is already in Phase 1.

### Verification

- `npm run lint:fix` clean
- `npm test` passes
- `rg "admin/transactions|adminTransaction|useAdminTransactions" src docs`
  returns no unexpected hits (this plan file is expected to match)

### Phase 4 exit criteria

- AGENTS.md documents the roles-vs-permissions split.
- No stale references to admin transaction endpoints or identifiers
  outside this plan file.
- Existing tests still pass; any new tests added are focused and small.

---

## Rollout Sequencing Within This Repo

Phases can land as four PRs in order:

1. **Phase 1** — lands immediately, no backend dependency. Forward-
   compatible because `permissions` defaults to `[]`. Unblocks Phase 3
   type-wise.
2. **Phase 2** — lands after the parent plan's backend step 2 is deployed
   to the target environment. Before that, this PR would break the admin
   transactions page in whatever environment it lands in.
3. **Phase 3** — lands after Phase 2 (depends on the renamed hook for the
   `enabled: canSearchAny` integration) and after session-gateway is
   returning `permissions` in `/auth/v1/user` (otherwise gated UI is
   hidden from everyone).
4. **Phase 4** — lands any time after Phase 3.

Skipping phases or combining them is fine if the session budget allows,
but the ordering constraint between Phase 1/2/3 is real.

## Risks

- **Phase 2 rename churn.** The rename is mechanical but touches ~11
  files and renames four TypeScript types + three identifiers. If review
  feedback says "too much churn," the fallback is to *only* rename the
  API path string in `adminTransactionApi.ts` and the MSW handler and
  drop the identifier renames. The parent plan only strictly requires
  the *path* to move; the rename is stylistic.
- **`<Can>` temptation.** Don't add one in Phase 3 just because it looks
  nice. Inline `usePermission` checks are fine for the five or six sites
  enumerated here.
- **AdminLayout nav filtering violates rules of hooks** if done naively
  (`.filter(item => usePermission(item.permission))`). The sketch in
  Phase 3 calls the hooks at top level — reviewers should watch for this
  specific trap.
- **MSW admin-permission list drift.** Phase 1 hard-codes a subset of the
  ADMIN bundle into `handlers.ts`. If a future permission lands in the
  backend that the frontend starts checking, this list must grow.
  Acceptable because the cost of "add one string to an array" is trivial
  and the alternative (importing from backend) doesn't fit this repo's
  boundaries.
