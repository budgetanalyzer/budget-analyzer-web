# Testing Guide

This document owns repository test policy, shared utilities, coverage, and the
external Playwright harness. Local installation and builds belong to
[Development](development.md); browser support and CSP semantics belong to
[Architecture](architecture.md).

## Testing Policy

Write tests that would fail for a real product regression. Prefer
integration-style component or page tests when confidence depends on routing,
permissions, forms, HTTP requests, URL state, or React Query behavior working
together. Use focused unit tests for pure utilities, complex hooks, and
product-owned edge cases.

Repository rules:

- Production-code tests are colocated under the nearest `__tests__/` directory.
- `src/testing/` contains shared test infrastructure only, not tests for
  production modules.
- New behavior needs a meaningful test or an explicit reason it does not need
  one.
- API-facing behavior normally uses MSW. Use a direct module mock only when its
  narrower boundary is intentional.
- User workflows prefer `@testing-library/user-event`; reserve `fireEvent` for
  low-level synthetic events that `user-event` does not model well.
- Assert user-visible behavior and frontend-owned contracts, not native browser,
  React, TypeScript, or third-party implementation behavior.
- Avoid snapshots and Tailwind/class assertions unless they protect an explicit
  product contract.

## Unit and Component Test Infrastructure

Vitest runs in jsdom with global APIs, CSS processing, and the
`America/Los_Angeles` timezone configured in `vitest.config.ts`. The stack is:

- Vitest and V8 coverage
- React Testing Library and jest-dom matchers
- `@testing-library/user-event` for user workflows
- MSW for the HTTP boundary
- jsdom for component and hook tests

`src/testing/setup.ts` runs before every test file. It installs jest-dom,
starts the MSW server, resets handlers and mutable mock state after each test,
and closes the server after the suite. It also supplies focused jsdom shims for
`matchMedia` and the HTML Popover API. The popover shim models open state,
toggle events, Escape, and light dismissal so application behavior can be
tested; it does not emulate browser layout or anchor positioning.

Shared infrastructure:

| Path                            | Responsibility                                                    |
| ------------------------------- | ----------------------------------------------------------------- |
| `src/testing/setup.ts`          | Global matchers, browser shims, and MSW lifecycle                 |
| `src/testing/mocks/handlers.ts` | Default auth/API responses and resettable mock state              |
| `src/testing/mocks/server.ts`   | Shared Node MSW server                                            |
| `src/testing/test-utils.tsx`    | Fresh Query Client, Redux store, and provider-aware render helper |

`createTestQueryClient()` disables query and mutation retries and disables
refetch-on-window-focus by default. `createTestStore()` creates an isolated
Redux store. `renderWithProviders()` returns the Testing Library result plus the
Query Client and store it used; pass `initialEntries` for a memory router and
`router: 'dom'` only for code that still imports router hooks from
`react-router-dom`.

## Running Vitest

```bash
# Watch mode
npm test

# Full suite once
npm test -- --run

# Full suite once with enforced coverage
npm run test:coverage

# Interactive Vitest UI
npm run test:ui

# One file once
npx vitest run src/utils/__tests__/parseSearchTerms.test.ts

# Tests whose full names match a pattern
npx vitest run -t "renders correctly"
```

Focused Vitest runs are useful while iterating. Run the proportionate broader
suite before handoff, especially when changing shared providers, mocks, routing,
or global setup.

## Test Placement

Place a test beside its production owner:

```text
src/components/BackButton.tsx
src/components/__tests__/BackButton.test.tsx

src/hooks/useTransactions.ts
src/hooks/__tests__/useTransactions.test.tsx

src/utils/parseSearchTerms.ts
src/utils/__tests__/parseSearchTerms.test.ts
```

Feature tests stay in the owning feature. Shared component, hook, API, store,
and utility tests stay beside the corresponding top-level module. Reusable
providers, render helpers, mock handlers, and fixtures belong under
`src/testing/`; do not create a general production-test directory there.

## Writing Repository Tests

### Example 1: Colocated Component Behavior Test

