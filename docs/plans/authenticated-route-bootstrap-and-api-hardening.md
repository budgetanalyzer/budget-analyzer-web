# Authenticated Route Bootstrap and API Hardening Plan

Make authentication a prerequisite for mounting every protected frontend route so an anonymous
visit to `/` performs one clean, same-origin-aware redirect into the Session Gateway OAuth2 flow
before `Layout`, `CurrencySelector`, transaction pages, or any of their React Query hooks can run.
Keep frontend documents publicly servable at the ingress and keep `/api/*` unauthorized responses
as HTTP 401 responses; the SPA remains responsible for browser navigation into OAuth2.

This plan also fixes the independent error-handling defects exposed by the startup race. API 401s
must initiate at most one hard login redirect while remaining rejected promises, authentication
service failures must remain distinguishable from a genuinely anonymous session, and documented
top-level collection responses must be checked at runtime before components can call array
methods. A malformed successful response must become a visible API contract error rather than an
empty state or a React error-boundary crash.

The required contracts are present at plan creation time: `docs/api/session-gateway-api.yaml`
defines `GET /auth/v1/user` as 200 for an authenticated user, 401 for no session, and 500/503 for
service failures; `docs/api/budget-analyzer-api.yaml` defines the affected list endpoints as
top-level arrays. No sibling-repository prerequisite or gateway configuration change is required.
Every phase writes only to this repository.

## Phase 1: Gate Protected Routes on Authentication Bootstrap

### Workspace

.

### Goal

Introduce one route-level authentication boundary around both the standard user and admin route
trees. Protected layouts and page components must not mount until `/auth/v1/user` has positively
identified the user, while anonymous users enter OAuth2 automatically and authentication-service
failures receive an in-app retry state.

### Scope

- Add a reusable authenticated route guard using React Router's pathless parent-route pattern.
- Preserve the requested local pathname, query string, and hash as the OAuth2 `returnUrl`.
- Use hard navigation with replacement for automatic login redirects and make it safe under React
  Strict Mode.
- Change `useAuth` so only an HTTP 401 means anonymous; expose non-401 bootstrap errors and a retry
  operation to route-level UI.
- Keep `/login`, OAuth completion/error pages, logout confirmation, and other explicitly public
  frontend routes outside the guard.
- Remove the now-unreachable anonymous/login affordance from the protected standard layout.

### Non-goals

- Protecting frontend HTML or static assets at Istio/NGINX, changing `ext_authz`, or returning 302
  responses from `/api/*`.
- Changing Auth0, Session Gateway callback, cookie, Redis, or role/permission behavior.
- Changing the heartbeat hook's established 401-to-`/logout` behavior; this plan covers initial
  auth bootstrap and API-client 401 handling.
- Adding a public marketing homepage or removing the explicit `/login` page.
- Starting API queries in a disabled state throughout individual feature components; the route
  boundary prevents those components from mounting in the first place.

### Required context

- Read `AGENTS.md`, especially the prerequisite, component, hook, testing, documentation, and
  strict CSP rules.
- Review `src/App.tsx`, `src/components/Layout.tsx`,
  `src/features/admin/components/AdminRoute.tsx`, `src/features/auth/hooks/useAuth.ts`,
  `src/features/auth/pages/LoginPage.tsx`, and `src/components/SessionHeartbeatProvider.tsx`.
- Confirm `docs/api/session-gateway-api.yaml` still distinguishes a sessionless 401 from 500/503.
  Stop and report a prerequisite mismatch if those semantics changed.
- Review all tests that mock `useAuth`; extending the hook result requires updating their typed
  fixtures without weakening types or adding partial casts.

### Execution steps

1. Add a small auth navigation utility that builds
   `/oauth2/authorization/idp?returnUrl=...`, accepts only same-origin absolute-path return values
   (a single leading `/`, never `//` or an external URL), and supports replace navigation for
   automatic redirects. Centralize the redirect-in-progress guard there so Strict Mode effects or
   concurrent callers cannot initiate the OAuth flow more than once; keep normal explicit login
   actions available through the same URL builder.
2. Update `useAuth` to return `null` only when `getCurrentUser` rejects with HTTP 401. Let network,
   timeout, 500, and 503 failures remain query errors, and expose the query error and refetch
   operation alongside `user`, `isLoading`, and `isAuthenticated`. Memoize the `login` and `logout`
   operations, route login through the shared navigation utility, and delete or replace the
   render-time-navigation `useRequireAuth` helper rather than leaving an unsafe unused guard.
