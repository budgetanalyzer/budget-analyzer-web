# Radix Dropdown Strict-CSP Remediation Plan

Replace the Radix dropdown dependency with an application-owned, accessible dropdown built on the
native HTML Popover top layer and statically emitted Tailwind CSS. Preserve the six current
consumers, including controlled state, `asChild`, start/end alignment, disabled and destructive
items, and the editable-transaction submenu, while eliminating runtime stylesheet injection and
element-level positioning styles.

The native top layer is important here: both transaction action menus render inside
`Table`'s `overflow-x-auto` container, so a non-portal absolute-positioned replacement would be
clipped. Native popovers escape that clipping without a React portal or measured coordinates, and
their implicit invoker anchor permits start/end placement through static CSS anchor-positioning
utilities. Before implementation, confirm and document that the supported browser floor includes
the Popover API and CSS anchor positioning. If that prerequisite cannot be established, stop rather
than silently shipping a clipped menu or reintroducing runtime geometry styles.

This plan fixes the dropdown defect tracked by `docs/bugs/radix-dropdown-strict-csp.md`; it is not a
general rewrite of every overlay or animation library. Execute the phases in order. Keep the bug
document until all closure checks pass, then remove it in the final phase.

## Phase 1: Implement the CSP-Safe Shared Dropdown Primitive

### Workspace

.

### Goal

Replace the Radix-backed shared component with an application-owned primitive that preserves the
existing public contract, uses the browser top layer for unclipped placement, and satisfies the
required interaction and accessibility behavior without creating any runtime CSS.

### Scope

- Confirm the browser-support prerequisite for the native Popover API, implicit popover anchors,
  CSS `anchor()` positioning, and position fallback/flip behavior; record the supported floor in
  durable architecture documentation when it is not already explicit.
- Reimplement `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`,
  `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuSub`,
  `DropdownMenuSubTrigger`, and `DropdownMenuSubContent` without Radix or another UI dependency.
- Preserve controlled and uncontrolled root state, `onOpenChange`, `asChild`, forwarded refs,
  caller event handlers, class-name composition, start/end alignment, disabled items,
  destructive styling, and nested submenu behavior used by current consumers.
- Use native `popover="auto"` elements and their invoker relationship so light dismissal, Escape,
  top-layer stacking, and clipping avoidance remain browser-owned.
- Add focused shared-primitive interaction tests and the smallest standards-faithful jsdom Popover
  shim needed by those tests and existing consumer suites.
- Assert at runtime that opening top-level and nested menus creates neither `<style>` elements nor
  DOM `style` attributes.

### Non-goals

- Rewriting the shared `Select`, `Dialog`, toast, animation, or table primitives.
- Adding Floating UI, Headless UI, another Radix package, or any dependency that computes placement
  through inline styles or injects CSS at runtime.
- Keeping Radix-only props that have no repository consumer merely for theoretical compatibility.
- Implementing arbitrary collision geometry, pixel measurements, `ResizeObserver` positioning, or
  CSSOM mutation.
- Redesigning menu labels, actions, permissions, routing, mutations, or feature behavior.
- Starting the Vite development server; the user owns that process.

### Required context

- Read `AGENTS.md` and `docs/bugs/radix-dropdown-strict-csp.md` completely, especially the CSP,
  component callback, `useEffect`, no-tooltip, test-placement, documentation, and no-git rules.
- Review `src/components/ui/DropdownMenu.tsx`, `src/components/ui/Table.tsx`,
  `src/components/ui/Button.tsx`, `src/components/ui/Select.tsx`, `src/testing/setup.ts`,
  `src/index.css`, `tailwind.config.js`, and `vitest.config.ts` before designing the primitive.
- Enumerate every `@/components/ui/DropdownMenu` import and confirm the current contract is limited
  to the six known consumers: `CurrencySelector`, `ViewSelector`, `UserProfileDropdown`,
  `EditableTransactionRow`, `ViewSettingsMenu`, and `ViewTransactionTable`. If another consumer or
  prop is found, add it to the compatibility matrix before editing.