`src/components/__tests__/BackButton.test.tsx` is the current compact reference:
it renders real routes, drives navigation with `user-event`, and asserts visible
navigation outcomes rather than internal state. Prefer role, label, and visible
text queries. Use `findBy*` for content that appears asynchronously and
`queryBy*` for absence.

When URL-backed state changes before derived or animated content renders, wait
for the final visible result with `findBy*` or `waitFor()`. Test URL-state hooks
through their public handlers in a small route harness, including context
parameters that must be preserved and filters that must be cleared together.

Choose the test boundary according to the contract:

- Page/component tests: route guards, permission gates, forms, loading/error/
  empty states, URL behavior, mutations, and cache-visible workflows.
- Hook tests: query keys, `enabled` behavior, invalidation, derived hook state,
  and surfaced errors.
- API module tests: paths, methods, query parameters, and request payloads.
- Utility tests: LocalDate/timezone behavior, search semantics, currency
  projection availability and provenance, reconciliation rules, and API error
  mappings.

Keep repository-specific semantics visible. For example, saved-view membership
tests cover deterministic response ordering, membership IDs missing from the
complete transaction cache, atomic add/remove deltas, stale additions, and zero
per-ID member fetches. Do not replace such product rules with generic render
assertions.

## MSW (Mock Service Worker)

Use MSW for API-facing behavior so production HTTP code remains on its real
Axios path while the test controls the response. Default handlers live in
`src/testing/mocks/handlers.ts`; override only the behavior needed by a test:

```typescript
server.use(
  http.get('/api/v1/transactions', () =>
    HttpResponse.json({ type: 'UPSTREAM_FAILURE', message: 'Unavailable' }, { status: 503 }),
  ),
);
```

When request shape is part of the frontend contract, inspect the URL, query
parameters, or body inside the handler and assert it after the user action.
Keep API module tests responsible for transport shape and hook tests responsible
for React Query behavior so the same contract is not copied across layers.

Direct module mocks are appropriate when the HTTP boundary is irrelevant—for
example, isolating a page from an already-tested hook or avoiding a retry delay
that is not under test. Some hooks explicitly configure retries, which override
`createTestQueryClient()` defaults; allow enough time for that behavior or use a
focused mock when retries are outside the scenario.

For multipart workflows in jsdom, assert stable frontend-owned behavior: the
selected filename, request URL/query parameters, presence of a request body, and
success or error state. Axios plus MSW may not reliably expose an uploaded
`File` through `request.formData()` in jsdom. A direct API-module test can use a
temporary Axios adapter to verify that `FormData` remains multipart without
sending it through MSW.

Do not broadly silence `console.error` or `console.warn`; they commonly reveal
React, accessibility, and request failures. Use a focused spy only for a known,
intentional noisy path.

## Coverage

```bash
npm run test:coverage
```

Vitest prints the text report and writes HTML plus JSON summary artifacts under
`coverage/`. Global thresholds in `vitest.config.ts` are:

| Metric     | Minimum |
| ---------- | ------: |
| Statements |     80% |
| Branches   |     80% |
| Functions  |     75% |
| Lines      |     80% |