3. Create `AuthenticatedRoute` under the auth feature. Always call hooks at the top level; while
   auth is pending render a CSP-safe full-page spinner/skeleton, on a non-401 auth error render a
   stable authentication-unavailable message with a memoized Retry callback, on an anonymous
   result trigger the replace redirect from a `useEffect` and continue showing the loading state,
   and render `<Outlet />` only for an authenticated user. Build the return URL from React Router's
   `pathname`, `search`, and `hash` so deep links survive login.
4. Restructure `App.tsx` so one pathless `AuthenticatedRoute` parent encloses the complete user and
   admin route trees, while `/login`, `/peace`, `/oops`, and `/unauthorized` remain outside it.
   Retain `AdminRoute` as the role/layout guard inside the authentication boundary. Simplify
   `Layout` so it no longer renders a transient anonymous Login button or owns login initiation;
   retain its authenticated admin-to-`/admin` redirect.
5. Add focused tests for `useAuth`, the navigation utility, `AuthenticatedRoute`, `App`, and the
   adjusted layout. Cover authenticated outlet rendering, pending auth, 401 automatic redirect,
   preservation and encoding of pathname/query/hash, unsafe return URL rejection, Strict Mode
   duplicate-effect suppression, retryable 500/503 and network failures, public `/login` access,
   and proof that protected child/layout components do not mount or start mocked data hooks before
   authentication succeeds. Update every typed `useAuth` mock for the expanded result contract.

### Implementation notes

- `useEffect` is appropriate for the hard browser navigation because it synchronizes React with
  the external `window.location` system. Do not navigate during render.
- Render a neutral loading state during the short anonymous-to-Auth0 transition. Do not briefly
  render the standard application chrome or an error banner.
- Use `window.location.replace(...)` for automatic redirects so Back does not return to a page
  that immediately redirects again. User-clicked login/logout behavior may retain intentional
  history semantics.
- Do not infer anonymous state from a missing `document.cookie`; `BA_SESSION` is HttpOnly.
- A non-401 `/auth/v1/user` failure is an availability problem, not evidence that the user should
  authenticate again. The retry state must not automatically send the browser to Auth0.
- Use existing UI primitives and Tailwind classes only. Add no dependency, tooltip, inline style,
  or runtime-injected CSS.

### Validation

Run the focused auth and routing tests, including any new colocated files:

```bash
npx vitest src/features/auth/hooks/__tests__/useAuth.test.tsx \
  src/features/auth/components/__tests__/AuthenticatedRoute.test.tsx \
  src/features/auth/utils/__tests__/loginRedirect.test.ts \
  src/features/admin/components/__tests__/AdminRoute.test.tsx \
  src/__tests__/App.test.tsx
```

Then type-check and bundle the coherent guarded route tree:

```bash
npm run build:bundle
```

### Completion criteria

- No protected layout, page, permission guard, currency selector, or feature data hook mounts while
  authentication is pending, anonymous, or unavailable.
- An anonymous visit to `/`, `/analytics`, a transaction detail, or `/admin` initiates exactly one
  replace navigation to the Session Gateway OAuth2 endpoint with a safe encoded return URL.
- Authenticated users reach the same role-appropriate routes and permissions as before.
- A 500/503, timeout, or network error from `/auth/v1/user` shows a retryable availability state
  and does not initiate OAuth2.
- Public auth and error routes remain reachable without satisfying the protected-route guard.
- Focused tests and `npm run build:bundle` pass.

## Phase 2: Reject and Coordinate API 401 Responses

### Workspace

.

### Goal

Make an expired or revoked session discovered by `/api/*` initiate one clean OAuth2 navigation
without ever converting the failed Axios request into successful `undefined` query data.

### Scope

- Correct the Axios response interceptor's 401 branch.
- Reuse the shared same-origin return URL and redirect coordination behavior from Phase 1.
- Normalize empty, structured JSON, and proxy-shaped 401 responses to rejected `ApiError` values.
- Preserve existing normalization for structured non-401, proxy HTML, network, and timeout errors.
- Add regression coverage for simultaneous unauthorized API calls.

### Non-goals

- Redirecting API responses at the ingress, NGINX, or `ext_authz` layer.
- Following OAuth2 within Axios/fetch or accepting login HTML as API data.
- Retrying unauthorized requests before login or replaying mutations after login.
- Clearing React Query or Redux globally before the full-page redirect; a successful OAuth2 round
  trip performs a new document load.