- Confirm current browser support from checked-in project/orchestration documentation or an
  explicit project baseline. If the application must support a browser without the required native
  primitives, stop and report the missing product decision; do not improvise dynamic styling.
- Build the existing production-smoke bundle once and record the dropdown-specific baseline,
  including the `@radix-ui/react-dropdown-menu -> @radix-ui/react-menu -> react-remove-scroll ->
react-style-singleton` installed path and its `styleSheet.cssText` bundle marker. Treat unrelated
  bundle findings separately rather than weakening the dropdown closure checks.

### Execution steps

1. Define a small compatibility surface in `src/components/ui/DropdownMenu.tsx` using repository-
   owned TypeScript props. Support the actually used Radix-compatible inputs: root `open`,
   `defaultOpen`, and `onOpenChange`; trigger/item `asChild`; content `align` and `className`; item
   `disabled`, `destructive`, and click handlers; separator attributes; and submenu disabled/open
   behavior. Keep forwarded element refs and compose, rather than overwrite, the handlers and refs
   on an `asChild` element.
2. Implement root context with a stable `useId()` popover id, controlled/uncontrolled open state,
   trigger/content refs, and one state transition function. Synchronize controlled state with the
   native popover only through the Popover API and `toggle` events; do not calculate or write
   geometry. Guard duplicate show/hide calls so controlled rerenders and native light dismissal do
   not throw `InvalidStateError` or emit duplicate `onOpenChange` calls.
3. Implement `DropdownMenuTrigger` as a real button by default and a cloned child when `asChild` is
   requested. Add `popoverTarget`, `aria-haspopup="menu"`, `aria-expanded`, and `aria-controls`,
   preserve the child's accessible name and disabled state, and ensure pointer activation plus
   Enter, Space, and ArrowDown open the menu. ArrowDown must move focus to the first enabled item.
4. Implement `DropdownMenuContent` as a `popover="auto"` element with `role="menu"`, static
   Tailwind classes, viewport-bounded maximum width/height, and no React portal. Reset the user-agent
   centered-popover insets/margins with static classes, position it from the implicit invoker anchor,
   map `align="start"` and `align="end"` to static anchor edges, and use static block/inline flip
   fallbacks so edge placement remains usable on small and large viewports. Retain center alignment
   only if it can be expressed with the same static mechanism.
5. Add menu keyboard management over enabled `[role="menuitem"]` descendants: ArrowDown/ArrowUp
   wrap, Home/End jump, Enter/Space activate the focused item, Escape closes and restores focus to
   the invoking trigger, and Tab closes without trapping normal tab order. Close the top-level menu
   after an enabled item action unless the action explicitly prevents default. Native light dismiss
   must close on outside pointer interaction and keep controlled state synchronized.
6. Render ordinary items as semantic buttons with `role="menuitem"`, `type="button"`, and native
   `disabled`; for `asChild` links, clone the child with `role="menuitem"`, `aria-disabled`, and
   guarded activation. Preserve caller handlers before performing the default close action, and
   retain the existing destructive/disabled visual contract with Tailwind classes only.
7. Implement submenu context with its own stable popover id and invoker relationship. Support click,
   pointer hover, Enter/Space, and ArrowRight opening; focus the first enabled child; support
   ArrowLeft/Escape returning focus to the submenu trigger; and close the submenu with its parent.
   Anchor the submenu beside its trigger with static inline flip fallback so it stays within the
   viewport. Keep the chevron presentation and disabled semantics.
8. Add `src/components/ui/__tests__/DropdownMenu.test.tsx`. Cover uncontrolled and controlled open
   changes, existing handler composition, start/end metadata, click and keyboard item selection,
   disabled-item skipping/non-activation, destructive item semantics, Home/End and wraparound,
   outside dismissal, Escape focus restoration, Tab behavior, `asChild` links, submenu pointer and
   keyboard operation, and parent/submenu cleanup.
