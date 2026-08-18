# Budget Analyzer Web Agent Instructions

## Repository Position and Scope

- **Archetype:** interface
- **Scope:** budgetanalyzer ecosystem
- **Role:** React SPA connecting browser users to backend services through the
  API gateway
- **Coordinated by:** the sibling orchestration repository
- **Isolated from:** `service-common`, which uses a different technology stack

Agents may read `../orchestration/docs/` and service API specifications, but may
write only in this repository.

Never use Agent or subagent tools for code exploration. Use Grep, Glob, and Read
directly.

## Prerequisites First

Before implementing a plan or feature, check its documented prerequisites. Read
the [development prerequisites](docs/development.md#prerequisites) when tools,
local environment, setup, or runtime assumptions apply. If a prerequisite is
unsatisfied, stop and report it. Do not add a local workaround for a missing
cross-repository dependency.

## Documentation Discipline

Keep the nearest durable documentation current in the same change:

- `AGENTS.md` for agent rules, guardrails, and discovery commands
- `README.md` for repository purpose, minimal usage, and documentation links
- `docs/` for architecture, configuration, APIs, behavior, and operations

Update `AGENTS.md` when agent instructions, guardrails, workflows, or discovery
commands change. When updating `AGENTS.md`, review the
[AGENTS.md checkstyle](https://github.com/budgetanalyzer/orchestration/blob/main/docs/agents-md-checkstyle.md)
and preserve or intentionally re-home unique repository guidance.

Record durable contracts and decisions, not component walkthroughs, transient
UI state, duplicated explanations, or unrelated formatting churn. The
[documentation index](docs/README.md) identifies the owner for each concern.
Plan files under `docs/plans/` are ephemeral; never link to them from non-plan
files. Do not leave required documentation updates as follow-up work.

Plans intended for AI Session Handler must follow the
[canonical plan format](../ai-session-handler/docs/plan-format.md), replace every
placeholder, and retain numbered `## Phase N: Title` headings. Run a plan with:

```bash
ai-session-handler run \
  --plan docs/plans/PLAN.md \
  --max-phases 999 \
  --quiet \
  --agent-cmd "../ai-session-handler/.venv/bin/ai-session-handler-codex-high --model MODEL"
```

Omit `--model MODEL` to use the wrapper's configured or default model.

## Authoritative Documentation

| Concern                               | Owner                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Setup, commands, environment, builds  | [Development](docs/development.md)                                                                            |
| Structure, browser support, CSP       | [Architecture](docs/architecture.md)                                                                          |
| Authentication, sessions, permissions | [Authentication](docs/authentication.md)                                                                      |
| Frontend API behavior                 | [API integration](docs/api-integration.md)                                                                    |
| Endpoint schemas and payloads         | [Unified API](docs/api/budget-analyzer-api.yaml) and [Session Gateway API](docs/api/session-gateway-api.yaml) |
| State placement                       | [State architecture](docs/state-architecture.md)                                                              |
| Tests, coverage, Playwright           | [Testing guide](docs/testing-guide.md)                                                                        |
| Hooks, lifecycle, effects             | [React hooks guide](docs/react-hooks-lifecycle-mental-model.md)                                               |

Consult these owners when the corresponding work applies:

- Read Development before changing setup, environment, build behavior, or
  repository commands, and when a build or local-runtime prerequisite fails.
- Read Architecture before changing application structure, browser support,
  CSP policy, UI dependencies, Motion usage, or overlay behavior.
- Read Authentication before changing sessions, roles, permissions, route
  protection, or action gating.
- Read API integration and the generated API specifications before changing
  request behavior, endpoint usage, payloads, forms constrained by schemas, or
  application error-code handling.
- Read State architecture before choosing or changing placement in TanStack
  Query, the URL, Redux, component state, or navigation state.
- Read the Testing guide before adding or changing tests, coverage, Playwright,
  or shared test infrastructure, and when a verifier or browser harness fails.
- Read the React hooks guide before changing hooks, effects, subscriptions,
  timers, listeners, or other lifecycle behavior.

## Implementation Guardrails

### Architecture and API boundaries

- Keep feature code under `src/features/`; features must not import from other
  features. Put shared code in the appropriate top-level `src/` directory.
- Use the `@/*` alias instead of relative source imports.
- Components use TanStack Query hooks and mutation callbacks; they do not call
  Axios directly or copy server data into Redux.
- Match generated OpenAPI constraints in forms and keep
  `src/utils/errorMessages.ts` synchronized with backend application codes.
- Access the local application through
  `https://app.budgetanalyzer.localhost`, not the Vite port.

### React and components

Read the [hooks guide](docs/react-hooks-lifecycle-mental-model.md) before
changing hooks or lifecycle behavior.

- Use effects only to synchronize external systems such as DOM APIs, timers,
  listeners, subscriptions, and imperative libraries. Clean up installed or
  acquired resources.
- Derive values during render, run user-driven work in event handlers, and use
  TanStack Query for server state.
- Keep components synchronous. Use `mutate(data, { onSuccess, onError })`
  instead of `mutateAsync` with component-level `async`/`await`.
- Memoize functions passed as props with `useCallback`.
- Do not put IIFEs, multi-line logic, or inline function definitions in JSX
  props; extract named callbacks or helpers.
- Never disable an ESLint rule without permission.

### Authorization

- Roles choose layout chrome; never use `isAdmin` to gate an action.
- Permissions gate actions and feature access. Use `PermissionGuard` for a
  route or subtree and `usePermission` for an individual affordance.
- Denied `PermissionGuard` children must remain unmounted so their queries do
  not run.
- Use unscoped transaction permissions for a user's own data and `:any` only
  for distinct cross-user features.
- Call `usePermission` only at hook-safe top-level sites, never inside a filter,
  loop, or callback.

The [authentication owner](docs/authentication.md#roles-and-permissions)
contains the complete taxonomy and gating guidance.

### Centralized conventions

- Define reusable animations in `src/lib/animations.ts`.
- Import date behavior only through `src/utils/dates.ts`, never directly from
  `date-fns`. LocalDate values have no timezone; ISO 8601 values do.
- Add dynamic table width mappings to `src/utils/columnWidth.ts`; never use a
  React `style` prop.
- Use `src/hooks/useToast.ts` and `src/components/ui/Toast.tsx` for toasts,
  never `sonner`.
- Shared `src/components/ui/Table.tsx` owns horizontal overflow. Feature tables
  must not hide its native scrollbar.
- Do not add tooltips; information must remain available on mobile.

### Strict CSP

Application code must comply with `style-src 'self'` without `unsafe-inline` or
`unsafe-eval` and with the repository's stricter Tailwind-first conventions.

- Never add React `style={...}` props.
- Never add application code or dependencies that create runtime `<style>`
  elements, insert CSSOM rules, write stylesheet content, or generate CSS with
  `eval()` or `new Function()`.
- Use `acquireBodyScrollLock()` from `src/utils/bodyScrollLock.ts` for overlay
  scroll locks.
- Treat bundle matches as capabilities to investigate, not as an allowlist or
  proof of execution. A serialized DOM `style` attribute alone is not proof of
  a browser CSP violation.
- Before adding a UI dependency, changing Motion usage or versions, or changing
  overlays, follow the static-scan and browser-audit requirements in
  [Architecture](docs/architecture.md#content-security-policy),
  [Development](docs/development.md#production-smoke-build-and-dropdown-gate),
  and [Testing](docs/testing-guide.md#external-browser-harness).

### Testing

- Put production-code tests beside their owner in `__tests__/`; reserve
  `src/testing/` for shared infrastructure.
- Add a meaningful test for new behavior or explain explicitly why none is
  needed.
- Use MSW for new API-facing behavior unless a direct module mock is
  intentionally narrower.
- Prefer `@testing-library/user-event` for workflows and `fireEvent` only for
  low-level synthetic events.
- Test product behavior, not native browser, React, TypeScript, or third-party
  library behavior.
- Changes to `playwright.config.ts` or `e2e/` require
  `npm run typecheck:e2e`. Browser tests require the user-managed environment;
  agents must not start Tilt or Vite.

## Working Rules

- Never run `npm run dev`; the user controls the development server.
- Use `npm run lint:fix`, not `npm run lint`, for agent validation.
- Never perform git write operations such as commit, push, checkout, or reset
  without an explicit user request. The user controls git operations.

## Validation

Before finishing, run the gates that apply to the changed surface:

- Documentation-only changes: verify changed links and referenced paths, then
  run `git diff --check`. Application tests are not required when runtime,
  build, and test behavior are unchanged.
- Application, test, and E2E source: format changed files with the repository's
  Prettier configuration. Run `npm run format` only when its scope contains no
  unrelated user work.
- Production application changes: run `npm run lint:fix`, focused Vitest tests
  while iterating, and `npm run build` before handoff. The build includes the
  full coverage, TypeScript, and bundle gates.
- Test-only changes: run `npm run lint:fix` and the affected tests. Run
  `npm run test:coverage` when changing shared test infrastructure, coverage
  configuration, or behavior exercised across features.
- Changes to `playwright.config.ts` or `e2e/`: run `npm run lint:fix` and
  `npm run typecheck:e2e`. Run browser tests only when the user-managed
  environment is available and the Testing guide requires them.
- UI dependency, Motion, overlay, or CSP-sensitive changes: also run the static
  scan and browser-audit gates required by the Strict CSP section.

If a required verifier cannot run because a tool, credential, service, browser,
or user-managed environment is unavailable, report that explicitly. Do not
claim the work is fully verified.

## Discovery Commands

```bash
# API routes provided by orchestration
rg -n "location" ../orchestration/nginx/nginx.k8s.conf

# Generated API specifications
ls docs/api/budget-analyzer-api.yaml docs/api/session-gateway-api.yaml

# Package scripts and dependencies
jq '.scripts' package.json
jq '.dependencies' package.json

# Source structure, API adapters, and shared hooks
find src -maxdepth 2 -type d | sort
find src/api -maxdepth 1 -type f | sort
find src/hooks src/features -type f \( -name 'use*.ts' -o -name 'use*.tsx' \) | sort

# Route composition, API client, and Redux preferences
sed -n '1,340p' src/App.tsx
sed -n '1,240p' src/api/client.ts
sed -n '1,220p' src/store/uiSlice.ts
```

The generated specifications are refreshed by
`../orchestration/scripts/repo/generate-unified-api-docs.sh`.

## Honest Discourse

- State problems directly and distinguish evidence from assumptions.
- Push back on vague or conflicting requirements with concrete constraints.
- Do not over-validate ideas or hide unresolved tradeoffs behind praise.
