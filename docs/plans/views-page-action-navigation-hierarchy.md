# Views Page Action and Navigation Hierarchy Plan

Rework the saved-view index and detail surfaces so that each control has a clear
role: the global navigation remains destination-oriented, the saved-view detail
has one primary action, contextual navigation looks like navigation, infrequent
view-object operations live in a labeled menu, and transaction cleanup lives
beside the transaction table it affects. Preserve the existing clone API,
analytics URL state, permission taxonomy, and transaction-membership behavior.

The implementation is governed by these decisions:

- Global `Analytics` remains a stable `/analytics` destination and does not
  infer a saved-view source from the route being left.
- Saved-view links use explicit URL state to open that view in Analytics.
- `Add transactions` remains the only primary saved-view-detail action.
- Rename, duplicate, and delete are grouped under a visible `View actions`
  menu; delete remains last and visually separated.
- `Review possible transfers and refunds` stays visible but moves to the
  transaction-table region because it reviews and may remove view membership.
- Page-to-page navigation is rendered as links, while controls that open menus
  or dialogs remain buttons.
- New and changed labels use sentence case and lead with a clear action where
  applicable.

These decisions apply the guidance in the
[USWDS button component](https://designsystem.digital.gov/components/button/),
[GOV.UK button component](https://design-system.service.gov.uk/components/button/),
[Nielsen Norman Group progressive disclosure guidance](https://www.nngroup.com/articles/progressive-disclosure/),
[Nielsen Norman Group icon guidance](https://www.nngroup.com/articles/icon-usability/),
[IBM Carbon overflow-menu guidance](https://carbondesignsystem.com/components/overflow-menu/usage/),
and the [WAI-ARIA button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/).

## Phase 1: Consolidate saved-view object actions

### Workspace

.

### Goal

Replace the icon-only saved-view settings menu and standalone clone button with
one permission-aware, visibly labeled object-actions menu that opens the
existing rename, duplicate, and delete workflows.

### Scope

- `src/features/views/pages/ViewPage.tsx`
- `src/features/views/components/ViewSettingsMenu.tsx`, renamed to
  `src/features/views/components/ViewActionsMenu.tsx`
- `src/features/views/components/__tests__/ViewSettingsMenu.test.tsx`, renamed
  to `src/features/views/components/__tests__/ViewActionsMenu.test.tsx`
- `src/features/views/pages/__tests__/ViewPage.test.tsx`
- Existing shared `CreateViewModal` clone mode, consumed directly by the view
  page without changing its API contract

### Non-goals

- Do not change the backend clone endpoint, request payload, React Query
  mutation, invalidation behavior, or stale-membership error handling.
- Do not remove or redesign `SaveAsViewButton`; the Transactions page still
  uses it to create saved views from a transaction selection.
- Do not move the transfer/refund workflow or change Analytics/card navigation
  in this phase.
- Do not add a dependency, tooltip, toast, runtime stylesheet, or React `style`
  prop.

### Required context

- Root `AGENTS.md`, especially authorization, hooks, CSP, working, and
  validation rules
- `docs/development.md#prerequisites`
- `docs/architecture.md`, especially shared dropdown and strict CSP contracts
- `docs/authentication.md#roles-and-permissions`
- `docs/react-hooks-lifecycle-mental-model.md`
- `docs/testing-guide.md`
- `src/components/CreateViewModal.tsx`
- `src/components/ui/DropdownMenu.tsx`
- Current saved-view detail/menu implementations and their colocated tests

### Execution steps

1. Recheck the development prerequisites, inspect the current worktree, and
   reread the required context before editing. Stop and report an unsatisfied
   prerequisite or an overlapping user change rather than adding a workaround
   or overwriting it.
2. Replace `ViewSettingsMenu` with `ViewActionsMenu`. Give the trigger visible
   text `View actions` plus an appropriate menu indicator, use the shared
   `DropdownMenu` primitives, and expose stable callbacks for duplicate,
   rename, and delete. Call `usePermission` only at the component top level;
   `views:write` gates both duplicate and rename, while `views:delete`
   independently gates delete. Close the menu before invoking a selected
   callback. Order the menu as `Rename view`, `Duplicate view`, then a separator
   and destructive `Delete view`; omit the trigger entirely when no action is
   authorized.
3. Refactor `ViewPage` to remove its `SaveAsViewButton` clone trigger, add local
   duplicate-dialog state and memoized open/close handlers, and render
   `CreateViewModal` in clone mode with `sourceViewId={view.id}` and the title
   `Duplicate view`. Keep rename and delete modal ownership on the page. Use one
   top-level `views:write` permission result for page-owned write affordances
   and dialog mounting, without weakening the menu's own permission gating.
4. Replace the old settings-menu tests with behavior-focused
   `ViewActionsMenu` tests covering the visible trigger, callback dispatch and
   close/reopen behavior, write-only actions, delete-only access, separator and
   destructive ordering, and complete denial. Update `ViewPage` tests to drive
   the labeled menu with `user-event`, open the duplicate dialog, prove the
   source view ID—not filtered transaction IDs—is submitted even with active
   filters, preserve duplicate availability while amount conversion is
   unresolved, and retain independent write/delete permission behavior.
5. Format only the changed files with the repository Prettier configuration,
   run `npm run lint:fix`, and run the focused menu and view-page Vitest files.
   Resolve all failures before completing the phase.

### Implementation notes

- Treat `Duplicate view` as product language only. Internal clone types,
  endpoint names, hook names, error codes, and messages remain clone-oriented
  because they describe the established transport contract.
- User-driven menu and dialog transitions belong in `useCallback` event
  handlers; do not add an effect.
- Render `CreateViewModal` only while the authorized duplicate workflow is
  open, consistent with the existing permission-gated rename/delete dialogs.
- Keep functions passed to `ViewActionsMenu` stable, and do not define
  multi-line or inline callbacks in JSX props.
- Use the existing CSP-safe native-popover dropdown implementation. Do not
  reintroduce Radix dropdowns, portals, measured positioning, or runtime CSS.

### Validation

```bash
npx prettier --write \
  src/features/views/pages/ViewPage.tsx \
  src/features/views/components/ViewActionsMenu.tsx \
  src/features/views/components/__tests__/ViewActionsMenu.test.tsx \
  src/features/views/pages/__tests__/ViewPage.test.tsx
npm run lint:fix
npx vitest run \
  src/features/views/components/__tests__/ViewActionsMenu.test.tsx \
  src/features/views/pages/__tests__/ViewPage.test.tsx
git diff --check
```

### Completion criteria

- The saved-view detail has no standalone clone button or icon-only settings
  trigger.
- Authorized users can reach rename, duplicate, and delete through the visible
  `View actions` menu, with exact existing permissions preserved.
- Duplicate still copies the complete source saved view regardless of active
  transaction or amount filters.
- Focused tests, lint fixing, formatting, and whitespace validation pass, and
  the worktree is a coherent checkpoint for the next phase.

## Phase 2: Align contextual actions and navigation

### Workspace

.

### Goal

Make the saved-view detail and index reflect the agreed hierarchy: transaction
cleanup is contextual to the table, Analytics is explicit navigation, and card
links name their destinations clearly.

### Scope

- `src/features/views/pages/ViewPage.tsx`
- `src/features/views/components/ViewTransactionTable.tsx`
- `src/features/views/components/ViewCard.tsx`
- `src/features/views/pages/__tests__/ViewPage.test.tsx`
- `src/features/views/components/__tests__/ViewTransactionTable.test.tsx`
- `src/features/views/components/__tests__/ViewCard.test.tsx`
- `src/features/views/pages/__tests__/ViewsPage.test.tsx`

### Non-goals

- Do not make the global `Analytics` navigation link route-aware, persist an
  application-wide selected view, or move analytics source state into Redux or
  localStorage.
- Do not change analytics parsing/defaults, view-mode or transaction-type
  defaults, or `buildAnalyticsReturnUrl`.
- Do not place transfer/refund review in `View actions`, change its candidate
  algorithm, eagerly calculate candidates, or change its membership mutation.
- Do not make an entire saved-view card clickable while it contains multiple
  navigation targets.
- Do not add a generic `Create view` action to the Saved Views index; creation
  continues to originate from selected/filtered Transactions context.

### Required context

- The completed Phase 1 checkpoint
- Root `AGENTS.md`
- `docs/architecture.md`
- `docs/authentication.md#roles-and-permissions`
- `docs/state-architecture.md#analytics-controls-and-source`
- `docs/react-hooks-lifecycle-mental-model.md`
- `docs/testing-guide.md`
- `src/features/analytics/utils/urlState.ts`
- `src/features/analytics/components/AnalyticsSourceSelector.tsx`
- Current view table, card, page, and tests listed in Scope

### Execution steps

1. Add a semantic transaction-table heading region to
   `ViewTransactionTable` and accept a stable optional review callback from the
   page. When supplied, render a visible secondary button labeled
   `Review possible transfers and refunds` beside the `Transactions` heading,
   before the filter bar. Keep the existing dialog, candidate derivation,
   retry, exchange-rate, and membership-mutation ownership in `ViewPage`; pass
   the callback only when `views:write` is authorized.
2. Simplify the saved-view-detail header to one primary `Add transactions`
   control, the labeled `View actions` menu, and a text-style React Router link
   labeled `Open in Analytics`. Preserve the explicit
   `scope=view&viewId=<id>` Analytics URL and the existing monthly/debit
   defaults, but do not give the navigation link outline-button styling.
3. Update `ViewCard` link language to `Open in Analytics` and `Open view`, with
   accessible names that include the saved-view name and with the existing
   explicit view-scoped Analytics URL preserved. Keep both as links, keep the
   card itself non-interactive, retain the static metadata, and remove wording
   that presents the saved-view page as merely a details page.
4. Update colocated tests to assert the product behavior: the transfer/refund
   control is inside the accessible `Transactions` region, invokes the supplied
   page callback, and remains absent without write permission; the review
   dialog still uses nonmembers only as evidence; the saved-view detail exposes
   exactly one primary action plus an explicit view-scoped Analytics link; and
   Saved Views cards expose correctly named view and Analytics links with exact
   destinations. Prefer role/label assertions and `user-event`, not Tailwind
   class snapshots.
5. Format only the changed application/test files, run `npm run lint:fix`, run
   the focused saved-view page/table/card/index tests, and resolve every failure
   before completing the phase.

### Implementation notes

- Moving the review trigger must not move its expensive candidate calculation;
  `ViewPage` should continue deriving candidates only while the review dialog
  is open.
- The optional table callback is the rendering boundary for the review
  affordance. The page remains responsible for permission gating because it
  owns the dialog and supporting data; the table's existing `views:write`
  permission check continues to own row and bulk membership removal.
- Use a real heading and labeled region so the cleanup action is structurally
  associated with the transactions it affects. Allow the heading/action row to
  wrap on narrow viewports with static Tailwind classes.
- `Open in Analytics` is intentionally redundant with the global destination
  only as a contextual deep link: it preselects the current saved view. The
  global nav continues to mean “open the Analytics workspace” and defaults to
  all transactions when no source appears in the URL.
- Preserve the `Views` split-navigation control. Its dropdown is a shortcut to
  views that remain available through the index, not the sole route to them.

### Validation

```bash
npx prettier --write \
  src/features/views/pages/ViewPage.tsx \
  src/features/views/components/ViewTransactionTable.tsx \
  src/features/views/components/ViewCard.tsx \
  src/features/views/pages/__tests__/ViewPage.test.tsx \
  src/features/views/components/__tests__/ViewTransactionTable.test.tsx \
  src/features/views/components/__tests__/ViewCard.test.tsx \
  src/features/views/pages/__tests__/ViewsPage.test.tsx
npm run lint:fix
npx vitest run \
  src/features/views/pages/__tests__/ViewPage.test.tsx \
  src/features/views/components/__tests__/ViewTransactionTable.test.tsx \
  src/features/views/components/__tests__/ViewCard.test.tsx \
  src/features/views/pages/__tests__/ViewsPage.test.tsx
git diff --check
```

### Completion criteria

- `Add transactions` is the only primary saved-view-detail action.
- Transfer/refund review is visible and contextually attached to the
  transaction table without changing its underlying workflow or permissions.
- Detail and index Analytics links clearly navigate to Analytics with the
  relevant saved view selected, while global Analytics behavior remains
  unchanged.
- Saved-view cards use `Open view` instead of `View Details` and remain valid
  multi-link cards rather than ambiguous whole-card targets.
- All focused tests and phase validation commands pass.

## Phase 3: Record the contract and complete CSP-sensitive validation

### Workspace

.

### Goal

Document the durable navigation/action hierarchy, add production-browser
coverage for the changed dropdown workflow, and run the complete application,
E2E type, bundle, coverage, and CSP gates required for handoff.

### Scope

- `docs/architecture.md`
- `docs/README.md`
- Root `AGENTS.md`
- `docs/testing-guide.md`
- `e2e/fixtures/data.ts`
- `e2e/fixtures/scenarios.ts`
- A new `e2e/csp/view-actions.spec.ts`
- Final validation of all production and test changes from Phases 1 and 2

### Non-goals

- Do not copy a component walkthrough or ephemeral plan details into durable
  documentation.
- Do not link this plan from `AGENTS.md`, `README.md`, or another non-plan file.
- Do not remove or weaken the temporary dropdown static gate; one saved-view
  workflow is not equivalent desktop/mobile, cross-browser, placement, or
  viewport-fallback coverage.
- Do not start Tilt, Vite, NGINX, or another development server. The external
  browser environment remains user-managed.
- Do not change Playwright configuration or broaden browser/API mocks beyond
  the exact saved-view scenario required by the new test.

### Required context

- The completed Phase 2 checkpoint
- Root `AGENTS.md`
- `../orchestration/docs/agents-md-checkstyle.md`
- `docs/README.md`
- `docs/architecture.md`
- `docs/development.md#production-smoke-build-and-dropdown-gate`
- `docs/testing-guide.md#external-browser-harness`
- `docs/state-architecture.md#analytics-controls-and-source`
- Existing `e2e/fixtures/` and `e2e/csp/` patterns
- Generated saved-view API schemas in `docs/api/budget-analyzer-api.yaml`

### Execution steps

1. Add a concise `Navigation and action hierarchy` contract to
   `docs/architecture.md`: global navigation has stable destinations;
   contextual links may carry explicit URL state; one primary action is
   visually distinguished; page navigation uses links; frequent/domain actions
   remain visible near their affected content; rare object operations use a
   visibly labeled menu; destructive items are last and separated; and changed
   labels use sentence case with clear verbs. Cite the established external UX
   sources where they help preserve rationale without duplicating them.
2. Update the Architecture concern in `docs/README.md` and the authoritative
   documentation table/consultation trigger in `AGENTS.md` so future
   navigation, action-hierarchy, menu, and overlay work reads the Architecture
   owner first. Follow the AGENTS.md checkstyle, preserve every existing unique
   rule, and avoid duplicating the full architecture contract into agent
   instructions.
3. Add deterministic saved-view fixture/scenario helpers for the exact list,
   metadata, membership, transaction snapshot, and currency requests made by a
   saved-view detail route. Add `e2e/csp/view-actions.spec.ts` using a user with
   `views:read`, `views:write`, and `views:delete`; open the production-smoke
   saved-view route, activate the visible `View actions` trigger, verify the
   ordered rename/duplicate/delete items, open and dismiss `Duplicate view`,
   verify focus restoration and no unexpected protected requests, and assert
   no CSP violations, runtime-added stylesheets, or final style elements.
4. Update `docs/testing-guide.md` to record the new desktop saved-view dropdown
   workflow and its exact limitations. Keep the documented mobile,
   cross-browser, placement, clipping, and fallback gaps and the temporary
   dropdown gate removal condition intact. Verify all changed documentation
   links and repository-relative paths.
5. Format the changed source, E2E, and Markdown files; run `npm run lint:fix`,
   focused Vitest tests if any final edit affected them,
   `npm run typecheck:e2e`, `npm run build`, and
   `npm run build:prod-smoke`. If the user-managed production-smoke environment,
   matching Chromium, and trusted local CA are available, run
   `npm run test:e2e:csp`; otherwise do not start the environment and report the
   browser audit as unverified with the exact missing prerequisite. Finish with
   link/path checks and `git diff --check`.

### Implementation notes

- The E2E browser mocks are fail-closed. Register exact canonical request URLs
  before navigation and let any unplanned request fail the test; do not use a
  wildcard response or real credentials/backend data.
- The browser test should exercise the changed application-owned dropdown and
  duplicate-dialog handoff, not native browser positioning internals already
  outside jsdom's scope.
- `npm run build` already runs the full coverage gate before TypeScript and the
  standard Vite bundle. Do not substitute `build:bundle` for the required final
  build.
- `npm run build:prod-smoke` includes the dropdown static scan and is required
  even if the external browser environment is unavailable.
- Documentation must describe durable rules and current executable coverage,
  not list internal component steps or reference this ephemeral plan.

### Validation

```bash
npx prettier --write \
  AGENTS.md \
  docs/README.md \
  docs/architecture.md \
  docs/testing-guide.md \
  e2e/fixtures/data.ts \
  e2e/fixtures/scenarios.ts \
  e2e/csp/view-actions.spec.ts
npm run lint:fix
npm run typecheck:e2e
npm run build
npm run build:prod-smoke
test -f docs/architecture.md
test -f docs/testing-guide.md
test -f src/features/views/components/ViewActionsMenu.tsx
rg -n "Navigation and action hierarchy|View actions|Open in Analytics|Review possible transfers and refunds" \
  AGENTS.md docs src e2e
git diff --check
```

When all external-browser prerequisites documented in the Testing guide are
available, also run:

```bash
npx playwright install --list
check-budget-analyzer-local-ca-trust
PLAYWRIGHT_BASE_URL=https://app.budgetanalyzer.localhost/_prod-smoke/ \
  npm run test:e2e:csp
```

### Completion criteria

- Architecture owns a durable, discoverable action/navigation hierarchy and
  `AGENTS.md` directs future applicable work to it without duplicating it.
- The changed saved-view dropdown has deterministic production-smoke browser
  coverage and the Testing guide accurately records both the new evidence and
  remaining gaps.
- Focused tests, full coverage, TypeScript, lint fixing, standard build,
  production-smoke dropdown scan, E2E typecheck, formatting, documentation
  path checks, and whitespace checks pass.
- The external CSP browser audit passes when the user-managed environment is
  available; if it is not available, handoff explicitly identifies that single
  unverified gate and does not claim full browser verification.
- No required code, test, or durable documentation work remains.
