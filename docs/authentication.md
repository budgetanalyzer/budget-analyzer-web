# Authentication Integration Guide

## Overview

Budget Analyzer uses a **Session Gateway pattern** with **Istio ext_authz** for per-request validation. This means:
- JWTs are never exposed to the browser (XSS protection)
- Session cookies are HttpOnly, Secure, and SameSite
- Auth lifecycle flows are handled server-side by the Session Gateway
- Per-request session validation is handled by ext_authz at the Istio ingress layer
- Frontend only needs to call `/user` endpoint and redirect to login/logout

## Architecture

```
API requests:
  Browser → Istio Ingress (:443) → ext_authz (:9002) → NGINX (:8080) → Backend Services

Auth paths (/oauth2/*, /login/oauth2/*, /logout, /user, /auth/*):
  Browser → Istio Ingress (:443) → Session Gateway (:8081)

Frontend pages:
  Browser → Istio Ingress (:443) → NGINX (:8080) → Vite (:3000)
```

### Component Roles

| Component | Port | Role |
|-----------|------|------|
| Istio Ingress Gateway | 443 (HTTPS) | SSL termination, ext_authz enforcement on `/api/*`, auth-path rate limiting, routing |
| ext_authz | 9002 (HTTP) | Per-request session validation via Redis lookup, identity header injection |
| Session Gateway | 8081 (HTTP) | OAuth2 flows, session lifecycle, token storage, session hash creation in Redis |
| NGINX Gateway | 8080 (HTTP) | Request routing, backend rate limiting, load balancing |
| Permission Service | 8086 (HTTP) | Roles/permissions resolution (called by Session Gateway) |

## Development Setup

### Access URLs

**Development:**
- Frontend: `https://app.budgetanalyzer.localhost` (Istio Ingress Gateway)
- DO NOT use `http://localhost:3000` (Vite dev server) - authentication won't work

**Production:**
- Frontend: Load balancer domain (e.g., `https://budgetanalyzer.com`)

### Request Flow (Development)

For frontend pages:
1. Browser requests `https://app.budgetanalyzer.localhost/`
2. Istio Ingress Gateway terminates SSL
3. Istio routes to NGINX (8080)
4. NGINX proxies to Vite dev server (3000)
5. Vite serves React app with HMR

For API requests:
1. Browser requests `https://app.budgetanalyzer.localhost/api/transactions`
2. Istio Ingress calls ext_authz (9002)
3. ext_authz looks up session in Redis (`session:{id}`)
4. If valid: ext_authz injects `X-User-Id`, `X-Roles`, `X-Permissions` headers
5. Istio routes to NGINX (8080) with injected identity headers
6. NGINX routes to appropriate backend service
7. Backend service reads identity from headers and enforces data-level authorization

## Authentication Flows

### Login Flow

```typescript
// User clicks login button
const { login } = useAuth();
login(); // Redirects to /oauth2/authorization/idp

// Session Gateway handles:
// 1. Redirect to IdP login
// 2. OAuth callback (/login/oauth2/code/idp)
// 3. Exchange authorization code for tokens
// 4. Store session data in Redis session hash
// 5. Call permission-service to resolve roles/permissions
// 6. Write session data to Redis hash (session:{id})
// 7. Set session cookie (HttpOnly, Secure, SameSite)
// 8. Redirect back to frontend
```

### Logout Flow

```typescript
// User clicks logout button
const { logout } = useAuth();
logout(); // Navigates to /logout

// Session Gateway handles:
// 1. Delete session hash from Redis
// 2. Clear session cookie
// 3. Redirect to IdP logout
// 4. Redirect back to frontend
```

### Check Authentication Status

```typescript
// On app load, check if user is authenticated
const { user, isAuthenticated, isLoading } = useAuth();

// Internally calls GET /user endpoint (routed to Session Gateway)
// Returns user info if session is valid
// Returns null if no valid session
```

### Session Heartbeat

The frontend periodically calls `GET /auth/v1/session` to keep the session alive. Implemented via `SessionHeartbeatProvider` (mounted in `App.tsx`) which uses the `useSessionHeartbeat` hook.

