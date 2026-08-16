# Playwright Browser Harness And CSP Detection Plan

Add a repository-owned Playwright harness that lets agents exercise the real production-smoke
frontend through the workstation-owned Tilt ingress, mock only browser-facing auth and API
responses, and detect runtime Content Security Policy violations and prohibited style mutations.
This plan establishes detection and debugging infrastructure only; it does not remove Framer
Motion, change application styling, relax the CSP, or otherwise mitigate findings.

## Prerequisites

Before starting any phase:

1. The user owns Tilt on the workstation. Confirm that the stack is already healthy; agents must
   not start, stop, or reconfigure Tilt or run `npm run dev`.
2. Verify container trust for the host-published local ingress CA:

   ```bash
   check-budget-analyzer-local-ca-trust
   ```

   If trust is absent or stale and the helper is available, run
   `ensure-budget-analyzer-local-ca-trust` and check again. If the helper reports that the
   host-published CA is missing or invalid, stop and ask the user to run `./setup.sh` from the
   orchestration checkout on the workstation. Never generate certificates in this repository or
   use an HTTPS-error bypass.
3. Confirm that the default browser target is reachable from the agent container:

   ```bash
   curl --fail --silent --show-error --head \
     https://app.budgetanalyzer.localhost/_prod-smoke/
   ```

   The response must be `200` and must include the strict production-smoke CSP. Do not substitute
   the relaxed Vite route at `/` and do not serve `dist/` from a test-owned server.
4. Confirm that the container-provided Playwright and Chromium installation is usable and record
   its Playwright version before selecting the repository dependency version:

   ```bash
   playwright --version
   playwright install --list
   ```

5. Run `npm install` if repository dependencies are not already installed. If the production-smoke
   resource has not refreshed after dependency changes, stop and ask the user to verify the
   workstation-owned Tilt resource rather than attempting to manage Tilt from the container.

The observed default sandbox uses host networking, resolves
`app.budgetanalyzer.localhost` to host loopback, publishes the matching mkcert CA at
`../orchestration/nginx/certs/k8s/_mkcert-rootCA.pem`, and provides Chromium under
`PLAYWRIGHT_BROWSERS_PATH`. Keep the harness portable: depend on the resulting HTTPS and browser
contracts, not on hard-coded sandbox filesystem paths.

## Product Decisions

1. Default `baseURL` to `https://app.budgetanalyzer.localhost/_prod-smoke/`. Support an explicit
   `PLAYWRIGHT_BASE_URL` override for other externally managed environments, but optimize commands,
   documentation, and diagnostics for the default workstation-Tilt path.
2. Treat the target as externally managed. Do not add Playwright `webServer` configuration and do
   not start Vite, Tilt, NGINX, or a static server from the test harness.
3. Require valid HTTPS. Keep Playwright's `ignoreHTTPSErrors` disabled and do not add an environment
   variable, CLI flag, or documented escape hatch that bypasses certificate validation.
4. Load the document, scripts, stylesheets, and lazy chunks from the real production-smoke route so
   the browser receives the real strict CSP header. Intercept only the exact Session Gateway and
   `/api/*` requests needed by each scenario. Never add a frontend auth-bypass mode.
5. Keep the first harness intentionally small: one headless Chromium desktop project, reusable
   fixtures, failure traces/screenshots, one detector self-test, and one representative
   authenticated transaction workflow. Leave additional routes, mobile viewports, browser engines,
   full dropdown equivalence, and CI provisioning to later iterations.
6. Make the application CSP audit strict and unallowlisted: runtime violations or prohibited style
   mutations make the audit command fail. Do not add that external-environment audit to `npm run
   build` while known product findings remain. Provide a separate passing detector self-test so the
   harness can be validated independently from the application's current CSP state.
7. Retain `scripts/check-dropdown-csp.mjs`. This initial browser coverage does not yet provide all
   placement, viewport fallback, and mobile equivalence required to replace the narrow static gate.

## Phase 1: Establish The External Playwright Harness

### Workspace

.

### Goal

Add reproducible repository-owned Playwright tooling that reaches the trusted production-smoke
origin without owning the server lifecycle and fails clearly when its external prerequisites are
not satisfied.

### Scope

- `package.json` and `package-lock.json`
- `playwright.config.ts`
- A dedicated E2E TypeScript configuration
- Initial files under `e2e/` for environment preflight
- Test artifact ignores
- Formatting and type-check wiring for the new repository sources

### Non-goals

