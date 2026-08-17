# Migrate React Animations to Motion 13

Replace the direct `framer-motion` dependency and imports with the supported
`motion/react` facade on Motion 13.1.0 while preserving every existing
animation behavior. Keep the known dormant `AnimatePresence mode="popLayout"`
runtime stylesheet capability prohibited by repository convention, verify that
the upgrade does not exercise it, and retain the strict CSP evidence required
for Motion version changes.

## Phase 1: Establish the Motion React Dependency Boundary

### Workspace

.

### Goal

Make `motion/react` the application's only direct React animation API and
upgrade the implementation to Motion 13.1.0 without changing animation
semantics or UI behavior.

### Scope

- Replace the direct `framer-motion` dependency with `motion` 13.1.0 in
  `package.json` and regenerate `package-lock.json` with npm.
- Replace every production import from `framer-motion` with `motion/react`,
  including the centralized animation types in `src/lib/animations.ts`.
- Point the Vite `motion` manual chunk at the `motion/react` entry point.
- Run focused checks covering pages and components that use presence, layout,
  and keyed content animations.

### Non-goals

- Removing Motion, replacing animations with Tailwind/CSS, or changing any
  variants, durations, easing, layout, or presence modes.
- Adopting `LazyMotion`, `m`, `motion/react-mini`, or other bundle-size APIs.
- Adding `mode="popLayout"`, a `MotionConfig` nonce, runtime stylesheet
  allowlists, or CSP exceptions.
- Adding tests that only assert behavior owned by Motion itself.

### Required context

- Read the repository-root `AGENTS.md`, especially the dependency, testing,
  documentation, CSP, and no-git-operation rules.
- Node.js 20+ and npm 9+ must be available. No backend service prerequisite is
  needed for this phase.
- Motion 13.1.0 was the npm `latest` release when this plan was written. Confirm
  that with `npm view motion dist-tags.latest` before editing. If `latest` is no
  longer 13.1.0, stop and reassess the newer major/minor release notes rather
  than silently broadening this plan.
- The v12 React upgrade guide documents no breaking React changes. The v13
  breaking change removes automatic Emotion/Styled Components prop filtering;
  it does not apply to this repository's plain `motion.div` plus Tailwind usage.
- `motion/react` currently re-exports the React implementation from the
  transitive `framer-motion` package. The expected installed graph is one
  direct `motion@13.1.0` and one deduplicated transitive
  `framer-motion@13.1.0`, `motion-dom@13.0.0`, and `motion-utils@13.0.0` graph.

### Execution steps

1. Confirm the current stable version with `npm view motion dist-tags.latest`
   and inspect the current direct/locked graph with
   `npm ls motion framer-motion motion-dom motion-utils --omit=dev`.
2. Run `npm install motion@13.1.0`, then `npm uninstall framer-motion`, so npm
   owns both manifest and lockfile changes. Confirm `package.json` contains
   `"motion": "^13.1.0"` and no direct `framer-motion` entry.
3. Replace all TypeScript/TSX module specifiers `from 'framer-motion'` with
   `from 'motion/react'`. Preserve the existing imported symbols and use a
   type-only import for `Transition` and `Variants` in
   `src/lib/animations.ts` if required by the formatter/linter.
4. Change the `motion` manual chunk entry in `vite.config.ts` from
   `framer-motion` to `motion/react`; do not add a second animation chunk.
5. Run `npm run lint:fix`, then inspect the resulting source and dependency
   graph. Resolve real v13 type or lint failures without changing animation
   behavior or weakening any rule.

### Implementation notes

- Keep the migration mechanical. Do not rename the existing Vite chunk or
  centralized animation exports.
- A remaining `framer-motion` record in `package-lock.json` and `npm ls` is
  expected because `motion` depends on it. A production source import or direct
  `package.json` dependency is not expected.
- Preserve `AnimatePresence` modes exactly as `wait` or the default mode. A
  broad search after the edit must still find no `popLayout` source usage.
- Do not perform git operations.

### Validation

Run:

```bash
rg -n "from ['\"]framer-motion['\"]|mode=['\"]popLayout['\"]" src vite.config.ts package.json
rg -n "from ['\"]motion/react['\"]" src
npm ls motion framer-motion motion-dom motion-utils --omit=dev
npm run build:bundle
npx vitest \
  src/features/transactions/pages/__tests__/TransactionsPage.test.tsx \
  src/features/transactions/pages/__tests__/TransactionDetailPage.test.tsx \
  src/features/transactions/components/__tests__/ImportButton.test.tsx \
  src/features/views/pages/__tests__/ViewPage.test.tsx \
  src/features/analytics/pages/__tests__/AnalyticsPage.test.tsx
```

