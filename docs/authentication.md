# Authentication and Authorization

This document owns the frontend authentication, session, role, and permission
contracts. Endpoint and payload schemas remain authoritative in the generated
[Session Gateway API](api/session-gateway-api.yaml). General request handling is
documented in [API integration](api-integration.md).

## Security Boundary

Budget Analyzer uses a server-side session pattern:

```text
Frontend document and assets:
  Browser -> Istio ingress -> NGINX -> frontend

Authentication paths:
  Browser -> Istio ingress -> Session Gateway

API requests:
  Browser -> Istio ingress -> ext_authz -> NGINX -> backend service
```

The Session Gateway owns the OAuth2/OIDC lifecycle, stores identity-provider
tokens server-side, and gives the browser only an opaque session cookie. The
public cookie defaults to `BA_SESSION` and is `HttpOnly`, `Secure`, and
`SameSite=Strict`; deployments can configure the cookie name and SameSite
policy. Frontend code cannot and must not inspect the cookie or store tokens in
`localStorage` or `sessionStorage`.

For `/api/*`, ext_authz validates the Redis-backed session and injects identity
headers before NGINX routes the request. Backend services remain authoritative
for authorization and resource ownership. Frontend permission checks improve
navigation and affordances; they are not a security boundary.

The broader routing and trust boundaries are owned by
[Architecture](architecture.md). Local access URLs and environment setup are
owned by [Development](development.md).

## Authentication Lifecycle

### Login and protected-route bootstrap

`useAuth` in `src/features/auth/hooks/useAuth.ts` stores the current user in a
TanStack Query entry keyed by `['auth', 'currentUser']`. It calls
`GET /auth/v1/user` with credentials, uses a five-minute stale time, and does
not retry automatically.

`AuthenticatedRoute` wraps the complete user and admin application tree:

1. While the current-user request is pending, it renders only the
   authentication loading state. Protected layouts, permission guards, and
   feature hooks do not mount.
2. A successful user response mounts the protected route tree.
3. An empty 401 becomes an unauthenticated result and starts one replacement
   navigation to `/oauth2/authorization/idp`.
4. Network failures and non-401 responses remain in the SPA as an
   authentication-availability error with a Retry action. They do not start
   OAuth2 and protected children remain unmounted.

The automatic login navigation carries the requested pathname, query, and hash
as `returnUrl`. `src/features/auth/utils/loginRedirect.ts` accepts only
same-origin absolute paths that begin with one `/` and rejects protocol-relative
and `/\\` paths. A document-wide latch prevents Strict Mode, route bootstrap,
and concurrent API 401s from starting duplicate automatic navigations.

`/login`, `/peace`, `/oops`, and `/unauthorized` are public SPA routes. The
frontend document and static assets are also public at ingress; authentication
is established by the SPA boundary before protected application code mounts.

### Explicit login and logout

`login(returnUrl?)` starts the Session Gateway flow at
`/oauth2/authorization/idp`. The gateway handles the identity-provider redirect,
callback, server-side session creation, cookie issuance, and return to the SPA.

`logout()` clears the frontend Query cache and navigates to `/logout`. The
Session Gateway clears the server session and browser cookie and completes the
identity-provider logout redirect chain. Session-expiry paths also use
`/logout`, so cleanup stays centralized.

### API 401 after bootstrap

The shared API response interceptor treats a later 401 as an absent, expired,
or revoked session. It starts the same latched replacement navigation with a
safe `returnUrl`, but every failed request still rejects as an `ApiError`.
Concurrent 401 responses therefore cause one navigation without becoming
successful query results. A 403 is an authorization failure and never starts
login.