**What it provides:**
- **Sliding session TTL**: Each heartbeat resets the 15-minute session expiry
- **Local session validation**: Heartbeat validates the Redis-backed session only; it does not call Auth0
- **Inactivity warning**: A non-dismissable modal with a live countdown timer appears before session expiry, allowing the user to click "Continue" to extend the session. If the countdown reaches zero, the user is automatically redirected to `/logout`

**Response:**
```json
{
  "userId": "user123",
  "roles": ["ADMIN", "USER"],
  "expiresAt": 1711720800
}
```

The frontend derives remaining time as `expiresAt - Math.floor(Date.now() / 1000)`.

**Server response behavior:**
- 200: Session is valid and the server extends the Redis session TTL
- 401: No valid session — redirect to login
- 502: Transient gateway/backend error — retry on next interval

**Frontend behavior:**
- Heartbeat fires immediately on mount, then every 2 minutes by default if user is active
- If user is inactive (no mouse, keyboard, click, scroll, or touch events), heartbeat is skipped
- Scroll tracking uses capture phase to detect scrolling in overflow containers (not just window scroll)
- A warning modal with a live countdown timer appears 2 minutes before session expiry (based on `expiresAt` from server)
- Expiry warnings are synced across tabs via `BroadcastChannel` — if one tab extends the session, other tabs reschedule their warning timers
- On network error or 502 transient error, retries once; if retry fails, shows a toast warning
- On 401, redirects to `/oauth2/authorization/idp`

**Configuration (environment variables, all optional):**

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_HEARTBEAT_INTERVAL_MS` | `120000` (2 min) | Interval between heartbeat calls |
| `VITE_WARNING_BEFORE_EXPIRY_SECONDS` | `120` (2 min) | Show warning this many seconds before expiry |

**Key files:**
- `src/components/SessionHeartbeatProvider.tsx` — composition: auth check + heartbeat + modal
- `src/hooks/useSessionHeartbeat.ts` — core heartbeat + warning timer logic
- `src/hooks/useActivityTracking.ts` — window event-based activity detection
- `src/hooks/useCountdown.ts` — live countdown timer hook
- `src/components/InactivityWarningModal.tsx` — non-dismissable warning dialog with countdown and auto-redirect

## API Client Configuration

### Axios Configuration

```typescript
// All requests include session cookies
const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true, // Include session cookies
});

// No need to manually add Authorization header
// ext_authz validates the session and injects identity headers
```

### Error Handling

```typescript
// 401 Unauthorized → redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/oauth2/authorization/idp';
    }
    throw error;
  }
);
```

## Configuration Files

### Frontend (.env)

```bash
# API base URL - all API requests go here
VITE_API_BASE_URL=/api