The first `rg` command must return no matches; its nonzero no-match exit is the
expected result. The second must enumerate all migrated Motion consumers. The
dependency tree must contain one v13 graph and no v11 packages.

### Completion criteria

- `motion@13.1.0` is the only direct animation dependency.
- All application imports use `motion/react`; `framer-motion` remains only as
  Motion's transitive implementation/package metadata.
- Vite emits the existing named `motion` chunk from the new entry point.
- The focused tests and type-checked production bundle pass with unchanged
  animation declarations.

## Phase 2: Complete Regression and Static CSP Review

### Workspace

.

### Goal

Prove the migrated dependency is regression-safe under the repository's full
unit, coverage, build, and static CSP checks, and update durable documentation
to describe the new public package boundary and the still-present dormant
stylesheet capability.

### Scope

- Run the full coverage suite and both standard and production-smoke bundles.
- Inventory the emitted Motion chunk for runtime stylesheet creation and
  compare its compressed size with the v11 baseline.
- Update the nearest CSP/dependency documentation in `AGENTS.md` and
  `docs/architecture.md` without duplicating component-level details.
- Strengthen the documented Motion capability scan so it recognizes minified
  single- or double-quoted `createElement("style")` and `insertRule()` forms.

### Non-goals

- Treating the known dormant `popLayout` injector as newly authorized.
- Allowlisting bundle findings or weakening the existing CSP detector.
- Changing Playwright sources, configuration, product behavior, or animation
  coverage solely to test a third-party library.
- Editing sibling repositories or running their coordinated audit scripts.

### Required context

- Phase 1 must be complete and its focused checks must pass.
- Read the strict CSP sections of `AGENTS.md`, `docs/architecture.md`, and
  `docs/testing-guide.md` before classifying emitted bundle matches.
- The verified v11 production-smoke Motion baseline is approximately 115,291
  bytes raw and 38,014 bytes gzip. A prior isolated v13 direct-import build was
  approximately 129,861 bytes raw and 42,543 bytes gzip; the facade build may
  vary slightly, so use this as review context rather than an exact gate.

### Execution steps

1. Run `npm run lint:fix` and review all formatter/linter changes for scope.
2. Run the full coverage suite and standard production bundle. Fix only
   migration-caused failures and do not reduce coverage thresholds.
3. Build the `/_prod-smoke/` bundle and run the existing dropdown CSP gate.
4. Locate the emitted `motion-*.js` asset, record raw and gzip sizes, and scan
   `dist/` for runtime stylesheet creation, CSSOM insertion, stylesheet
   `cssText`, and evaluation capabilities. Confirm the Motion chunk still
   contains the known dormant `popLayout` `createElement("style")` and
   `insertRule()` path and investigate any additional or changed capability.
5. Update `AGENTS.md` and `docs/architecture.md` to identify `motion/react` as
   the public API on Motion 13, retain the statement that ordinary client-side
   renderer property writes are allowed, and retain the prohibition on
   `popLayout` and runtime stylesheet injection. Make the documented scan
   expression robust to minified quote style and `insertRule()`.
6. Re-run formatting/lint and the production-smoke build if documentation or
   configuration corrections changed executable files.

### Implementation notes

- Capability inventory is not an allowlist. The known `popLayout` code may
  remain bundled only because no source path selects that mode and the runtime
  browser audit must observe zero stylesheet additions.
- Do not claim that one Chromium workflow proves all Motion APIs, routes, or
  browsers safe.
- Keep documentation concise and durable. Do not link this plan from non-plan
  documentation.
- Do not perform git operations.

### Validation

Run:

```bash
npm run lint:fix
npm run test:coverage
npm run build:bundle
npm run build:prod-smoke
rg -n "createElement\([\"']style[\"']\)|insertRule\(|styleSheet\.cssText|eval\(" dist/
npm ls motion framer-motion motion-dom motion-utils --omit=dev
```