9. Add a minimal shared Popover API shim to `src/testing/setup.ts` only because jsdom does not
   implement the browser standard. Make it track open state and dispatch realistic `beforetoggle`
   and `toggle` events; do not turn it into application production code or test native browser
   behavior itself. Remove obsolete Radix pointer-capture/scroll-into-view setup only after the
   complete consumer suite no longer needs it.
10. In the primitive tests, count document `<style>` elements before opening each menu and assert the
    count does not increase. Assert the trigger, menu, submenu, and their descendants have no
    `style` attribute before and after open, navigation, alignment, and dismissal.

### Implementation notes

- The Popover API is an external browser system, so effects/listeners used to mirror controlled
  state and clean up native popovers are appropriate. Keep state derivation and event-driven
  transitions out of `useEffect`.
- Use memoized callbacks for values passed as JSX event props. A shared `composeEventHandlers` and
  ref-merging helper may live in `DropdownMenu.tsx` when it remains dropdown-specific; do not create
  a broad utility without another consumer.
- Native popover invocation establishes an implicit anchor. Use static arbitrary Tailwind utilities
  for properties such as `top: anchor(bottom)` and static position fallbacks; never generate a
  per-instance `anchor-name`, CSS custom property, transform, inset, width, or height through
  `style`, `setAttribute`, CSSOM, or a runtime `<style>` node.
- The top layer, rather than a React portal, is what prevents row-action menus from being clipped by
  `Table`'s overflow wrapper. Do not weaken the table's horizontal scrolling to accommodate menus.
- Keep DOM order logical: trigger first, then content. The popover can enter the top layer while
  remaining in that DOM relationship for ids, ownership, testing, and cleanup.
- Do not test browser-guaranteed popover placement algorithms in jsdom. Test the application-owned
  state, roles, attributes, keyboard logic, handler composition, and absence of runtime styles;
  reserve actual placement/CSP enforcement for the production-smoke browser check.

### Validation

Run the focused shared-primitive suite:

```bash
npx vitest run src/components/ui/__tests__/DropdownMenu.test.tsx
```

Confirm the new primitive has no forbidden runtime styling or Radix import:

```bash
rg -n "@radix-ui/react-dropdown-menu|style=|\.style\.|setAttribute\(['\"]style|createElement\(['\"]style|cssText|insertRule|setProperty" \
  src/components/ui/DropdownMenu.tsx \
  src/components/ui/__tests__/DropdownMenu.test.tsx
```

Implementation matches must be zero. A test may contain a selector for detecting `style`
attributes, but it must not create one.

### Completion criteria

- The supported browser floor is explicit and includes the required native Popover/anchor features.
- Every exported dropdown component used by the repository is application-owned and imports no
  Radix or runtime-positioning library.
- The focused suite proves controlled/uncontrolled behavior, handler/ref preservation, semantic
  roles, keyboard navigation, dismissal, focus restoration, disabled/destructive items, alignment
  metadata, and submenu operation.
- Opening and operating the primitive creates no runtime `<style>` element or DOM `style` attribute.
- The native top-layer/static-anchor design is ready for all six consumers without changing table
  overflow behavior.

## Phase 2: Migrate and Verify Every Dropdown Consumer

### Workspace

.

### Goal

Prove the new shared primitive preserves each real feature workflow, including table row actions
and the nested Add to View menu, and correct any consumer-level accessibility or event-composition
assumptions exposed by the replacement.

### Scope

- Exercise all six dropdown consumers against the application-owned primitive.
- Preserve selection, routing, logout, view settings, transaction mutation, permission, and loading
  behavior.
- Add or strengthen representative consumer tests where current coverage does not exercise the
  dropdown interaction.
- Remove Radix-specific test workarounds and comments.
- Verify top-level and nested popovers carry no inline styles in representative feature renders.
- Make only narrowly required accessibility fixes, such as supplying an explicit accessible name to
  an icon-only trigger that currently lacks one.

