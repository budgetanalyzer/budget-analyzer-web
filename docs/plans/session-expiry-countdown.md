# Plan: Session Expiry Warning — 2-Minute Default + Countdown Timer

## Context

The session expiry warning modal currently appears 5 minutes before expiry and shows static text ("Your session will expire soon"). **There is no auto-redirect** — if the user ignores the modal, it stays open indefinitely even after the session has expired. We want to:
1. Reduce the warning window to **2 minutes** before expiry
2. Show a **live countdown timer** in the modal (e.g., "1:45")
3. **Auto-redirect to `/logout` when the countdown reaches 0** (fixes the stale modal bug)
4. Update all related documentation

---

## Changes

### 1. Change default from 5 minutes to 2 minutes

**`src/hooks/useSessionHeartbeat.ts:12`**
- Change `5 * 60` → `2 * 60`

**`src/hooks/__tests__/useSessionHeartbeat.test.ts`**
- No changes needed — all tests that care about the threshold explicitly pass `warningBeforeExpirySec: 300`, so they don't depend on the default.

### 2. Expose `expiresAt` from the heartbeat hook

**`src/hooks/useSessionHeartbeat.ts`**
- Add `expiresAt` state: `const [expiresAt, setExpiresAt] = useState<number | null>(null)`
- Set it in `scheduleWarning(expiresAt)` and reset to `null` when disabled
- Add to return: `{ showWarning, isSending, sendHeartbeat, expiresAt }`

**`src/hooks/__tests__/useSessionHeartbeat.test.ts`**
- Add test: verify `result.current.expiresAt` matches the value from the heartbeat response

### 3. Create `useCountdown` hook

**New file: `src/hooks/useCountdown.ts`** (~20 lines)
- Signature: `useCountdown(expiresAt: number | null, active: boolean): number`
- When `active && expiresAt != null`: runs a `setInterval(1000)` that recalculates `Math.max(0, expiresAt - Math.floor(Date.now() / 1000))` each tick
- Recalculates from `Date.now()` each tick (no drift, handles tab suspension correctly)
- Returns `0` when inactive or null

**New file: `src/hooks/__tests__/useCountdown.test.ts`**
- Returns correct seconds remaining
- Ticks down with fake timers
- `active: false` → returns 0, no interval
- Floors at 0 (never negative)
- Cleans up interval on unmount

### 4. Add countdown to the modal

**`src/components/InactivityWarningModal.tsx`**
- Add prop `expiresAt: number | null`
- Call `useCountdown(expiresAt, open)` to get `secondsLeft`
- Format as `M:SS` (e.g., `1:45`, `0:30`)
- Display: `"Your session will expire in {M:SS} due to inactivity. Click Continue to stay signed in."`
- Add `useEffect`: when `open && secondsLeft === 0`, set `window.location.href = '/logout'` — this is the key fix for the stale modal bug; currently nothing happens when the session actually expires

**`src/components/__tests__/InactivityWarningModal.test.tsx`**
- Add test: renders countdown when `expiresAt` is provided
- Add test: redirects to `/logout` when countdown reaches 0
- Update existing tests to pass `expiresAt={null}` (no countdown shown)

### 5. Thread `expiresAt` through the provider

**`src/components/SessionHeartbeatProvider.tsx`**
- Destructure `expiresAt` from `useSessionHeartbeat()`
- Pass to modal: `<InactivityWarningModal ... expiresAt={expiresAt} />`

**`src/components/__tests__/SessionHeartbeatProvider.test.tsx`**
- Update mock/assertions to account for the new `expiresAt` prop

### 6. Documentation

**`docs/authentication.md`**
- Line 117: Add mention of countdown timer and auto-redirect
- Line 141: Change "5 minutes" → "2 minutes"
- Line 151: Change `300 (5 min)` → `120 (2 min)` in env var table
- Line 157: Update `InactivityWarningModal` description to mention countdown

**`.env.example:17`**
- Change `300` → `120`, comment `5 minutes` → `2 minutes`

---

## File Summary

| File | Action |
|------|--------|
| `src/hooks/useSessionHeartbeat.ts` | Edit default, add `expiresAt` state + return |
| `src/hooks/useCountdown.ts` | **New** — countdown hook |
| `src/components/InactivityWarningModal.tsx` | Edit — add countdown display + auto-redirect |
| `src/components/SessionHeartbeatProvider.tsx` | Edit — pass `expiresAt` prop |
| `src/hooks/__tests__/useSessionHeartbeat.test.ts` | Edit — test `expiresAt` in return value |
| `src/hooks/__tests__/useCountdown.test.ts` | **New** — countdown hook tests |
| `src/components/__tests__/InactivityWarningModal.test.tsx` | Edit — countdown + redirect tests |
| `src/components/__tests__/SessionHeartbeatProvider.test.tsx` | Edit — account for new prop |
| `docs/authentication.md` | Edit — update times + document countdown |
| `.env.example` | Edit — update default comment |

---

## Verification

1. `npx vitest run` — all existing + new tests pass
2. Manual: log in, wait for session to approach expiry (or temporarily set `VITE_WARNING_BEFORE_EXPIRY_SECONDS` to a small value) → modal appears with countdown ticking → hits 0 → redirects to `/logout`
3. Manual: click "Continue" while countdown is running → modal closes, session extends
4. Multi-tab: open two tabs, verify countdown syncs when one tab extends the session