Also calculate the raw and gzip byte counts for the emitted `motion-*.js`
asset. Review every static scan match and distinguish the known dormant Motion
helper and generic renderer capabilities from any new reachable injector. The
scan is expected to return known matches; an unexplained new runtime stylesheet
path fails this phase.

### Completion criteria

- All 585 or more repository tests pass and all configured coverage thresholds
  remain satisfied.
- Standard and production-smoke bundles pass, including the dropdown CSP gate.
- The dependency tree has one consistent v13 Motion graph and the bundle has a
  single intentional Motion chunk with reviewed size impact.
- All emitted capability matches are explained; no new reachable runtime
  stylesheet injector is accepted.
- `AGENTS.md` and `docs/architecture.md` accurately describe the Motion 13
  facade, CSP boundary, and static investigation command.

## Phase 3: Verify the Trusted Production-Browser CSP Workflow

### Workspace

.

### Goal

Verify that the Motion 13 `motion/react` build exercises existing presence and
layout behavior without CSP violations or runtime stylesheet injection in the
repository's trusted external Chromium workflow.

### Scope

- Verify the externally managed production-smoke environment and certificate
  trust without starting any local server.
- Confirm the externally served page references the Motion asset produced in
  Phase 2, avoiding a false pass against a stale build.
- Run the harness self-tests and strict authenticated transaction CSP audit.
- Record the audit outcome and investigate any migration-caused browser or CSP
  regression.

### Non-goals

- Starting Vite, Tilt, NGINX, Kubernetes, or any other environment component.
- Disabling TLS verification, CSP enforcement, detector assertions, or
  fail-closed request mocks.
- Expanding the current browser suite to claim exhaustive route, mobile, or
  cross-browser Motion coverage.
- Adding a nonce or allowlist to make an executable stylesheet finding pass.

### Required context

- Phases 1 and 2 must be complete, and `dist/` must contain the successful
  `/_prod-smoke/` build from Phase 2.
- The user/workstation must already provide the trusted externally managed
  production-smoke origin documented in `docs/development.md`. If it is not
  available after the documented trust checks, stop and report the external
  prerequisite rather than starting a server or bypassing HTTPS verification.
- The current application audit covers an authenticated desktop transaction
  workflow that mounts and dismisses the bulk action bar through
  `AnimatePresence`; it is meaningful CSP evidence but not exhaustive Motion
  behavior coverage.

### Execution steps

1. Run `check-budget-analyzer-local-ca-trust`. If instructed that the container
   trust copy is stale, run `ensure-budget-analyzer-local-ca-trust` and then
   repeat the trust check; never use an insecure TLS bypass.
2. Confirm the external `/_prod-smoke/` index is reachable and references the
   same hashed Motion asset as the local `dist/index.html`. Do not continue
   against a stale deployed bundle.
3. Run `npm run test:e2e:harness` to prove the strict response policy,
   fail-closed mocks, and stylesheet/CSP detector controls.
4. Run `npm run test:e2e:csp` and confirm the authenticated transaction
   selection workflow mounts and dismisses the bulk action bar while reporting
   zero CSP violations, zero runtime-added stylesheets, and zero final style
   elements.
5. If the audit fails, inspect its trace, screenshot, console context, and CSP
   observations. Fix only a demonstrated migration regression; do not allowlist
   it. After any executable change, return to the relevant Phase 2 validation
   before repeating this phase.

### Implementation notes

- Browser artifacts remain local under `test-results/playwright/` and
  `playwright-report/`; do not document or commit generated artifacts.
- No `npm run typecheck:e2e` is required when Playwright files and configuration
  remain unchanged. If investigation requires changing them, that command and
  an explicit review of the expanded scope become mandatory.
- Do not perform git operations.

### Validation

Run:

```bash
check-budget-analyzer-local-ca-trust
npm run test:e2e:harness
npm run test:e2e:csp
```

Before the Playwright commands, compare the hashed Motion asset referenced by
the trusted external index with the local Phase 2 production-smoke index. The
strict application audit must complete with no CSP observation or stylesheet
finding and no unexpected network request.

### Completion criteria

- The trusted origin is serving the Phase 2 Motion 13 production-smoke build.
- Harness detector controls pass without weakened TLS, CSP, or request-mocking
  behavior.
- The authenticated transaction animation workflow passes with zero CSP
  violations, zero runtime-added stylesheets, and zero final style elements.
- No migration work remains, and the repository is ready for user-controlled
  review and git operations.