- Runtime CSP mutation monitoring beyond response-header validation
- Authenticated product workflows
- Application code changes
- CI workflow changes or browser downloads during ordinary test execution
- Starting or controlling Tilt, Vite, NGINX, or any other server
- Ignoring HTTPS errors

### Required context

- Read `AGENTS.md`, `package.json`, `tsconfig.json`, `tsconfig.node.json`, `eslint.config.js`,
  `.gitignore`, `docs/development.md`, and `docs/testing-guide.md` before editing.
- Read the future-harness comment in `scripts/check-dropdown-csp.mjs` and preserve its static gate.
- Re-run every plan prerequisite. The trusted default origin is part of this phase's contract, not
  an optional integration detail.

### Execution steps

1. Add `@playwright/test` as a development dependency at the exact version compatible with the
   container-provided Playwright/Chromium revision, and update the lockfile. Do not download or
   commit browser binaries.
2. Create `playwright.config.ts` with `e2e/` as the test directory, the default strict-smoke URL,
   an optional `PLAYWRIGHT_BASE_URL` override, one headless Chromium desktop project, bounded
   timeouts, deterministic retries, and useful traces/screenshots on failure. Omit `webServer` and
   keep HTTPS verification enabled.
3. Add an E2E-specific TypeScript configuration that includes the Playwright config and `e2e/`
   sources without broadening the browser application's production compilation boundary. Add an
   explicit E2E type-check command and make the normal bundle build type-check the harness without
   launching a browser.
4. Add package scripts with clear separation between the passing harness checks and the strict
   application audit, including `test:e2e:harness` and `test:e2e:csp`. Do not add the external
   browser run to `npm run build` or `npm run test:coverage`.
5. Extend the formatter's owned TypeScript paths to cover the Playwright config and `e2e/` without
   causing unrelated formatting churn. Confirm the existing lint command covers the new files.
6. Ignore only generated Playwright output such as reports, traces, screenshots, and test results;
   keep fixtures and specifications repository-owned.
7. Add a focused environment preflight that loads the default document without intercepting it,
   verifies HTTP `200`, verifies that the effective response has the required strict CSP directives,
   and rejects `'unsafe-inline'` or `'unsafe-eval'`. Make TLS, DNS, connection, wrong-route, and CSP
   failures produce distinct actionable messages. A minimal unauthenticated auth response may be
   intercepted only to prevent post-load OAuth behavior from obscuring the response-policy check.

### Implementation notes

- Header validation must prove at least `script-src 'self'`, `style-src 'self'`, `object-src
  'none'`, and `base-uri 'self'`, while rejecting unsafe directives. Parse directives rather than
  relying on one exact header string or directive order.
- Do not use `page.setContent()`, `file:` URLs, the relaxed root route, or a locally synthesized CSP
  for the authoritative preflight.
- The default URL should work with no environment variables in the documented agent sandbox.
- Type checking may be integrated into the normal build; browser navigation must remain an
  explicit E2E command because the externally managed environment is not guaranteed in CI.

### Validation

With workstation Tilt healthy and container CA trust current:

```bash
check-budget-analyzer-local-ca-trust
npx playwright --version
npm run lint:fix
npm run format
npm run typecheck:e2e
npm run test:e2e:harness -- --grep "strict production-smoke response"
npm run build:bundle
```

Also run the preflight once with an intentionally invalid `PLAYWRIGHT_BASE_URL` and confirm that it
fails quickly with an infrastructure-focused diagnostic rather than hanging or reporting a product
assertion. Do not weaken TLS to perform that negative check.

### Completion criteria

- The repository owns the Playwright test dependency, config, types, and scripts.
- The zero-configuration path targets the trusted workstation Tilt URL.
- The harness never starts a server and never ignores TLS errors.
- The response preflight distinguishes missing infrastructure from an incorrect or relaxed CSP.
- Static quality gates and the focused live preflight pass.

## Phase 2: Add Reusable CSP Observation And Mocked Browser Fixtures

### Workspace

.

### Goal

Create reusable browser fixtures that observe CSP and DOM styling behavior from before application
startup, provide deterministic authenticated API responses, and prove the detector catches
controlled violations.

### Scope

- Typed fixtures and helpers under `e2e/fixtures/`
- Deterministic auth and API response builders under `e2e/`
- A detector self-test under `e2e/csp/`
- Focused tests for parsing, reporting, and unexpected-request behavior where useful

### Non-goals

- Asserting that the current application is CSP-clean
- Mitigating Framer Motion or any other runtime styling dependency
- Reusing Node-only MSW server setup in the real browser
- Hitting Auth0, Session Gateway, ext_authz, or backend services
- Allowlisting known violations
- Broad route and viewport coverage