### Non-goals

- Refactoring the consumers' API hooks, table definitions, permission model, Redux state, routing,
  view logic, or visual design.
- Replacing other menus/selects or standardizing every overlay in the application.
- Adding snapshots or tests that only assert Tailwind class strings, React behavior, or the browser's
  native Popover implementation.
- Running `npm run dev`.

### Required context

- Re-read `AGENTS.md`, the completed Phase 1 primitive/tests, and all six consumer files before
  editing.
- Review existing coverage in `UserProfileDropdown.test.tsx`, `TransactionTable.test.tsx`, and
  `ViewTransactionTable.test.tsx`; confirm that `CurrencySelector`, `ViewSelector`, and
  `ViewSettingsMenu` currently lack direct interaction coverage before adding focused tests.
- Inspect the hooks/mocks used by each consumer so tests continue to prove application behavior,
  not only that a menu opens.
- Inspect each trigger's DOM context. In particular, retain event propagation safeguards on editable
  and saved-view transaction rows and keep menu actions available inside the horizontally scrolling
  table wrapper.

### Execution steps

1. Render every consumer with the new primitive and address only genuine compatibility failures.
   Keep `align="start"` for `ViewSelector`, `align="end"` for the other five consumers, and current
   width classes. Do not introduce per-consumer coordinates or inline styles.
2. Give the `ViewSelector` chevron trigger an explicit screen-reader label such as “Open saved views
   menu” while preserving the adjacent main Views link. Verify the other icon-only triggers retain
   their existing `View settings`, `Open menu`, or `Actions` names and that the profile/currency
   triggers remain named by visible content.
3. Add `src/components/__tests__/CurrencySelector.test.tsx` to prove opening and selecting a
   currency dispatches the existing Redux action, selected/disabled behavior remains correct, and
   the menu closes without a runtime style element or attribute.
4. Add `src/components/__tests__/ViewSelector.test.tsx` to prove its named trigger opens the saved
   views list, `asChild` link items navigate, the current view remains represented, the empty state
   renders, and item activation closes the menu.
5. Add `src/features/views/components/__tests__/ViewSettingsMenu.test.tsx` to prove the controlled
   root follows `onOpenChange`, Edit/Delete callbacks still fire, the open-ended mutation receives
   the existing payload, pending state disables actions, and selecting an action closes the menu.
6. Extend `UserProfileDropdown.test.tsx` with Escape/focus restoration and outside-dismissal coverage
   only where the shared test cannot prove the consumer's composed behavior. Retain the current
   identity, permission, navigation, and logout assertions.
7. Replace the Radix-specific `beforeAll` pointer-capture and `scrollIntoView` setup plus keyboard
   workaround in `TransactionTable.test.tsx` with normal `userEvent` interaction. Make the mocked
   views/pin mutation configurable, then prove ArrowRight opens Add to View, disabled/loading states
   do not activate, selecting a view calls the existing pin mutation once, and row click/edit/delete
   handlers do not fire accidentally.
8. Keep the existing `ViewTransactionTable` Pin/Unpin/Exclude menu tests passing with ordinary
   pointer interaction. Add an Escape or outside-dismissal assertion only if needed to prove table
   row event composition after the native top-layer change.
9. In one representative header menu, one transaction row menu with submenu, and one saved-view row
   menu, assert that opening and interacting adds no `<style>` element and no descendant `style`
   attribute. Avoid duplicating the complete primitive matrix in every feature suite.
10. Run the focused consumer suites together and fix shared behavior in the primitive rather than
    adding consumer-specific workarounds when a failure applies to more than one menu.

### Implementation notes

- Existing consumers pass `onClick`, not Radix `onSelect`. Preserve the concrete event types used by
  transaction row handlers so `stopPropagation()` continues to protect row navigation.
- `ViewSelector` uses `DropdownMenuItem asChild` around a router `Link`; disabled semantics must not
  be inferred from native button behavior in that path.
