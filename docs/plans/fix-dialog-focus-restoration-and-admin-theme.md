# Fix Dialog Focus Restoration and Admin Theme Scope

Resolve the two regressions introduced by the shared dialog overhaul. Dialogs
that are conditionally mounted already open must restore focus to the element
that launched them, including when a descendant uses autofocus. Portaled admin
dialogs must remain inside an admin-scoped portal host so they inherit the
violet `--primary` and `--ring` variables without giving up the shared portal's
opening-order, keyboard-ownership, body-lock, or strict-CSP behavior.

## Phase 1: Restore focus for dialogs mounted already open

### Workspace

.

### Goal

Extend the shared focus lifecycle so a newly mounted dialog with `open === true`
captures the previously focused trigger before any portaled descendant can
autofocus, then restores that trigger when the topmost dialog closes.

### Scope

Update `src/components/ui/Dialog.tsx` and its colocated tests. Add a regression
harness that opens a conditionally rendered dialog from a button, mounts the
dialog already open with an autofocus target, closes it, and verifies focus
returns to the connected trigger. Preserve the existing behavior for dialog
instances that remain mounted and transition from closed to open.

### Non-goals

Do not change initial-focus selection, Tab containment, dismissal behavior,
opening-order ownership, body scroll locking, dialog consumers, or portal
placement in this phase. Do not replace the owned dialog primitive or add a UI
dependency.

### Required context

- `AGENTS.md`
- `docs/development.md`, especially `#prerequisites`
- `docs/architecture.md`, especially the shared dialog and Content Security
  Policy contracts
- `docs/react-hooks-lifecycle-mental-model.md`
- `docs/testing-guide.md`, especially component-test policy
- `src/components/ui/Dialog.tsx`
- `src/components/ui/__tests__/Dialog.test.tsx`
- `src/features/views/pages/ViewPage.tsx`, as the representative
  conditionally mounted consumer

### Execution steps

1. Verify Node.js 20+, npm 10+, and the documented repository prerequisites
   before editing; stop and report an unmet prerequisite rather than adding a
   workaround.
2. Add a focused failing test whose trigger remains mounted while its dialog
   subtree is conditionally created with `open` already true. Include a
   descendant autofocus target, close through the shared control, and assert
   the trigger regains focus.
3. Give `DialogMountBoundary` an initial-open snapshot captured before the
   first commit, and deliver that snapshot from its mount lifecycle callback so
   React's descendant autofocus cannot replace the intended restoration target.
4. Retain `getSnapshotBeforeUpdate` for later `false` to `true` transitions of
   the same boundary, and ensure an initial capture is not replaced by a
   Strict Mode lifecycle replay.
5. Re-run the complete shared dialog test file to confirm autofocus, focus
   containment, overlapping-dialog ownership, connected-element restoration,
   dismissal, and body-lock behavior still pass together.

### Implementation notes

Capturing in a passive or layout effect is too late for the initial-mount case
because React may commit an `autoFocus` descendant first. Use a small helper for
the guarded `document.activeElement instanceof HTMLElement` check and store the
initial snapshot on the class boundary before commit. Keep subsequent-opening
capture in `getSnapshotBeforeUpdate`. Continue to restore only when the dialog
was topmost and the captured element is still connected. Do not add inline
styles, stylesheet generation, timers, or global listeners.

### Validation

Format only the changed shared dialog source and test with the repository
Prettier configuration, then run:

```bash
npx prettier --write \
  src/components/ui/Dialog.tsx \
  src/components/ui/__tests__/Dialog.test.tsx
npm run lint:fix
npx vitest run src/components/ui/__tests__/Dialog.test.tsx
npm run build
git diff --check
```

Inspect the final diff so formatting and lint fixing did not alter unrelated
user work.

### Completion criteria

The new conditional-mount regression test fails on the reviewed behavior and
passes after the fix, all existing shared dialog tests pass, the production
build succeeds, and focus restoration for already-open mounts retains the
topmost and connected-element safeguards.

## Phase 2: Keep admin dialogs inside the admin theme scope

### Workspace

.

### Goal

Route admin-owned dialog portals through a host beneath the `.admin` layout
scope so their controls inherit the admin CSS variables while unscoped dialogs
continue to portal to `document.body`.

### Scope

Add a shared portal-container context/provider to
`src/components/ui/Dialog.tsx`, register an admin portal host from
`src/features/admin/components/AdminLayout.tsx`, add shared and layout-level
regression coverage, and document the durable scoped-portal contract in
`docs/architecture.md`. Keep the portal itself so opening-order rendering and
keyboard ownership remain aligned.