### Required context

- Read the Phase 1 implementation, `src/testing/mocks/handlers.ts`, `src/api/auth.ts`,
  `src/types/auth.ts`, `src/api/client.ts`, and the current application query endpoints before
  defining browser mocks.
- Read `docs/issues/strict-csp-runtime-style-dependencies.md` and keep its distinction between
  dormant bundle capability and observed runtime behavior.
- Confirm the Phase 1 harness validation passes against the trusted default URL.

### Execution steps

1. Define a small serializable observation model for `securitypolicyviolation` events, added
   `<style>` elements, added or changed `style` attributes, final-DOM style findings, and relevant
   browser console errors. Include directive, blocked URI, source location, element summary, and
   scenario timing when the browser exposes them; do not capture sensitive DOM contents or API
   payloads.
2. Install the browser-side listener and `MutationObserver` with `page.addInitScript()` before
   navigating so startup behavior is visible. Observe transient mutations as well as the final DOM,
   and expose typed reset/snapshot operations for controlled detector tests.
3. Add a Playwright-side assertion/reporting helper that drains all observation channels, produces
   compact deduplicated diagnostics, and fails on any executable CSP violation, runtime-added
   `<style>` element, or runtime/final `style` attribute. Treat console text as supporting evidence,
   not the sole browser contract.
4. Add authenticated-user and session fixtures by intercepting exactly `/auth/v1/user` and
   `/auth/v1/session`. Add scenario-owned `/api/*` responses using production response shapes and
   record unexpected auth/API requests so a test cannot silently reach real protected services.
5. Keep shared test data deterministic: use fixed identifiers and timestamps, grant only the
   permissions required by a scenario, and avoid reading real cookies, credentials, or backend
   state.
6. Add a detector self-test that loads the real strict-CSP document, clears startup observations,
   deliberately attempts a style attribute and a dynamic `<style>` insertion, and asserts that the
   appropriate observer and browser-policy signals are captured. This test validates detection; it
   must not classify the controlled injection as an application regression.
7. Add focused negative coverage showing that an unexpected auth/API request and a missing monitor
   installation fail closed with actionable diagnostics.

### Implementation notes

- Register mocks before navigation but never intercept `/_prod-smoke/`, its assets, or lazy chunks.
- Do not import `src/testing/mocks/server.ts`; that MSW server is designed for Node/jsdom. Reuse
  production types or small typed fixture builders where doing so does not couple E2E code to
  mutable unit-test state.
- Record style-element creation even if the element is removed before the final assertion.
- Avoid arbitrary sleeps. Wait for explicit page readiness and user-visible state, then collect the
  observations made throughout that interval.
- The self-test may use controlled `page.evaluate()` mutation only as a detector fixture. Do not add
  prohibited runtime styling to application source.

### Validation

```bash
check-budget-analyzer-local-ca-trust
npm run lint:fix
npm run format
npm run typecheck:e2e
npm run test:e2e:harness
npm run build:bundle
```

Inspect the detector self-test output to confirm it identifies both the controlled style attribute
and controlled stylesheet insertion. Confirm that traces and screenshots are retained on a forced
self-test failure, then remove the forced failure before completing the phase.

### Completion criteria

- Monitoring begins before application startup and captures transient and final style behavior.
- CSP events, DOM mutations, and console evidence are reported through typed reusable helpers.
- Browser auth/API behavior is deterministic and cannot fall through silently to real services.
- A controlled prohibited mutation proves the detector fails closed.
- All passing harness self-tests and static quality gates succeed without claiming the application
  itself is CSP-clean.

## Phase 3: Exercise A Basic Application CSP Audit And Document The Workflow

### Workspace

.

### Goal

Use the harness for one representative authenticated transaction workflow, surface current runtime
CSP findings without mitigation or allowlists, and document how users and agents run and diagnose
the browser tests.

### Scope

- A basic strict audit specification under `e2e/csp/`
- Only the API mocks required by the selected transaction workflow
- `README.md` where the new top-level command needs discovery
- `docs/development.md`, `docs/testing-guide.md`, and
  `docs/issues/strict-csp-runtime-style-dependencies.md`
- The future-harness comment in `scripts/check-dropdown-csp.mjs`

### Non-goals

- Removing or changing Framer Motion usage
- Changing animations, dropdowns, layouts, or other application behavior
- Weakening CSP, adding nonces, hashes, unsafe directives, or runtime-style allowlists
- Replacing the dropdown static gate
- Exhaustive route, form, mobile, or cross-browser coverage
- CI environment provisioning or CI workflow integration
- Declaring the open strict-CSP issue resolved