- `ViewSettingsMenu` is the only controlled consumer. Its explicit `setIsOpen(false)` calls may
  remain; the primitive must tolerate them without duplicate callbacks or popover exceptions.
- The Add to View submenu is available independently of edit/delete permission. Do not accidentally
  hide it while rewriting test mocks.
- Consumer tests should assert mutations, navigation, callbacks, focus, and accessible roles/names.
  Class checks are appropriate only for the explicit static-alignment/CSP contract.

### Validation

Run all dropdown consumers and the primitive together:

```bash
npx vitest run \
  src/components/ui/__tests__/DropdownMenu.test.tsx \
  src/components/__tests__/CurrencySelector.test.tsx \
  src/components/__tests__/ViewSelector.test.tsx \
  src/features/auth/components/__tests__/UserProfileDropdown.test.tsx \
  src/features/transactions/components/__tests__/TransactionTable.test.tsx \
  src/features/views/components/__tests__/ViewSettingsMenu.test.tsx \
  src/features/views/components/__tests__/ViewTransactionTable.test.tsx
```

Confirm no consumer introduces a runtime positioning escape hatch:

```bash
rg -n "style=|\.style\.|setAttribute\(['\"]style|createElement\(['\"]style|cssText|insertRule|setProperty" \
  src/components/CurrencySelector.tsx \
  src/components/ViewSelector.tsx \
  src/features/auth/components/UserProfileDropdown.tsx \
  src/features/transactions/components/EditableTransactionRow.tsx \
  src/features/views/components/ViewSettingsMenu.tsx \
  src/features/views/components/ViewTransactionTable.tsx
```

The source scan must return no implementation matches.

### Completion criteria

- All six consumers open, dismiss, and execute their existing actions through the new primitive.
- Start/end alignment intent, controlled state, router-link items, permissions, disabled/loading
  states, destructive actions, and row event isolation remain intact.
- The transaction Add to View submenu works by pointer and keyboard and calls the existing mutation
  exactly once.
- Icon-only triggers have stable accessible names, and Escape restores focus appropriately.
- Radix-specific jsdom shims/comments are gone, focused consumer tests pass, and representative
  consumer DOMs acquire no runtime styles.

## Phase 3: Remove Radix and Add a Repeatable Dropdown CSP Gate

### Workspace

.

### Goal

Remove the unsafe dependency chain from installation and the production bundle, and turn the
dropdown-specific closure evidence into a repeatable repository command without pretending it is a
complete browser CSP verifier.

### Scope

- Remove `@radix-ui/react-dropdown-menu` from `package.json` and regenerate `package-lock.json` with
  npm.
- Prove `@radix-ui/react-menu`, `react-remove-scroll`, `react-remove-scroll-bar`, and
  `react-style-singleton` are no longer installed unless another direct dependency independently
  requires them.
- Add a portable Node-based package script that fails closed on the known dropdown blockers after a
  production-smoke build.
- Integrate that check into `build:prod-smoke` or a single documented verification command so a
  future Radix reintroduction cannot pass only because a developer forgot the separate scan.
- Update durable development/architecture documentation for the new command and the native/static
  dropdown positioning contract.

### Non-goals

- Modifying orchestration-owned scripts or documentation; this repository has read-only permission
  for `../orchestration`.
- Claiming that a static bundle-token scan replaces manual browser-console validation.
- Broadly removing Framer Motion, React DOM renderer code, or other non-dropdown dependencies if a
  broader quote-variant scan finds unrelated `createElement("style")` text. Record a separate bug
  with precise reachability evidence instead of weakening or silently expanding this remediation.
- Changing release container, ingress, NGINX, or CSP header configuration.

### Required context

- Re-read `AGENTS.md`, `package.json`, `package-lock.json`, `docs/architecture.md`,
  `docs/development.md`, `.github/workflows/build.yml`, and the completed Phase 1/2 implementation.
