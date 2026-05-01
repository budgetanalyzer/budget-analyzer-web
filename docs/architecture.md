# Architecture

## State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| Server state | TanStack Query (React Query) | API data, caching, loading/error states |
| Client state | Redux Toolkit | Theme, UI preferences |

This separation keeps server concerns (caching, refetching, optimistic updates) out of the global store.

## Component Strategy

Using **Shadcn/UI** for components:
- Copy-paste components (no package dependency bloat)
- Full customization control
- Tailwind CSS integration
- Built-in accessibility (Radix primitives)

## CSP Compliance

The production build is served with a strict Content Security Policy (`style-src 'self'` — no `unsafe-inline`):

- **No inline `style={...}` props** — all styling uses Tailwind CSS classes
- **No runtime CSS injection** — libraries that call `document.createElement('style')` are banned
- **Custom toast system** — `sonner` was replaced with a Radix-based toast (`src/components/ui/Toast.tsx`) because sonner injects `<style>` elements
- **Column widths** use a static Tailwind class map (`src/utils/columnWidth.ts`) instead of inline style props

## Security Model

### Session-Based Authentication

Budget Analyzer uses a **Session Gateway** pattern for authentication:

- **No JWTs in the browser** — session cookies are HttpOnly, Secure, SameSite=Strict
- **Server-side session storage** — tokens stored in Redis, never exposed to JavaScript
- **Same-origin requests** — all traffic (auth, API, frontend) routes through a single gateway origin
- **Per-request validation** — every API request is validated via Redis session lookup before reaching backends
- **Instant revocation** — delete the Redis key and the session is immediately invalid

### How It Works (from the frontend's perspective)

1. User clicks login → browser redirects to `/oauth2/authorization/idp`
2. Session Gateway handles the OAuth2 flow server-side
3. On success, a session cookie is set and the browser is redirected back
4. All subsequent API calls include the cookie automatically
5. The gateway validates the session and injects identity headers (`X-User-Id`, `X-Roles`, `X-Permissions`) for backend services

### Session Lifecycle

- **15-minute sliding expiration** — extended by frontend heartbeat (`GET /auth/v1/session`)
- **Inactivity detection** — heartbeat only fires when user is active (mouse, keyboard, scroll, touch)
- **Expiry warning** — non-dismissable modal with countdown appears 2 minutes before expiry
- **Cross-tab sync** — session extension in one tab updates warning timers in all tabs via BroadcastChannel

### Security Properties

| Property | Mechanism |
|----------|-----------|
| XSS token theft | Impossible — no tokens in browser memory or storage |
| CSRF | SameSite=Strict cookies |
| Session fixation | New session ID on login |
| Stale sessions | 15-minute sliding expiry + instant Redis revocation |

## Permission Model

### Roles vs Permissions

Following the bulletproof-react pattern:

- **Roles** (e.g., `ADMIN`, `USER`) — drive **layout** decisions (which shell/chrome renders)
- **Permissions** (e.g., `transactions:read`) — drive **action** gating (which buttons/forms/queries render)

### Gating Tools

| Tool | Use Case |
|------|----------|
| `AdminRoute` | Role-based chrome guard — decides if admin shell loads |
| `<PermissionGuard permission="...">` | Route/subtree permission guard — denied children never mount |
| `usePermission('...')` | Inline hook for single boolean-gated affordances |
| `hasPermission(user, perm)` | Plain function for non-component code paths |

**Rule of thumb:** `<PermissionGuard>` for "should this page exist?", `usePermission` for "should this button render?"

### Permission Taxonomy

Backend-owned (permission-service), resolved at login and stored in session:

| Resource | Read (self) | Read (cross-user) | Write | Delete |
|---|---|---|---|---|
| Transactions | `transactions:read` | `transactions:read:any` | `transactions:write` (+ `:any`) | `transactions:delete` (+ `:any`) |
| Currencies | `currencies:read` | — | `currencies:write` | — |
| Statement Formats | `statementformats:read` | — | `statementformats:write` | — |
| Users | `users:read` | — | `users:write` | — |

`:any` variants widen scope from "my resources" to "all users" and gate admin cross-user features.

### Permission Hierarchy

Permissions have an implied dependency: `:write` presumes `:read`, `:delete` presumes `:read`. This is enforced **at grant time** by permission-service seed data — there is no runtime expansion. Practical consequences:

1. Guards encode the **minimum** permission needed (e.g., `currencies:write` alone gates the edit page because `:read` is guaranteed)
2. Do not double-gate "defensively" on `:read` + `:write`
3. Do not add runtime expansion helpers

## Integration Points

| Service | Role |
|---------|------|
| [Session Gateway](https://github.com/budgetanalyzer/session-gateway) | OAuth2 login, session management, Redis session storage |
| API Gateway (NGINX) | Request routing to backend services |
| Transaction Service | Transaction CRUD |
| Currency Service | Currencies and exchange rates |
| [Permission Service](https://github.com/budgetanalyzer/permission-service) | Role/permission resolution at login |

See the [orchestration repository](https://github.com/budgetanalyzer/orchestration) for full system architecture.