The command exits nonzero when any threshold is missed. `npm run build` uses
this gate before type-checking and bundling, and `.github/workflows/build.yml`
runs the same gate explicitly. Build sequencing belongs to
[Development](development.md#standard-build).

Coverage excludes declarations, colocated tests, shared test infrastructure,
feature type modules and named shared type-only files, configuration files, and
`src/main.tsx`. Use the report to find product-risk gaps; do not add trivial
tests merely to raise a percentage. Raise thresholds only after reviewing the
report and adding behavior-focused coverage.

## External Browser Harness

Playwright exercises the externally managed production-smoke application. It
never starts Vite, Tilt, NGINX, or another server.

### Prerequisites

Before running browser tests:

1. Install repository dependencies with `npm install`.
2. Ensure the Playwright Chromium matching the locked package is available;
   `npx playwright install --list` shows installed browsers, and
   `npx playwright install chromium` installs it when needed.
3. Ask the user to provide a healthy workstation-owned Tilt stack and
   `https://app.budgetanalyzer.localhost/_prod-smoke/` route. Agents must not
   start Tilt or Vite.
4. Verify local CA trust with `check-budget-analyzer-local-ca-trust`. If the
   container copy is stale, run `ensure-budget-analyzer-local-ca-trust` and
   check again. Do not disable HTTPS or certificate verification.

The default base URL is configured in `playwright.config.ts`. An override must
be an absolute, trusted HTTPS URL:

```bash
PLAYWRIGHT_BASE_URL=https://app.budgetanalyzer.localhost/_prod-smoke/ \
  npm run test:e2e:csp
```

Playwright currently uses one desktop Chromium project, one worker, no retries,
and `ignoreHTTPSErrors: false`.

### Commands and Responsibilities

```bash
# Required after changing playwright.config.ts or e2e/
npm run typecheck:e2e

# Environment, fail-closed fixture, and detector self-tests
npm run test:e2e:harness

# Detector self-tests plus strict application CSP workflows
npm run test:e2e:csp
```

`typecheck:e2e` is intentionally separate from normal builds and CI.
Tilt-dependent browser commands are local-only and should not be run for a
documentation-only change.

`test:e2e:harness` distinguishes harness correctness from application proof:

- `e2e/harness/environment.spec.ts` verifies the exact production-smoke route,
  HTTP 200 response, strict CSP directives, and absence of unsafe sources.
- `e2e/harness/fixture-fail-closed.spec.ts` proves unexpected protected
  requests are blocked and missing pre-navigation monitoring fails clearly.
- `e2e/csp/detector.spec.ts` uses controlled allowed and prohibited operations
  to prove the CSP and runtime-stylesheet detector.

Passing these self-tests means the environment and detector work; it does not
mean the application is CSP-clean. `test:e2e:csp` also collects application
workflows under `e2e/csp/`, and a real finding must not be allowlisted or
snapshot-accepted merely to make the command pass.

### Fail-Closed Browser Fixtures

Typed fixtures under `e2e/fixtures/` install the CSP monitor and browser mocks
before navigation. Mocks fulfill only exact `GET /auth/v1/user`,
`GET /auth/v1/session`, and scenario-registered `/api/*` requests. Any other
protected auth/API request is fulfilled with the harness failure status,
recorded, and reported during fixture teardown rather than reaching a backend
service. Shared fixture data uses deterministic IDs and timestamps and never
reads real cookies or backend state.

The monitor records:

- `securitypolicyviolation` events;
- every runtime-added `<style>` element, including one removed before teardown;
- `<style>` elements present in the final DOM; and
- relevant CSP console errors as supporting diagnostics.

Executable failures are policy events or runtime/final stylesheet findings.
Console messages support diagnosis but do not replace policy events. The
monitor deliberately does not collect DOM `style` attributes: allowed client
property writes serialize to that attribute in Chromium without a CSP
violation. Controlled detector cases separately prove allowed property writes
and `CSSStyleDeclaration.cssText`, blocked `setAttribute('style', ...)`, and the
repository ban on transient runtime stylesheets. See
[Architecture](architecture.md#content-security-policy) for the distinction
between browser policy and stricter repository authoring rules.

### Current Coverage and Temporary Gate

The only application workflow currently covered is an authenticated desktop
transaction list with deterministic mocked data: select one row, observe the
bulk-action bar, and clear the selection. The Playwright project is desktop
Chromium only. This is not exhaustive route, form, mobile, dropdown,
cross-browser, or Motion-API evidence.

In particular, the browser suite does not yet cover desktop and mobile dropdown
interaction, real placement and viewport fallback, top-layer clipping escape,
CSP violations, and prohibited runtime/final stylesheets for those workflows.
Until that equivalent coverage exists, the temporary dropdown gate remains in
`npm run build:prod-smoke`; see
[Development](development.md#production-smoke-build-and-dropdown-gate).

### Artifacts

Traces, screenshots, and result context are written under
`test-results/playwright/`. The HTML report is written to
`playwright-report/`. Both paths are ignored and remain local.

## Upstream References

- [Vitest](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [user-event](https://testing-library.com/docs/user-event/intro/)
- [MSW](https://mswjs.io/docs/)
- [Testing React Query](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
- [Playwright Test](https://playwright.dev/docs/intro)