- Read the orchestration-owned `scripts/smoketest/audit-frontend-csp.sh` and its durable documentation
  only to understand the coordinated verifier. Do not edit that repository.
- Run `npm ls @radix-ui/react-dropdown-menu @radix-ui/react-menu react-remove-scroll
react-remove-scroll-bar react-style-singleton --all` before uninstalling and retain its output as
  the dependency baseline.
- Inspect a fresh production-smoke bundle before defining the gate. Distinguish the known Radix
  `styleSheet.cssText`/style-singleton signature from generic renderer or unrelated animation code;
  the gate must have an honest, documented scope.

### Execution steps

1. Use npm's uninstall workflow to remove the direct `@radix-ui/react-dropdown-menu` dependency and
   update both package files. Do not hand-edit lockfile internals. Confirm no production source
   imports it before and after removal.
2. Run `npm ls` for the direct package and the four known transitive packages. An empty result is
   expected. If another dependency keeps one installed, inspect whether it reaches the frontend
   bundle and runtime; do not claim the unsafe chain is gone until that is resolved or explicitly
   shown unrelated.
3. Add a small Node script under `scripts/` that requires an existing `dist/`, recursively scans
   emitted text assets, reports file names and blocker names, and exits non-zero for the established
   dropdown signatures: `styleSheet.cssText`, the style-singleton text-node injection sequence, or
   bundled Radix/react-remove-scroll markers. Also fail if production source or package metadata
   reintroduces `@radix-ui/react-dropdown-menu`. Keep the scanner deterministic and dependency-free.
4. Add a package command such as `check:csp:dropdown` and compose it with
   `build:prod-smoke` after `tsc && vite build --base /_prod-smoke/`. Ensure the check itself does
   not recursively invoke the build. Preserve the existing standard build and coverage semantics.
5. Add focused tests for the scanner only if its file walking, match reporting, or exit behavior has
   meaningful branching that is not safely covered by invoking it against the real bundle. Do not
   add percentage-padding tests. At minimum, verify a known-bad temporary fixture fails and the fresh
   remediated `dist/` passes without modifying repository output.
6. Update `docs/development.md` with the exact production-smoke/CSP command, explain that the
   dropdown gate is automatic, and retain the orchestration/manual browser-console verifier as the
   stronger runtime proof.
7. Update the CSP section of `docs/architecture.md` concisely: dropdowns use native popovers/top-
   layer placement plus statically emitted anchor-positioning Tailwind utilities; runtime portals,
   measured coordinates, inline styles, and injected stylesheets remain prohibited. Record the
   supported browser floor established in Phase 1.
8. Review `README.md`, `AGENTS.md`, `docs/testing-guide.md`, and `.github/workflows/build.yml` for
   accuracy. Change only documents/automation whose durable commands or contracts actually changed;
   do not duplicate the component walkthrough or link to this plan.

### Implementation notes

- The dropdown gate is intentionally narrower than a browser CSP test. Generic bundled
  `createElement("style")` text can arise from React renderer capability code, while the known
  `styleSheet.cssText`/style-singleton sequence is direct evidence of this defect. Report other
  concrete runtime violations separately; never add a waiver for Radix.
- Keep `build:prod-smoke` suitable for orchestration's existing local-resource call. The Node scanner
  avoids adding `rg` as a new npm-script runtime prerequisite.
- Package-lock changes are expected to remove orphaned Radix menu/floating/focus-scope packages as
  well as the explicitly named scroll/style chain. Review the generated diff conceptually, but do
  not use any git write operation.
- Documentation should state durable architecture and commands, not the internal context/ref
  implementation or this plan's phase history.

### Validation

Verify dependency removal and source ownership:

```bash
npm ls @radix-ui/react-dropdown-menu @radix-ui/react-menu react-remove-scroll react-remove-scroll-bar react-style-singleton --all
rg -n "@radix-ui/react-dropdown-menu|@radix-ui/react-menu|react-remove-scroll|react-style-singleton" \
  package.json package-lock.json src
```