### Required context

- Read the completed Phase 1 and Phase 2 harness, `TransactionsPage.tsx`, its direct data hooks,
  and the controls used by the chosen interaction before finalizing route mocks and locators.
- Inventory the current transaction-path Motion use with the discovery command in
  `docs/issues/strict-csp-runtime-style-dependencies.md` so runtime findings can be correlated with
  source without assuming causation.
- Confirm the self-test distinguishes detector correctness from product cleanliness.

### Execution steps

1. Add one authenticated desktop scenario that navigates through the real production-smoke
   application to the transaction list, waits for deterministic mocked data to render, performs one
   user-visible interaction that exercises a layout transition such as revealing and dismissing a
   selection-dependent action bar, and keeps monitoring active for the whole workflow.
2. Mock only the auth, session, transaction, currency, and other exact API requests proven necessary
   by that scenario. Use user-facing roles or accessible names for locators and assert the expected
   page state before evaluating security observations.
3. Make `npm run test:e2e:csp` fail when the scenario records any CSP violation, dynamic `<style>`,
   or DOM `style` attribute. Do not suppress, rename, minify around, snapshot-accept, or allowlist
   known Framer Motion and React DOM signatures.
4. Run the strict application audit. If it fails on current application behavior, preserve useful
   traces locally, classify the observed runtime behavior in the open issue, and leave mitigation
   for a separate plan. A nonzero product-audit result is expected evidence when violations are
   genuinely detected; the passing detector self-test and quality gates remain the acceptance proof
   for this harness-only plan.
5. Update durable development and testing documentation with the default command, externally
   managed Tilt prerequisite, CA trust check and remediation note, base-URL override, mock boundary,
   artifact locations, and the distinction between harness self-tests and the strict product audit.
   State explicitly that agents must not start Tilt or Vite.
6. Update the CSP issue with the new runtime command and evidence model. Record observed violation
   categories and exercised workflow without claiming that a library is the cause unless runtime
   evidence establishes it. Keep the remediation and acceptance criteria intact.
7. Update the comment in `scripts/check-dropdown-csp.mjs` to point to the repository harness while
   retaining the static check until later browser coverage proves dropdown placement, fallback,
   clipping escape, and mobile equivalence.
8. Run the complete repository quality sequence and confirm ordinary builds remain independent of
   Tilt and the external browser environment.

### Implementation notes

- The strict audit is meant to reveal current failures. Do not make it pass by testing an inert
  route, disabling animation, changing reduced-motion preferences solely for the test, or waiting
  until offending nodes disappear.
- Keep audit observations free of auth payloads and transaction descriptions so Playwright
  artifacts remain safe to inspect locally. Generated artifacts must remain ignored and must not be
  committed.
- Do not link this plan from durable documentation; link the implemented commands and maintained
  testing/CSP documentation instead.
- If the application unexpectedly produces zero findings, report that accurately but do not treat
  one basic scenario as proof that all Motion paths or the full application are compliant.

### Validation

First prove the harness independently:

```bash
check-budget-analyzer-local-ca-trust
npm run lint:fix
npm run format
npm run typecheck:e2e
npm run test:e2e:harness
npm run test:coverage
npm run build:bundle
npm run build:prod-smoke
```

Then run the strict product audit and inspect its result and retained artifacts:

```bash
npm run test:e2e:csp
```

The audit must return zero only when it observed no prohibited behavior. If it returns nonzero for
real findings, confirm that the diagnostics identify the scenario and observation categories, and
record that result in the open CSP issue rather than weakening the assertion. Finally, set
`PLAYWRIGHT_BASE_URL` explicitly to the trusted production-smoke URL and verify the override path;
do not use HTTP or disable certificate verification.

### Completion criteria

- Agents can run a zero-configuration Playwright harness against the workstation-owned Tilt
  production-smoke route after establishing CA trust.
- The harness self-test, lint, formatting, type checking, unit coverage, and builds pass without
  requiring the external CSP audit in ordinary build flows.
- The basic transaction scenario makes a strict, unallowlisted CSP determination and emits useful
  local debugging artifacts.
- Any current product violations are reported honestly as audit failures and durable issue evidence,
  without mitigation in this plan.
- Documentation explains environment ownership, trusted HTTPS, mocks, commands, artifacts, and
  current coverage limits.
- The existing dropdown static gate remains active until broader browser equivalence is delivered.