- Changing permission-denied HTTP 403 behavior or treating it as an authentication failure.

### Required context

- Confirm Phase 1 is complete and its focused tests plus `npm run build:bundle` pass.
- Review `src/api/client.ts`, `src/api/__tests__/client.test.ts`, the shared auth navigation utility,
  `src/types/apiError.ts`, and `docs/api-integration.md`.
- Preserve the contract that `ext_authz` returns 401 for an absent/expired session and 403 remains
  an authorization result.
- Review Axios interceptor promise semantics: every error handler branch must throw or return a
  rejected promise.

### Execution steps

1. Refactor the API-client response error handler so status 401 calls the shared automatic login
   redirect with the browser's current same-origin pathname, query, and hash, then throws a
   normalized `ApiError`. Never `return` without rejecting, even after navigation has begun.
2. Normalize a structured 401 body without discarding its safe API fields; normalize an empty,
   text, or HTML 401 body to an `UNAUTHORIZED` `ApiError` with a stable user-safe message. Keep 403
   and all existing non-401 normalization behavior unchanged.
3. Ensure redirect coordination is shared across the route guard and interceptor and remains
   idempotent for multiple concurrent API failures. Do not deduplicate the rejected promises:
   every caller must independently observe a rejection even though only one navigation occurs.
4. Expand `client.test.ts` to assert that empty and structured 401 responses reject as
   `ApiError`, exactly one replace redirect is requested for concurrent 401 calls, return URL
   components are preserved, and no 401 resolves with `undefined`. Retain the current structured
   422, proxy HTML 502, network failure, and prototype tests as regressions.
5. Run focused tests and inspect the interceptor for any fulfilled error path or direct duplicate
   OAuth URL construction outside the centralized auth navigation module.

### Implementation notes

- The browser will usually leave the document before React renders the query error, but preserving
  rejection semantics is mandatory. Navigation is a side effect, not a substitute for the Axios
  promise contract.
- Do not return a synthetic empty array or response from the interceptor. That would turn
  authentication failure into plausible application data.
- Coordination must cover React Strict Mode and parallel homepage/detail queries without relying
  on timers. A module-level in-document latch is acceptable because OAuth completion reloads the
  document; provide clean module/test isolation without exporting mutable production state unless
  necessary.
- Never include response bodies, session cookies, or financial data in redirect URLs or contract
  error messages.

### Validation

Run the API-client and redirect utility regression tests:

```bash
npx vitest src/api/__tests__/client.test.ts \
  src/features/auth/utils/__tests__/loginRedirect.test.ts
```

Then run the auth route test to prove the shared coordination behavior did not regress:

```bash
npx vitest src/features/auth/components/__tests__/AuthenticatedRoute.test.tsx
```

Inspect production code for swallowed 401s and scattered OAuth navigation:

```bash
rg -n "status === 401|oauth2/authorization/idp|window\.location\.(href|assign|replace)" src
```

### Completion criteria

- Every API 401 remains a rejected `ApiError`; none can fulfill a React Query query with
  `undefined` or another synthetic value.
- One automatic login navigation occurs per document even when several API requests receive 401
  concurrently.
- Automatic session-expiry navigation preserves a safe local return URL and uses replacement.
- HTTP 403 and non-authentication error behavior remains unchanged.
- Focused API-client, navigation, and authenticated-route tests pass.

## Phase 3: Enforce Collection Contracts and Document the Production Flow

### Workspace

.

### Goal

Prevent malformed successful list responses from reaching array operations, then validate and
document the complete production authentication and API-error behavior.

### Scope

- Add a reusable top-level array response assertion at the API adapter boundary.
- Apply it to documented array-returning list endpoints used across the authenticated SPA.
- Convert malformed HTTP 200 collection bodies into explicit retryable API contract errors.
- Add adapter tests proving objects, strings, `null`, and missing data never reach query consumers
  as successful arrays.
- Update authentication and API integration documentation and run the full repository quality,
  coverage, bundle, and CSP checks.

### Non-goals

- Adding a schema-validation dependency or deeply validating every field of every response item.
- Silently coercing malformed data to `[]`, unwrapping undocumented pagination envelopes, or
  changing the generated OpenAPI specifications to match an observed accidental response.
- Changing correctly documented paginated/object endpoints such as cross-user transaction search.
- Modifying backend services or gateway response bodies.
- Refactoring unrelated API adapters, components, or error presentation.

### Required context

