# Development Guide

This document owns local setup, repository commands, environment variables,
build variants, and container behavior. See [Architecture](architecture.md) for
application structure and CSP semantics, and [Testing](testing-guide.md) for test
policy and the Playwright operating guide.

## Prerequisites

- Node.js 20+
- npm 10+ for the supported orchestration/Tilt workflow
- The sibling repositories and platform prerequisites required by the
  [orchestration setup](https://github.com/budgetanalyzer/orchestration/blob/main/docs/development/getting-started.md)

This repository uses `package-lock.json`; use npm so dependency resolution stays
consistent with CI and the container builds.

## Installation and Local Runtime

Install the frontend dependencies and create a local environment file:

```bash
npm install
cp .env.example .env
```

The supported full-stack runtime is owned by the sibling orchestration
repository. Its host-managed `./setup.sh` and `tilt up` flow creates the local
cluster, TLS, ingress, backend services, and the Vite workload. Do not start
Tilt, Vite, or another development server on a user's behalf.

Once the workloads are healthy, open:

```text
https://app.budgetanalyzer.localhost
```

Do not browse directly to `http://localhost:3000`. Authentication, protected API
routing, TLS, and same-origin behavior depend on the Istio ingress route. The
sibling [local-environment guide](https://github.com/budgetanalyzer/orchestration/blob/main/docs/development/local-environment.md)
owns platform startup, local CA trust, Tilt, and ingress troubleshooting.

The development `Dockerfile` runs Vite as non-root UID/GID `1001` on port
`3000`. Tilt relies on `npm run dev -- --host 0.0.0.0 --port 3000` and syncs
frontend changes into that workload for HMR.

## Repository Commands

The scripts in `package.json` are:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite on port `3000`; user-managed local runtime only |
| `npm run preview` | Preview the most recent Vite build locally |
| `npm run build` | Run the coverage gate, TypeScript check, and standard production bundle |
| `npm run build:bundle` | Run the TypeScript check and standard production bundle without coverage |
| `npm run build:prod-smoke` | Build at `/_prod-smoke/` and run the temporary dropdown CSP gate |
| `npm run check:csp:dropdown` | Scan an existing `dist/`, source imports, and package metadata for known dropdown blockers |
| `npm run lint` | Check ESLint with zero warnings; used by CI |
| `npm run lint:fix` | Apply ESLint fixes, then fail on remaining errors or warnings; required agent workflow |
| `npm run format` | Format application, E2E, and Playwright source covered by the script |
| `npm test` | Run Vitest in watch mode |
| `npm run test:coverage` | Run Vitest once with V8 coverage and enforce thresholds |
| `npm run test:ui` | Start the Vitest UI |
| `npm run typecheck:e2e` | Type-check Playwright configuration and E2E sources |
| `npm run test:e2e:harness` | Run Playwright environment, fail-closed fixture, and CSP-detector self-tests |
| `npm run test:e2e:csp` | Run detector self-tests and strict application CSP workflows |

Use `npm run lint:fix` for agent changes; do not run `npm run lint` first. Changes
to `playwright.config.ts` or `e2e/` require an explicit
`npm run typecheck:e2e`. Focused and full-suite commands, browser prerequisites,
and artifacts are documented in the [Testing Guide](testing-guide.md).

## Environment Variables

Vite reads variables from `.env` and its standard mode-specific files. The
checked-in `.env.example` documents the supported frontend variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `/api` | Same-origin base path used by the Axios client |
| `VITE_HEARTBEAT_INTERVAL_MS` | `120000` | Interval between active-session heartbeat calls |
| `VITE_WARNING_BEFORE_EXPIRY_SECONDS` | `120` | Lead time for the inactivity-expiry warning |

Keep `VITE_API_BASE_URL=/api` for the local ingress topology. Auth routes use
root-relative session-gateway paths and are not derived from this variable.
Authentication behavior is documented in
[Authentication and Authorization](authentication.md); transport behavior is
documented in [API Integration](api-integration.md).

## Project Structure

Feature pages, components, hooks, and utilities live under `src/features/`.
Shared infrastructure lives in top-level directories such as `src/api/`,
`src/components/`, `src/hooks/`, `src/lib/`, `src/store/`, `src/types/`, and
`src/utils/`; shared test support lives in `src/testing/`. Pages remain inside
their owning features rather than a separate top-level page directory.

[Architecture](architecture.md#application-structure) owns the detailed source
boundaries and feature organization.

## Build & Deployment

All Vite build variants replace `dist/` with their output.

### Standard Build

```bash
npm run build
```

`build` runs `npm run test:coverage` and then `npm run build:bundle`.
`build:bundle` runs `tsc` followed by `vite build` and produces assets served
from `/`. The coverage gate requires `80%` statements, `80%` branches, `75%`
functions, and `80%` lines; the [Testing Guide](testing-guide.md#coverage) owns
coverage interpretation and exclusions.

The build workflow in `.github/workflows/build.yml` installs with `npm ci`,
lints, runs coverage, builds and checks the production-smoke variant, then
rebuilds the standard `/` bundle for the uploaded `dist/` artifact.

### Production-Smoke Build and Dropdown Gate

```bash
npm run build:prod-smoke
```

This variant runs `tsc`, builds with the base path `/_prod-smoke/`, and then
runs `scripts/check-dropdown-csp.mjs`. Auth and API requests remain
root-relative. The sibling Tilt stack serves the resulting bundle at
`https://app.budgetanalyzer.localhost/_prod-smoke/` while the normal `/` route
continues to serve the Vite development application.

The dropdown check scans emitted text assets for known stylesheet-injection,
Radix menu, and `react-remove-scroll` signatures. It also rejects the former
Radix dropdown dependency in production source imports, `package.json`, and
`package-lock.json`. The standalone `npm run check:csp:dropdown` command expects
`dist/` to exist and fails closed if it cannot scan it.

This is an active, temporary dropdown-specific gate, not a general CSP proof.
It remains until equivalent desktop and mobile dropdown browser coverage exists.
The [Architecture CSP section](architecture.md#content-security-policy) owns the
policy meaning and removal condition; the
[external browser harness](testing-guide.md#external-browser-harness) owns
runtime evidence and current coverage limits.

### Production Container

`Dockerfile.production` is the release image definition:

1. A Node 20 build stage installs with `npm ci` and runs the full
   coverage-gated `npm run build`.
2. An unprivileged NGINX image serves the static bundle on port `3000` using
   `nginx.production.conf`.

The Node stage is pinned to BuildKit's native build platform. The release
workflow can therefore build the requested `linux/arm64` runtime image without
running Vitest through target-architecture emulation. NGINX provides the SPA
fallback, a `/health` endpoint, immutable caching for `/assets/`, and no-cache
headers for application routes.

`.github/workflows/publish-release.yml` publishes the GHCR image for strict
`vX.Y.Z` tags or an explicit manual source ref and Docker label. It does not
publish `latest` and prints the digest-pinned image reference. Deployment and
release-inventory procedures are owned by the sibling
[orchestration CI/CD guide](https://github.com/budgetanalyzer/orchestration/blob/main/docs/ci-cd.md).