See [API integration](api-integration.md#error-normalization) for the complete
client error contract.

## Heartbeat, Inactivity, and Expiry

`SessionHeartbeatProvider`, mounted by `src/App.tsx`, enables
`useSessionHeartbeat` only for an authenticated user. The hook calls
`GET /auth/v1/session`, which validates the Redis-backed session and extends its
sliding TTL without contacting the identity provider. The deployment default
session TTL is 15 minutes.

Frontend behavior is:

- Send one heartbeat when the provider becomes enabled.
- On later intervals, send a heartbeat only if mouse, keyboard, click, touch,
  or captured scroll activity occurred since the previous check. API requests
  alone do not extend the session.
- Schedule a non-dismissable warning from the response's Unix-seconds
  `expiresAt`. Continue sends another heartbeat; reaching zero navigates to
  `/logout`.
- Publish successful expiry updates through the `session-heartbeat`
  `BroadcastChannel`, allowing other tabs to dismiss and reschedule their
  warnings.
- Retry a network failure or HTTP 502 once immediately. If that retry fails,
  show a warning toast. A 401 navigates to `/logout`.

The default interval is two minutes and the warning begins two minutes before
expiry. `VITE_HEARTBEAT_INTERVAL_MS` and
`VITE_WARNING_BEFORE_EXPIRY_SECONDS` override those frontend defaults; the
environment-variable inventory belongs to
[Development](development.md#environment-variables).

## Current User Contract

The frontend consumes this subset of the `/auth/v1/user` response:

```ts
interface User {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  authenticated: boolean;
  roles: ('USER' | 'ADMIN')[];
  permissions: string[];
}
```

Roles decide which layout chrome surrounds a page. Permissions decide whether
an action, feature route, tile, or navigation affordance is available. The
values come from the current-user query; there is no separate frontend role or
permission cache.

## Roles and Permissions

### Roles are for layout

Use `isAdmin(user.roles)` from `src/features/auth/utils/role.ts` only for
layout-level decisions. `AdminRoute` uses it to select the admin application
shell; `Layout` and `LoginPage` use it for role-aware navigation. Never use an
admin role check to gate a specific action. If an action is admin-only, gate it
with the permission that authorizes that action.

### Permissions are for actions and features

Permission checks are exact string matches against `user.permissions`. Unknown
or misspelled strings fail closed.

- `PermissionGuard` in
  `src/features/auth/components/PermissionGuard.tsx` owns route and subtree
  gating. Without a `fallback`, denial redirects to `/unauthorized`; with
  `fallback={null}`, denial hides the inline subtree. Denied children never
  mount, so their data hooks never fire.
- `usePermission(permission)` in
  `src/features/auth/hooks/usePermission.ts` owns individual buttons, rows,
  and imperatively assembled navigation items.
- `hasPermission(user, permission)` in
  `src/features/auth/utils/permissions.ts` is the equivalent plain function for
  non-component code.

Use `PermissionGuard` for "should this page or subtree exist for me?" and
`usePermission` for "should this affordance render?". Do not add a React Query
`enabled` condition when a guard already prevents the query-owning child from
mounting. Use `enabled` only when one component must run a gated query alongside
other unconditional work.

Read-only table bodies and cells are not independently permission-gated. If a
user reaches a page they cannot read, the backend 403 must remain observable as
an error rather than being converted into an empty-table state. Gate distinct
cross-user pages or features at their route or subtree boundary.

### Self scope and cross-user scope

The permission catalogue is backend-owned. The frontend uses inline literals
such as:

| Resource          | Current-user scope                                               | Cross-user scope                                                             |
| ----------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Transactions      | `transactions:read`, `transactions:write`, `transactions:delete` | `transactions:read:any`, `transactions:write:any`, `transactions:delete:any` |
| Currencies        | `currencies:read`, `currencies:write`                            | Not applicable                                                               |
| Statement formats | `statementformats:read`, `statementformats:write`                | Not applicable                                                               |
| Users             | `users:read`, `users:write`                                      | Not applicable                                                               |

An `:any` suffix widens a transaction operation from the current user's
resources to resources across users. Use it only for a distinct cross-user
feature, such as admin transaction search. User-facing import, edit, delete,
and selection affordances use the unscoped permission.

### Grant-time read invariant

Backend role bundles grant read access alongside write or delete access for the
same resource. Write and delete remain independent of each other. Frontend
checks do not expand permissions at runtime: edit routes can require the write
permission directly, and `hasPermission` remains a literal membership check.
If a bundle contains write or delete without the corresponding read permission,
fix the backend grant rather than adding frontend inference or redundant gates.

### Rules-of-hooks constraint

`usePermission` is a hook and cannot be called inside `.filter()`, loops, or
callbacks. Use either:

- `PermissionGuard` around the complete subtree, or
- top-level `usePermission` calls followed by conditional spreads when building
  a list, as in `src/features/admin/components/AdminLayout.tsx`.

## Authentication Troubleshooting

- **Authentication fails on the Vite port:** use the ingress URL documented in
  [Development](development.md); the direct Vite server does not provide the
  authentication routing boundary.
- **The cookie is absent from `document.cookie`:** this is expected for the
  HttpOnly session cookie. Inspect browser storage/network tooling instead of
  adding JavaScript cookie detection.
- **Bootstrap shows “Authentication unavailable”:** inspect
  `/auth/v1/user`. Only a 401 starts login; network errors and 5xx responses are
  retryable availability failures.
- **An API request returns 403:** the session is valid but the operation is not
  authorized. Do not turn the response into a login redirect.
- **The session warning appears unexpectedly:** inspect activity tracking,
  heartbeat responses, `expiresAt`, and the two heartbeat environment values.
  A heartbeat 401 deliberately takes the logout path.

Authentication test conventions and browser-harness prerequisites belong to
the [Testing guide](testing-guide.md). API endpoint and payload changes must be
checked against the generated [Session Gateway API](api/session-gateway-api.yaml)
and [unified backend API](api/budget-analyzer-api.yaml).
