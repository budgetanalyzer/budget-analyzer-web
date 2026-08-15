# Architecture

## State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| Server state | TanStack Query (React Query) | API data, caching, loading/error states |
| Route state | URL search params | Shareable filters, analytics source, drilldown return context |
| Client state | Redux Toolkit | Global preferences: theme, display currency, desktop admin sidebar |
| Local state | React component state | Table mechanics, draft inputs, modals, mobile overlays |

This separation keeps server concerns (caching, refetching, optimistic updates) out of the global store.
Redux intentionally does not store transaction filters, table sorting,
pagination, selected transaction IDs, navigation history, analytics source, or
saved-view selection. View detail also keeps transfer/refund review selection
and dialog state local. Raw active transactions and exchange rates remain
React Query server state and feed a deterministic client-side candidate
projection. The quadratic projection is derived on-demand only while the
review dialog is open and its discovery inputs are ready, so ordinary
saved-view navigation does not perform pair discovery. Candidates are not
cached as a separate server or browser state. Only IDs the user confirms for
exclusion become saved-view server state.

## Component Strategy

Using **Shadcn/UI** for components:
- Copy-paste components (no package dependency bloat)
- Full customization control
- Tailwind CSS integration
- Accessible primitives, either application-owned or selectively Radix-backed

### Browser Support

The supported browser floor is Chrome/Edge 125+, Firefox 147+, and Safari/iOS 26+. This floor is
required by shared dropdowns, which use the native Popover API and its implicit invoker anchor,
CSS `anchor()` positioning, and static block/inline position fallbacks. These browser-owned features
put menus in the top layer without portals, measured coordinates, inline styles, or runtime CSS.

## Page Responsibilities

Transactions, saved views, and analytics are separate task surfaces:

| Page | Responsibility |
|------|----------------|
| Transactions (`/`) | All-transaction management and filtering |
| Views (`/views`) | Saved-view directory and entry point to view detail or view-scoped analytics |
| View detail (`/views/:id`) | Saved-view membership management, including pinned and excluded rows, plus client-side transfer/refund review |
| Analytics (`/analytics`) | Spending analysis for either all transactions or one saved view |

Transaction filters are URL-backed so filtered lists remain refreshable and
shareable. The supported filter params are `q`, `dateFrom`, `dateTo`,
`bankName`, `accountId`, `type`, `minAmount`, and `maxAmount`. Table sorting,
pagination, row selection, and draft filter input text are local table state.
In the Transactions and saved-view detail tables, Amount sorting compares each
row's transaction-date USD equivalent, independent of the selected display
currency; amount cells still use the selected display currency. Changing any
sort column or direction returns these client-side tables to the first page.

Analytics source selection is explicit in the URL. Missing `scope` defaults to
all transactions; `scope=view&viewId=<id>` analyzes canonical saved-view
membership from `useViewTransactions`, not criteria-only local filtering.
View detail and saved-view cards link to analytics with an explicit
`scope=view&viewId=<id>` URL; they do not store selected analytics context.
Analytics drilldowns route back to the operational surface for the selected
source: `/` for all transactions and `/views/:id` for saved-view analytics.
Those drilldowns carry `dateFrom`, `dateTo`, `type`, `returnTo`, and
`breadcrumbLabel` URL parameters so the operational page is filtered to the
clicked analytics period and can return to the same analytics state.

View detail derives possible transfers and refunds from the complete raw active
transaction collection and transaction-date exchange rates. Canonical,
unfiltered saved-view membership gives each candidate side one of three roles:
a visible member is eligible for an exclusion control, an active transaction
outside the view criteria is supporting evidence labelled `Not currently in
this view`, and an explicitly excluded transaction is supporting evidence
labelled `Previously excluded from this view` and is never eligible for repeat
exclusion. Candidates using explicit exclusion evidence are presented as
completion work only when the possible counterpart remains visible. This allows
the visible side to be handled after partial review or incremental data arrival,
but the earlier exclusion remains membership state rather than proof or
provenance of a relationship. Temporary table filters affect only the displayed
table and stats. The review is a local UI projection until the user confirms
selected visible IDs through the existing bulk exclusion mutation, after which
normal query invalidation refreshes membership, counts, analytics, and the
existing restore path.

## CSP Compliance

The production build is served with a strict Content Security Policy (`style-src 'self'` — no `unsafe-inline`):

- **No inline `style={...}` props** — all styling uses Tailwind CSS classes
- **No runtime CSS injection** — libraries that call `document.createElement('style')` are banned
- **Custom toast system** — `sonner` was replaced with a Radix-based toast (`src/components/ui/Toast.tsx`) because sonner injects `<style>` elements
- **Column widths** use a static Tailwind class map (`src/utils/columnWidth.ts`) instead of inline style props
- **Body scroll locking** for dialogs and mobile overlays uses the shared, reference-counted
  `acquireBodyScrollLock()` utility. It toggles the statically emitted `overflow-hidden` class and
  never writes `document.body.style`, so overlapping locks remain correct without inline CSS.
- **Shared dropdowns** use native popovers for top-layer placement and statically emitted Tailwind
  anchor-positioning utilities, including `position-anchor: auto` to select each popover invoker as
  its implicit anchor. Programmatic opens pass the trigger as the Popover API `source` so the browser
  retains that invoker relationship. Runtime portals, measured coordinates, inline styles, and
  injected stylesheets are prohibited. The required browser floor is documented under Browser
  Support.

`npm run build:prod-smoke` automatically applies a dropdown-specific static gate to the emitted
bundle, production source, and package metadata. It detects the known Radix menu and
`react-remove-scroll` defect signatures; it is not a substitute for strict-CSP browser-console
validation.

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
The non-admin statement-format visibility page and profile menu entry use
`statementformats:read`. The page's hide/restore actions and the transaction
import `New format` button use `statementformats:write`; importing with an
existing visible format remains governed by transaction import permissions and
backend preview validation.

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