# Access app via Istio Ingress Gateway in development
# https://app.budgetanalyzer.localhost
```

### Routing (Istio Ingress Gateway)

The Istio Ingress Gateway routes requests based on path:

- `/auth/*`, `/oauth2/*`, `/login/oauth2/*`, `/logout`, `/user` → Session Gateway (8081)
- `/api/*` → NGINX (8080), with ext_authz enforcement
- `/login`, `/*` → NGINX (8080), frontend (no auth required)

Session Gateway does **not** proxy API or frontend requests. It only handles auth lifecycle paths.

## User Info Structure

```typescript
interface User {
  sub: string;             // User ID (IdP subject)
  email: string;
  name?: string;
  picture?: string;        // Profile picture URL
  authenticated: boolean;
  roles: UserRole[];       // Resolved by permission-service (layout-level)
  permissions: string[];   // Resolved by permission-service (action-level)
}
```

`roles` drives layout decisions (which chrome surrounds the page).
`permissions` drives action-level UI gating (which buttons, forms, tiles, and
queries render).

## Frontend Permission Checks

The frontend follows the bulletproof-react split between **roles** (layout)
and **permissions** (actions). See the "Authorization: Roles vs Permissions"
section in `AGENTS.md` for the convention and the full table of gated sites.

### Gating tools

Three complementary layers, each with a single idiomatic tool:

1. **`AdminRoute`** (`src/features/admin/components/AdminRoute.tsx`) — role-based
   chrome guard. Decides whether the admin shell even loads. Layout-level only;
   never use it to gate a specific action.
2. **`<PermissionGuard permission="...">`**
   (`src/features/auth/components/PermissionGuard.tsx`) — route/subtree
   permission guard. Wrap a route `element` (omit `fallback` → redirects to
   `/unauthorized`) or an inline subtree (pass `fallback={null}` → hides the
   subtree). Because denied children never mount, their data hooks never fire —
   no wasted API calls, no `enabled` flag needed on the underlying query.
3. **`usePermission('<permission:string>')`**
   (`src/features/auth/hooks/usePermission.ts`) — inline affordance check. Use
   inside components that render a **single** boolean-gated button/row/nav item,
   or that build a nav list imperatively (e.g., `AdminLayout.tsx`).

**Rule of thumb:** `<PermissionGuard>` for *"should this page exist for me?"*,
`usePermission` for *"should this affordance render?"*. For multi-permission
gates or imperative checks, use `usePermission` directly.

**Helpers:**

- `hasPermission(user, permission)` —
  `src/features/auth/utils/permissions.ts`. Plain function for non-component
  code paths.
- `isAdmin(user.roles)` — `src/features/auth/utils/role.ts`. Used only by
  `AdminRoute`, `Layout`, and `LoginPage` for layout-level decisions. Never
  use it to gate an action.

### Permission taxonomy

Backend-owned (permission-service), mirrored in `src/mocks/handlers.ts`. Gating
sites use inline string literals; a typo fails safe by returning `false`.

| Resource | Read (self) | Read (cross-user) | Write | Delete |
|---|---|---|---|---|
| Transactions | `transactions:read` | `transactions:read:any` | `transactions:write` (+ `:any`) | `transactions:delete` (+ `:any`) |
| Currencies | `currencies:read` | — | `currencies:write` | — (rolled into `:write`) |
| Statement Formats | `statementformats:read` | — | `statementformats:write` | — (rolled into `:write`) |
| Users | `users:read` | — | `users:write` | — |

`:any` variants widen scope from "my own resources" to "across all users" and
gate the admin cross-user features (search page, dashboard tile, sidebar item).
User-facing self-scope features check the unscoped variants.

#### Permission hierarchy (invariant)

Permissions have an implied `:read` dependency: a grant of `:write` presumes
`:read` on the same resource, and a grant of `:delete` also presumes `:read`.
`:write` and `:delete` are independent of each other — neither implies the
other, and roles that hold one without the other (e.g. an auditor with
`transactions:delete` but no `transactions:write`) are legitimate and
supported (see `TransactionTable.test.tsx` for the locked-in combinations).
The dependency is enforced **at grant time** by the permission-service seed
data
(`permission-service/src/main/resources/db/migration/V2__seed_default_data.sql`) —
every role bundle that includes `:write` or `:delete` on a resource also
includes `:read` on that resource. There is no runtime expansion anywhere: neither the backend
(`@PreAuthorize("hasAuthority('…')")` is an exact-string match) nor the
frontend (`hasPermission` in `src/features/auth/utils/permissions.ts` is a
literal `Array.includes` check). The invariant is what makes those literal
checks correct, because invalid subsets (e.g. `:write` without `:read`) are
never issued.

This has two practical consequences:

1. **Route and component guards encode the minimum permission a site needs,
   not every permission it happens to touch.** The `/admin/currencies/:id`
   edit route requires only `currencies:write`, even though the page opens
   with a `GET` protected by `currencies:read`, because any user holding
   `:write` is guaranteed to also hold `:read`. Do not double-gate on
   `:read` + `:write` "defensively".
2. **Do not add runtime expansion.** No `hasEffectivePermission` helper, no
   "if write then read" branch in `hasPermission`. If a new resource needs a
   new permission, add the row to the seed migration above and grant `:read`
   alongside any `:write` or `:delete`. Drift is a grant-time bug, not a
   frontend bug.

Permissions are populated from the `/auth/v1/user` response and refreshed via
React Query — no separate cache.

### Rules-of-hooks trap

`usePermission` is a hook, so it cannot be called inside `.filter()` or other
callbacks. Two safe patterns:

- **`<PermissionGuard>`** — preferred when the check gates a whole subtree; the
  hook call lives inside the guard component.
- **Top-of-component `usePermission` + conditional spread** — use when building
  a nav list imperatively. See `AdminLayout.tsx` for the pattern.

For the migration plan and rationale, see
[docs/plans/permission-based-authorization-cleanup.md](plans/permission-based-authorization-cleanup.md).

## Production Deployment

### Environment Variables

```bash
# Production .env
VITE_API_BASE_URL=/api
```

### Build Process

```bash
# Build static files (served at /)
npm run build

# Build for production-smoke verification (served at /_prod-smoke/)
npm run build:prod-smoke

# Output: dist/ directory
# NGINX serves these files in production
```

The `build:prod-smoke` command produces a bundle whose assets and router basename
are set to `/_prod-smoke/`. This is used only by orchestration to verify
production CSP and browser security behavior on the real public origin — it is
not a separate application mode. Auth and API paths remain root-relative (`/api`,
`/oauth2/authorization/idp`, `/logout`) regardless of which build is used.

### Production Entry Point

Single entry point: Istio Ingress Gateway (port 443)
- All browser traffic enters through Istio Ingress
- Session Gateway and NGINX are internal services, not directly accessible

## Security Features

### Session Cookies

- **HttpOnly**: JavaScript cannot access cookies (XSS protection)
- **Secure**: HTTPS only (in production)
- **SameSite=Strict**: CSRF protection
- **15-minute timeout**: Sliding session expiration

### Token Management

- Session data stored server-side in Redis session hash (`session:{id}`)
- ext_authz reads session hashes directly from Redis for per-request validation
- Frontend heartbeat (`GET /auth/v1/session`) extends the Redis session TTL for active users
- No tokens in browser localStorage/sessionStorage
- No tokens in browser JavaScript

### Defense in Depth

1. **Session Gateway**: Manages auth lifecycle, prevents token exposure to browser
2. **ext_authz (Istio Ingress)**: Validates every API request via Redis session lookup, injects identity headers
3. **Backend Services**: Enforce data-level authorization using identity headers

### Instant Session Revocation

Delete the Redis session key → next request immediately fails at ext_authz. No token expiry window to wait out.

## Common Issues

### "Not authenticated" even after login

**Cause**: Accessing Vite dev server directly (http://localhost:3000)
**Solution**: Access via Istio Ingress Gateway (https://app.budgetanalyzer.localhost)

### CORS errors

**Cause**: Making requests to different origins
**Solution**: All requests should go to same origin (Istio Ingress Gateway, port 443)

### Session expires immediately

**Cause**: Cookies not being sent
**Solution**: Ensure `withCredentials: true` in axios config

## Testing Authentication

### Manual Testing

1. Navigate to `https://app.budgetanalyzer.localhost/login`
2. Click "Sign in"
3. Login with your credentials
4. Check browser DevTools → Application → Cookies
5. Should see `SESSION` cookie with HttpOnly flag
6. Navigate to `https://app.budgetanalyzer.localhost/admin`
7. Should see admin panel (if user has ADMIN role)

### Automated Testing

```typescript
// Mock authenticated user
vi.mock('@/features/admin/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      sub: 'test-user',
      email: 'test@example.com',
      authenticated: true,
      roles: ['ADMIN'],
      permissions: ['transactions:read:any', 'users:write'],
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));
```

## References

See the [orchestration repository](https://github.com/budgetanalyzer/orchestration) for:
- [Security Architecture](https://github.com/budgetanalyzer/orchestration/blob/main/docs/architecture/security-architecture.md)
- [Session-Based Edge Authorization Pattern](https://github.com/budgetanalyzer/orchestration/blob/main/docs/architecture/session-edge-authorization-pattern.md)
- [Port Reference](https://github.com/budgetanalyzer/orchestration/blob/main/docs/architecture/port-reference.md)
- Session Gateway Repository