- Confirm Phases 1 and 2 are complete and their focused validation passes.
- Re-read the current top-level response schemas in `docs/api/budget-analyzer-api.yaml` before
  applying the assertion. At minimum inspect currencies, exchange rates, current-user
  transactions, statement formats, and saved views. Stop rather than inventing an unwrap if any
  endpoint is now documented as an object or page.
- Review `src/api/currencyApi.ts`, `transactionApi.ts`, `statementFormatApi.ts`, `viewApi.ts`, their
  existing adapter tests, and every direct consumer that immediately uses array methods.
- Review `src/components/ErrorBanner.tsx` and use the existing `ApiError` contract so malformed
  data follows normal React Query error presentation.

### Execution steps

1. Add a generic API-boundary helper that accepts `unknown`, returns the typed value only when
   `Array.isArray` succeeds, and otherwise throws an `ApiError` describing an invalid upstream
   collection response. Use a stable 502/internal-contract classification and a resource-safe
   message; never stringify or expose the malformed payload.
2. Apply the helper to every currently documented top-level array list adapter: enabled/all
   currencies, exchange rates, current-user transactions, statement formats, and saved views.
   Preserve query keys, caching, request parameters, and valid response behavior. Do not add
   defensive `Array.isArray` branches or empty-array fallbacks in components.
3. Expand the relevant API adapter tests, plus a focused helper test if useful, to prove valid
   arrays pass through unchanged and representative malformed 200 bodies reject as `ApiError`.
   Include the original currency failure class explicitly and assert malformed bodies are not
   cached/rendered as successful empty lists.
4. Update `docs/authentication.md` with the protected-route bootstrap sequence, automatic safe
   return URL behavior, non-401 auth availability state, and API session-expiry redirect contract.
   Update `docs/api-integration.md` with the rejected-401 rule and runtime collection assertion.
   Keep ingress routing documentation explicit that frontend documents remain public and
   `/api/*` still returns 401 rather than OAuth redirects.
5. Run formatting where needed, always run `npm run lint:fix`, run the full coverage-gated build,
   run the production-smoke build, and inspect its output for prohibited runtime style/eval
   patterns. Resolve failures without disabling ESLint, weakening coverage thresholds, adding
   inline styles, or introducing unrelated formatting churn.

### Implementation notes

- TypeScript generics do not validate network data at runtime. The boundary helper must accept
  `unknown`; avoid a generic assertion whose input is already typed as `T[]`, because that would
  hide the trust boundary.
- An invalid HTTP 200 body is neither an empty collection nor an authentication result. Treat it
  as an upstream contract failure so the nearest existing error UI can offer retry/recovery.
- Top-level array validation directly prevents `currencies.map is not a function` and equivalent
  failures. Deep item validation can be considered separately if a concrete risk justifies the
  additional code or dependency.
- Documentation should describe durable ownership and behavior, not the transient component
  render sequence or this plan file.

### Validation

Run the affected API adapter and authentication tests first:

```bash
npx vitest src/api/__tests__/client.test.ts \
  src/api/__tests__/currencyApi.test.ts \
  src/api/__tests__/transactionApi.test.ts \
  src/api/__tests__/statementFormatApi.test.ts \
  src/api/__tests__/viewApi.test.ts \
  src/features/auth/hooks/__tests__/useAuth.test.tsx \
  src/features/auth/components/__tests__/AuthenticatedRoute.test.tsx \
  src/__tests__/App.test.tsx
```

Run repository-wide autofix and the coverage-gated production build:

```bash
npm run lint:fix
npm run build
```

Build the production-smoke variant and verify strict CSP output:

```bash
npm run build:prod-smoke
rg -n "createElement\('style'\)|styleSheet\.cssText|eval\(" dist/
```

The final `rg` command is expected to return no matches.

### Completion criteria

- Every protected route waits for successful authentication before mounting protected UI or data
  hooks, and auth service failures remain retryable without an OAuth loop.
- Initial anonymous access and later API session expiry both produce one safe, return-aware OAuth2
  navigation.
- API 401s always reject, and malformed successful collection bodies always throw `ApiError`
  before reaching `.map`, `.filter`, `.forEach`, `.slice`, or similar component logic.
- Valid collection responses and all existing application behavior remain unchanged.
- Authentication and API integration documentation accurately describe the production ownership
  split and failure behavior.
- Focused tests, `npm run lint:fix`, `npm run build`, `npm run build:prod-smoke`, and the CSP bundle
  scan all pass.