Both commands must show no remaining dropdown-chain consumer or installed package. Then run the
automated smoke build/gate and the bug document's required zero-exception scan:

```bash
npm run build:prod-smoke
rg -n "createElement\('style'\)|styleSheet\.cssText|eval\(" dist/
```

The package command must succeed and the required `rg` command must print no matches. If the exact
bug scan or manual runtime proof still identifies dropdown-generated styles, fix the implementation;
do not add exclusions.

### Completion criteria

- The direct Radix dropdown package and its orphaned unsafe dependency chain are absent from npm
  metadata, installation, source imports, and the emitted bundle.
- `build:prod-smoke` automatically runs a portable dropdown-specific CSP gate that fails on the
  original defect signature.
- The remediated production-smoke bundle passes both the automated gate and the bug document's exact
  scan with no exception.
- Durable architecture/development documentation describes the native/static placement contract,
  supported browser floor, automated command, and limits of static scanning.
- No orchestration, backend, API, git, or unrelated animation change is introduced.

## Phase 4: Run Full Closure Validation and Retire the Bug Document

### Workspace

.

### Goal

Complete repository-wide regression, coverage, build, responsive, accessibility, and strict-CSP
validation; update dependent plan context; and remove the temporary bug record only after every
closure criterion is demonstrated.

### Scope

- Run formatting/lint autofix, all tests with coverage, the standard production build, the
  production-smoke build, and the strict dropdown CSP scans.
- Perform the real-origin browser verification required for CSP and placement when the user-managed
  local stack is available.
- Verify representative start/end menus and the submenu at mobile and desktop viewport sizes.
- Correct only regressions attributable to the dropdown remediation.
- Update the existing saved-view transfer/refund plan so its prerequisite check remains executable
  after this bug document is removed.
- Remove `docs/bugs/radix-dropdown-strict-csp.md` only when closure is complete.

### Non-goals

- Starting `npm run dev`, `tilt up`, or another user-owned long-running development process.
- Editing orchestration files, deploying, committing, pushing, or changing git state.
- Folding unrelated CSP findings or feature work into this remediation.
- Removing the bug document merely because unit tests or the package scanner pass.

### Required context

- Re-read `AGENTS.md`, the bug closure criteria, all completed phase changes, the updated durable
  docs, and `docs/plans/client-side-view-transfer-refund-review.md` before final validation.
- Confirm the user-managed stack already exposes `https://app.budgetanalyzer.localhost` and
  `/_prod-smoke/` before attempting browser verification. If it is not running, do not start it;
  report the manual real-origin closure check as outstanding and retain the bug document.
- Re-enumerate all dropdown imports/exports and rerun the dependency tree checks so no late edit
  reintroduced Radix or an untested consumer.
- Review test output for warnings about invalid ARIA, duplicate ids, state updates, unknown popover
  attributes, or unhandled popover exceptions; a green exit code with relevant warnings is not
  sufficient.

### Execution steps

1. Run Prettier over the changed TypeScript/TSX/CSS/Markdown/script files using the repository's
   configured formatter where it covers them. Avoid unrelated repository-wide formatting churn.
2. Run `npm run lint:fix` as required by repository policy. Review and fix all remaining errors or
   dropdown-related warnings without disabling ESLint rules.
3. Run the focused primitive and consumer suites once more, followed by `npm run test:coverage`.
   Preserve the global thresholds of 80% statements, 80% branches, 75% functions, and 80% lines;
   inspect failures for product-risk branches rather than adding trivial tests.
4. Run `npm run build:bundle` to prove the normal type-check/production bundle path, then run
   `npm run build:prod-smoke` to exercise the new automatic dropdown gate against the alternate base
   path. Finally run the exact zero-exception `rg` scan from the bug document.
5. Search all changed production code and the dropdown bundle path for inline `style` props,
   `.style` mutations, `setAttribute('style', ...)`, dynamic style creation, CSSOM writes, Radix
   dropdown imports, and the removed dependency chain. Resolve every in-scope finding.
