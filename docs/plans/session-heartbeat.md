# Phase 7: Frontend Session Heartbeat — Implementation Plan

## Context

Session Gateway (phases 1-4) replaced Spring Session with a single Redis hash per session and added a `GET /auth/session` heartbeat endpoint. Without a frontend heartbeat, sessions silently expire after 30 minutes of API inactivity because ext_authz is read-only (doesn't extend TTL). The next API call gets a hard 401 redirect with no user feedback.

This phase adds:
- Periodic heartbeat calls to extend session TTL while the user is active
- An inactivity warning modal before session expiry
- Graceful handling of expired/revoked sessions

## Architecture

```
App.tsx
  <ErrorBoundary>
    <Routes> ... </Routes>
    <SessionHeartbeatProvider />      ← NEW (next to Toaster)
    │  reads useAuth().isAuthenticated
    │  if authenticated:
    │    useSessionHeartbeat(enabled)
    │    │  useActivityTracking()     ← window event listeners, ref-based
    │    │  setInterval(configurable) ← sends GET /auth/session if user was active
    │    │  setTimeout(dynamic)       ← shows warning based on expiresAt from server
    │    │  retry-once on network error
    │    <InactivityWarningModal />   ← non-dismissable Dialog
    <Toaster />
  </ErrorBoundary>
```

**Why outside Routes, not in Layout/AdminLayout**: Both layouts need the heartbeat. Placing it in each layout would create duplicate instances. Placing it outside Routes means it mounts once. The `useAuth().isAuthenticated` check gates activation — the heartbeat does nothing on login/peace/unauthorized pages.

**Why not in `main.tsx`**: The heartbeat needs `useAuth()` which depends on React Query context. Placing it in `main.tsx` would require restructuring providers. `App.tsx` is inside all providers already.

## Timing

- Session TTL: 30 minutes (server-controlled)
- Heartbeat interval: 5 minutes (configurable via `VITE_HEARTBEAT_INTERVAL_MS`)
- Warning threshold: 5 minutes before expiry (configurable via `VITE_WARNING_BEFORE_EXPIRY_SECONDS`)
- Timeline when user goes inactive:
  ```
  T=0    Last heartbeat succeeds, expiresInSeconds=1800
  T=5    Interval fires, user inactive → skip heartbeat
  T=10   Interval fires, user inactive → skip
  ...
  T=25   Warning timer fires → show modal (5 min before expiry)
  T=30   Session expires on server (Redis TTL)
  ```

## Implementation

### Step 1: Add session status type

**New file: `src/types/session.ts`**
```typescript
export interface SessionStatus {
  authenticated: boolean;
  userId: string;
  roles: string[];
  expiresAt: number;        // Unix epoch seconds
  tokenRefreshed: boolean;
}
```

Note: `expiresInSeconds` was removed from the server response. The frontend derives it: `expiresAt - Math.floor(Date.now() / 1000)`.

### Step 2: Add heartbeat API function

**Modify: `src/api/auth.ts`**

Add `getSessionStatus()` using the existing `authClient` (baseURL: `/`, withCredentials: true). This reuses the same axios instance that handles `GET /user`.

```typescript
import type { SessionStatus } from '@/types/session';

export async function getSessionStatus(): Promise<SessionStatus> {
  const response = await authClient.get<SessionStatus>('/auth/session');
  return response.data;
}
```

**Why `authClient`, not `apiClient`**: The `/auth/session` endpoint is routed to Session Gateway by Istio, not through the API gateway. Using `apiClient` (baseURL: `/api`) would hit the wrong path. Also, `apiClient` has a 401 interceptor that does a hard redirect — the heartbeat needs to handle 401 gracefully before redirecting.

### Step 3: Activity tracking hook

**New file: `src/hooks/useActivityTracking.ts`**

Tracks whether the user has interacted with the page since the last check.

- Listens to `mousemove`, `keydown`, `click`, `scroll`, `touchstart` on `window`
- All listeners are `{ passive: true }` (no `preventDefault`, no scroll-blocking)
- Sets a boolean ref on any event — no state, no re-renders
- Exposes `wasActiveSinceLastCheck()` which reads and resets the ref
- Cleanup removes all listeners on unmount

Implementation notes:
- `useEffect` is correct here — this is syncing with external browser event APIs
- `wasActiveSinceLastCheck` wrapped in `useCallback([], ...)` for stable reference
- No debouncing needed — setting a boolean ref is O(1) per event

### Step 4: Session heartbeat hook

**New file: `src/hooks/useSessionHeartbeat.ts`**

Core heartbeat logic. Returns `{ showWarning, isSending, sendHeartbeat }`.

**Interface**:
```typescript
interface UseSessionHeartbeatOptions {
  enabled: boolean;
  heartbeatIntervalMs?: number;        // default: VITE_HEARTBEAT_INTERVAL_MS or 300000 (5 min)
  warningBeforeExpirySec?: number;      // default: VITE_WARNING_BEFORE_EXPIRY_SECONDS or 300 (5 min)
}
```

**Defaults from environment variables** (module-level):
```typescript
const DEFAULT_HEARTBEAT_INTERVAL_MS =
  Number(import.meta.env.VITE_HEARTBEAT_INTERVAL_MS) || 5 * 60 * 1000;
const DEFAULT_WARNING_BEFORE_EXPIRY_S =
  Number(import.meta.env.VITE_WARNING_BEFORE_EXPIRY_SECONDS) || 5 * 60;
```

Options override env vars, which override hard-coded defaults. This gives three levels of configurability:
1. `.env` / `.env.local` — deployment-time config
2. Hook options — per-usage override (useful for tests)
3. Hard-coded defaults — sensible fallback

**State**:
- `showWarning: boolean` — controls modal visibility (useState)
- `isSending: boolean` — disables "Continue" button during heartbeat (useState)
- `warningTimerRef` — timeout ID for the warning timer (useRef)
- `intervalRef` — interval ID for the heartbeat (useRef)

**`performHeartbeat` (useCallback)**:
1. Set `isSending = true`
2. Call `getSessionStatus()`
3. On success:
   - Set `showWarning = false`
   - Derive remaining time: `const expiresInSeconds = status.expiresAt - Math.floor(Date.now() / 1000)`
   - Clear existing warning timer
   - Calculate warning delay: `Math.max(0, expiresInSeconds - warningBeforeExpirySec) * 1000`
   - If delay is 0, show warning immediately (session already near expiry)
   - Otherwise set warning timer via `setTimeout`
   - Set `isSending = false`
4. On 401 error (from response status):
   - Redirect to `/oauth2/authorization/idp`
5. On network error (no response):
   - Retry once by calling `getSessionStatus()` again
   - If retry succeeds: handle as success (step 3)
   - If retry returns 401: redirect to login
   - If retry fails with network error: `toast.warning(...)`, keep warning visible if shown, set `isSending = false`

**`useEffect` (when enabled)**:
1. Fire initial heartbeat immediately (to get `expiresInSeconds` for warning timer)
2. Start 5-min interval: on each tick, call `wasActiveSinceLastCheck()`. If active, call `performHeartbeat()`. If inactive, skip.
3. Cleanup: clear interval + clear warning timer

**Return**: `{ showWarning, isSending, sendHeartbeat: performHeartbeat }`

**Why not React Query**: The heartbeat is a side-effectful interval, not a data-fetching concern. We don't want caching, stale time, or refetch-on-focus behavior. Timer-based side effects with direct API calls are the right tool.

### Step 5: Inactivity warning modal

**New file: `src/components/InactivityWarningModal.tsx`**

Uses the existing `Dialog` component system. Props:
```typescript
interface InactivityWarningModalProps {
  open: boolean;
  isSending: boolean;
  onContinue: () => void;
}
```

Renders:
- `Dialog` with controlled `open` and no-op `onOpenChange={() => {}}` (non-dismissable)
- `DialogContent` with `showClose={false}` (no X button)
- `DialogHeader` + `DialogTitle`: "Session Expiring"
- `DialogDescription`: "Your session will expire soon due to inactivity. Click Continue to stay signed in."
- `DialogFooter` with a `Button` ("Continue") that calls `onContinue`, disabled when `isSending`

**Non-dismissable behavior**: With controlled `open` and a no-op `onOpenChange`, pressing Escape or clicking the backdrop calls `setOpen(false)` → `onOpenChange(false)` → no-op. The `open` prop doesn't change, so the dialog stays open. No modification to `Dialog.tsx` needed.

### Step 6: Session heartbeat provider

**New file: `src/components/SessionHeartbeatProvider.tsx`**

Wires the heartbeat hook to the auth state and renders the modal.

```typescript
export function SessionHeartbeatProvider() {
  const { isAuthenticated } = useAuth();
  const { showWarning, isSending, sendHeartbeat } = useSessionHeartbeat({
    enabled: isAuthenticated,
  });

  return (
    <InactivityWarningModal
      open={showWarning}
      isSending={isSending}
      onContinue={sendHeartbeat}
    />
  );
}
```

This component is intentionally thin — it's a composition point, not a logic container.

### Step 7: Wire into App.tsx

**Modify: `src/App.tsx`**

Add `<SessionHeartbeatProvider />` after `<Routes>`, next to `<Toaster />`:

```tsx
import { SessionHeartbeatProvider } from '@/components/SessionHeartbeatProvider';

function App() {
  return (
    <ErrorBoundary>
      <Routes>...</Routes>
      <SessionHeartbeatProvider />
      <Toaster />
    </ErrorBoundary>
  );
}
```

### Step 8: Add MSW handler

**Modify: `src/mocks/handlers.ts`**

Add handler for `GET /auth/session`:

```typescript
http.get('/auth/session', () => {
  return HttpResponse.json({
    authenticated: true,
    userId: 'mock-user-id',
    roles: ['ADMIN'],
    expiresAt: Math.floor(Date.now() / 1000) + 1800,
    tokenRefreshed: false,
  });
}),
```

### Step 9: Tests

**New file: `src/hooks/__tests__/useActivityTracking.test.ts`**

Test cases:
- Returns false when no user activity has occurred
- Returns true after mouse, keyboard, click, scroll, touch events
- Resets to false after `wasActiveSinceLastCheck()` is called
- Cleans up event listeners on unmount

Use `renderHook` from `@testing-library/react` and `fireEvent` to simulate DOM events.

**New file: `src/hooks/__tests__/useSessionHeartbeat.test.ts`**

Test cases:
- Does nothing when `enabled: false`
- Fires initial heartbeat on mount when enabled
- Fires heartbeat on interval when user is active
- Skips heartbeat on interval when user is inactive
- Sets warning timer based on `expiresInSeconds` from response
- Derives expiresInSeconds from `expiresAt - now` and sets warning timer
- Shows warning immediately when derived remaining time <= warning threshold
- Redirects to login on 401 response
- Retries once on network error, then shows toast warning
- `sendHeartbeat` hides warning on success
- Cleans up timers on unmount

Mock `useActivityTracking` and `getSessionStatus`. Use `vi.useFakeTimers()` for timer control.

**New file: `src/components/__tests__/InactivityWarningModal.test.tsx`**

Test cases:
- Does not render when `open: false`
- Renders modal content when `open: true`
- Calls `onContinue` when Continue button clicked
- Continue button is disabled when `isSending: true`
- Modal is not dismissable via Escape key
- Modal is not dismissable via backdrop click

**New file: `src/components/__tests__/SessionHeartbeatProvider.test.tsx`**

Test cases:
- Does not activate heartbeat when user is not authenticated
- Activates heartbeat when user is authenticated
- Renders InactivityWarningModal

Mock `useAuth` and `useSessionHeartbeat`.

### Step 10: Update documentation

**Modify: `docs/authentication.md`**

The "Session Heartbeat" section already exists (lines 109-134). After implementation, update it to:
- Remove `expiresInSeconds` from the response contract (derived client-side from `expiresAt`)
- Reference `useSessionHeartbeat` hook and `SessionHeartbeatProvider` component
- Document inactivity warning behavior
- Document configurable env vars (`VITE_HEARTBEAT_INTERVAL_MS`, `VITE_WARNING_BEFORE_EXPIRY_SECONDS`)

Also update `.env.example` with the new optional variables:
```bash
# Session heartbeat (optional, defaults shown)
VITE_HEARTBEAT_INTERVAL_MS=300000         # 5 minutes
VITE_WARNING_BEFORE_EXPIRY_SECONDS=300    # 5 minutes before expiry
```

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/types/session.ts` | SessionStatus response type |
| Modify | `src/api/auth.ts` | Add `getSessionStatus()` |
| Create | `src/hooks/useActivityTracking.ts` | Window activity detection |
| Create | `src/hooks/useSessionHeartbeat.ts` | Core heartbeat + warning logic |
| Create | `src/components/InactivityWarningModal.tsx` | Non-dismissable warning dialog |
| Create | `src/components/SessionHeartbeatProvider.tsx` | Composition: auth check + heartbeat + modal |
| Modify | `src/App.tsx` | Add `<SessionHeartbeatProvider />` |
| Modify | `src/mocks/handlers.ts` | Add MSW handler for `/auth/session` |
| Modify | `.env.example` | Add optional heartbeat config vars |
| Create | `src/hooks/__tests__/useActivityTracking.test.ts` | Activity tracking tests |
| Create | `src/hooks/__tests__/useSessionHeartbeat.test.ts` | Heartbeat logic tests |
| Create | `src/components/__tests__/InactivityWarningModal.test.tsx` | Modal tests |
| Create | `src/components/__tests__/SessionHeartbeatProvider.test.tsx` | Provider tests |
| Modify | `docs/authentication.md` | Update heartbeat section |

## Verification

```bash
# 1. Run all tests
npm test

# 2. Lint and format
npm run lint:fix && npm run format

# 3. Type check + build
npm run build

# 4. CSP verification
npm run build:prod-smoke && rg "createElement\('style'\)" dist/

# 5. Manual verification (requires running infrastructure)
# - Login at https://app.budgetanalyzer.localhost
# - Open browser DevTools Network tab
# - Verify GET /auth/session fires every 5 min while active
# - Stop interacting for 25+ min → warning modal appears
# - Click "Continue" → modal closes, heartbeat fires
# - Verify session does NOT expire while actively using the app
```

## Implementation Order

1. `src/types/session.ts` (no dependencies)
2. `src/api/auth.ts` modification (depends on types)
3. `src/hooks/useActivityTracking.ts` (no dependencies)
4. `src/hooks/useSessionHeartbeat.ts` (depends on 2, 3)
5. `src/components/InactivityWarningModal.tsx` (no dependencies)
6. `src/components/SessionHeartbeatProvider.tsx` (depends on 4, 5)
7. `src/App.tsx` modification (depends on 6)
8. `src/mocks/handlers.ts` modification (independent)
9. Tests (depends on all above)
10. `docs/authentication.md` update (after everything works)