### Non-goals

Do not add `.admin` to `document.body`, duplicate admin CSS variables on each
dialog, query the DOM by a hard-coded global ID, remove portals, restyle dialog
content, change individual admin dialog consumers, or alter standard-user and
session-warning theme behavior. Do not change Playwright configuration or add
an external dependency.

### Required context

- `AGENTS.md`
- `docs/development.md`, especially prerequisites and the production-smoke
  build gate
- `docs/architecture.md`, especially shared dialogs, application structure,
  and Content Security Policy
- `docs/react-hooks-lifecycle-mental-model.md`
- `docs/testing-guide.md`, especially component tests and the external browser
  harness
- The completed and passing Phase 1 implementation
- `src/components/ui/Dialog.tsx`
- `src/components/ui/__tests__/Dialog.test.tsx`
- `src/features/admin/components/AdminLayout.tsx`
- `src/features/admin/components/__tests__/AdminLayout.test.tsx`
- `src/features/admin/currencies/components/ConfirmDisableCurrencyDialog.tsx`
- `src/index.css`, especially the `.admin` and `.dark .admin` variables
- `src/components/SessionHeartbeatProvider.tsx`, to preserve the unscoped
  global-warning behavior

### Execution steps

1. Verify prerequisites and confirm Phase 1's focused tests and build are
   passing before changing portal placement.
2. Add a shared dialog portal-container context with an exported provider that
   accepts a stable host reference. Have `DialogContent` portal into the
   registered element when present and fall back to `document.body` otherwise.
3. In `AdminLayout`, create a stable host reference, wrap the layout with the
   provider, and render the host beneath the existing `.admin` root so portaled
   descendants inherit both light and dark admin custom properties.
4. Add a focused shared-component test for the provider and body fallback, and
   add an AdminLayout route harness that opens a real shared dialog after the
   layout host mounts. Assert structurally that the dialog is contained by the
   `.admin` scope rather than asserting a transient rendered color.
5. Re-run the existing opening-order and overlapping-dialog tests to verify the
   most recently opened dialog still owns keyboard interaction and renders in
   the expected portal order. Confirm the global session-warning path remains
   outside the admin provider and therefore retains its standard theme.
6. Update `docs/architecture.md` with the durable rule that layouts owning
   scoped CSS variables must register an in-scope dialog portal host, while
   ordinary dialogs use the body fallback.
7. Complete focused, full-build, production-smoke, and strict-CSP validation;
   inspect rather than allowlist any new bundle or browser finding.

### Implementation notes

Prefer a React context carrying a stable `RefObject<HTMLElement | null>` over a
global DOM lookup. The admin host must be a descendant of `.admin`, not a body
sibling, and should exist before user-triggered admin dialogs open. Keep the
portal overlay fixed and out of normal layout flow. The provider belongs in
the shared UI layer so `AdminLayout` may import it without reversing feature
boundaries; shared code must not import the admin feature. Preserve the
existing `createPortal`, open-dialog stack, reference-counted body lock, and
Tailwind-only styling.

### Validation

Format only the changed source, tests, and documentation with the repository
Prettier configuration as applicable, then run:

```bash
npx prettier --write \
  src/components/ui/Dialog.tsx \
  src/components/ui/__tests__/Dialog.test.tsx \
  src/features/admin/components/AdminLayout.tsx \
  src/features/admin/components/__tests__/AdminLayout.test.tsx \
  docs/architecture.md
npm run lint:fix
npx vitest run \
  src/components/ui/__tests__/Dialog.test.tsx \
  src/features/admin/components/__tests__/AdminLayout.test.tsx
npm run build
npm run build:prod-smoke
git diff --check
```

Verify every changed documentation link and referenced path. Because this is
an overlay and CSP-sensitive change, use the user-managed production-smoke
environment when it is available and, without starting Tilt or Vite, verify
the local CA and run:

```bash
check-budget-analyzer-local-ca-trust
npm run test:e2e:harness
npm run test:e2e:csp
```

If the workstation-owned environment, matching Chromium, or trusted CA is
unavailable, report the browser gate as unverified rather than weakening HTTPS
or starting the environment. Inspect the final diff for unrelated changes.

### Completion criteria

Admin dialogs portal beneath `.admin` and inherit its light/dark scoped custom
properties, unscoped dialogs retain the body fallback, focus and opening-order
contracts remain passing, architecture documentation records the host rule,
all locally available required gates pass, and any unavailable external browser
verification is reported explicitly.