6. On the already-running ingress environment, verify Currency, saved-view selector, profile,
   settings, editable transaction, and saved-view transaction menus on the strict
   `/_prod-smoke/` route. At mobile and desktop widths, check start/end alignment, viewport flips,
   table-overflow escape, submenu placement, scrolling, outside click, Escape, keyboard traversal,
   focus restoration, disabled/destructive actions, and dark/light appearance. Confirm the browser
   console reports no dropdown-generated CSP violation and inspect open menu/submenu elements to
   confirm they have no `style` attribute.
7. Update `docs/plans/client-side-view-transfer-refund-review.md` so its prerequisite check treats
   absence of the temporary bug document plus absence of the Radix dependency and a passing
   production-smoke dropdown gate as the durable proof. Remove instructions that require reading a
   file whose successful remediation deletes it; keep the saved-view feature itself unchanged.
8. Reconcile final documentation with actual commands and behavior. Then remove
   `docs/bugs/radix-dropdown-strict-csp.md`. If any automated or real-origin closure check is
   unavailable or failing, retain the bug document with `Status: Open` and report the precise
   blocker instead of partially closing it.

### Implementation notes

- `npm run build` would repeat the coverage gate already run explicitly and then perform the normal
  bundle. The explicit `test:coverage`, `build:bundle`, and `build:prod-smoke` sequence gives clearer
  failure attribution while covering the same required paths.
- The real-origin browser check is required because jsdom cannot validate top-layer placement,
  native anchor fallback, or enforcement by the NGINX strict CSP header.
- A menu can pass source scans yet still violate CSP through a dependency or browser-time behavior.
  Dependency, bundle, DOM, and console evidence are all required before deleting the bug record.
- Keep the plan-file edit limited to making its hard prerequisite executable after closure. Plan
  files remain ephemeral and must not be linked from durable non-plan documentation.

### Validation

Run the complete automated sequence:

```bash
npm run lint:fix
npm run test:coverage
npm run build:bundle
npm run build:prod-smoke
rg -n "createElement\('style'\)|styleSheet\.cssText|eval\(" dist/
```

Run final ownership and forbidden-source checks:

```bash
rg -n "@radix-ui/react-dropdown-menu|@radix-ui/react-menu|react-remove-scroll|react-style-singleton" \
  package.json package-lock.json src
rg -n "style=|\.style\.|setAttribute\(['\"]style|createElement\(['\"]style|cssText|insertRule|setProperty" \
  src/components/ui/DropdownMenu.tsx \
  src/components/CurrencySelector.tsx \
  src/components/ViewSelector.tsx \
  src/features/auth/components/UserProfileDropdown.tsx \
  src/features/transactions/components/EditableTransactionRow.tsx \
  src/features/views/components/ViewSettingsMenu.tsx \
  src/features/views/components/ViewTransactionTable.tsx
```

The dependency/source scans and exact bundle scan must print no implementation matches. Complete
the browser checklist on `https://app.budgetanalyzer.localhost/_prod-smoke/` and retain the bug
document until that proof is available.

### Completion criteria

- All focused tests, global coverage thresholds, lint autofix, standard bundle, production-smoke
  bundle, automatic dropdown gate, and exact CSP scan pass.
- All six consumers retain their visible actions and accessibility contracts on mobile and desktop,
  including keyboard navigation, Escape/outside dismissal, focus restoration, disabled/destructive
  behavior, table placement, and submenu operation.
- Browser enforcement on the strict production-smoke origin produces no dropdown CSP violation and
  open dropdown DOM contains no runtime style element or attribute.
- Durable docs and the dependent saved-view plan match the final implementation and commands.
- `docs/bugs/radix-dropdown-strict-csp.md` is removed only after every closure criterion passes.
- The repository contains no Radix dropdown dependency/import and no workaround, exception, or
  suppression for the original violation.
