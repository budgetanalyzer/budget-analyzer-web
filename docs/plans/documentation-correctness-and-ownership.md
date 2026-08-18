# Documentation Correctness and Ownership Plan

Implement Plan 1 from
[`docs/issues/documentation-scripts-tests-audit.md`](../issues/documentation-scripts-tests-audit.md):
correct known documentation drift, give each durable concern one authoritative
document, replace duplicated material with concise links, preserve the
repository-specific React effect rules, and verify every local Markdown link
and referenced repository path. This plan changes documentation only. It does
not retire the dropdown CSP gate, reorganize tests, curate source-code comments,
or edit generated OpenAPI specifications.

## Phase 1: Establish Authentication, API, and State Owners

### Workspace

.

### Goal

Make `docs/authentication.md`, `docs/api-integration.md`, and
`docs/state-architecture.md` accurate, self-contained owners for their assigned
concerns before shorter documents begin linking to them.

### Scope

- Authentication flows, session behavior, roles, permissions, and auth-specific
  troubleshooting in `docs/authentication.md`.
- Frontend API client behavior, response/error handling, and feature-specific
  integration contracts in `docs/api-integration.md`.
- Server, URL, Redux, local, and navigation state ownership in
  `docs/state-architecture.md`.
- Links from these owner documents to generated API specifications and the
  development, architecture, and testing owners.

### Non-goals

- Rewriting `docs/architecture.md`, `docs/development.md`, README files, or
  `AGENTS.md`; later phases reduce their duplicated summaries.
- Changing API, authentication, permission, or state-management behavior.
- Editing generated files under `docs/api/`.

### Required context

- Read `AGENTS.md` and
  `docs/issues/documentation-scripts-tests-audit.md` before editing.
- Treat the generated specifications under `docs/api/` as the endpoint and
  payload-schema owners; do not reproduce an endpoint inventory manually.
- Verify frontend claims against `src/api/`, `src/features/auth/`,
  `src/store/`, relevant route-state hooks and utilities, and `src/App.tsx`.
- Preserve the roles-versus-permissions distinction, self-scope versus `:any`
  rules, rules-of-hooks guidance, and the invariant that denied
  `PermissionGuard` children do not mount.

### Execution steps

1. Inventory the durable contracts and duplicated sections in the three owner
   documents, checking every source path and behavior claim against current
   code and generated API specifications.
2. Refocus `docs/authentication.md` on login/logout/bootstrap, heartbeat and
   expiry behavior, session security, roles, permissions, and auth-specific
   troubleshooting. Replace copied setup, general Axios, build, and test
   instructions with scoped links to their owners.
3. Refocus `docs/api-integration.md` on frontend-specific API behavior. Replace
   the incomplete section presented as all endpoints with links to the unified
   and session-gateway OpenAPI specifications, while retaining documented
   client, collection, error, saved-view, and import-review contracts that are
   specific to this SPA.
4. Update `docs/state-architecture.md` to describe the current division among
   TanStack Query, URL state, Redux preferences, local component state, and
   navigation context. Remove obsolete search, selection, and
   `onFilteredRowsChange` descriptions and use only current local examples.
5. Add concise cross-links where a document touches a concern owned elsewhere,
   without copying the owning document's commands, examples, or rule tables.

### Implementation notes

Keep permission strings and behavioral invariants only where they help maintain
the frontend authorization contract. API prose should explain client behavior,
not compete with generated schemas. Do not turn current component walkthroughs
or temporary UI state into durable documentation.

### Validation

- Use `rg` and direct file reads to confirm every referenced `src/` and
  `docs/api/` path exists.
- Confirm `docs/api-integration.md` no longer labels a partial hand-maintained
  list as the complete endpoint inventory.
- Confirm the three documents assign search and selected-row state to their
  current owners and contain no `onFilteredRowsChange` example.
- Run `git diff --check`.

### Completion criteria

The authentication, frontend API, and state documents are accurate owners of
their concerns, contain no known stale examples or paths, and direct readers to
other owners instead of duplicating their material.

## Phase 2: Make Architecture Own Structure, Browser Support, and CSP

### Workspace

.

### Goal

Make `docs/architecture.md` the concise authority for frontend structure,
browser support, CSP semantics, and architectural integration boundaries.

### Scope

- Feature-based application structure and architectural boundaries.
- Supported browser floor and the native dropdown capabilities that require it.
- Browser CSP semantics and the repository's stricter Tailwind-first and
  no-runtime-stylesheet conventions.
- Short architectural summaries that link to the state and authentication
  owners.

### Non-goals

- Changing CSP implementation, Motion usage, dependencies, browser support, or
  the dropdown static gate.
- Owning setup/build commands, Playwright procedures, detailed permission
  guidance, or detailed state behavior in the architecture document.
- Running Tilt, Vite, or the user-managed browser environment.

### Required context

- Read the audit, the Phase 1 owner documents, `docs/architecture.md`, and the
  strict CSP section of `AGENTS.md`.
- Verify CSP statements against `scripts/check-dropdown-csp.mjs`, the CSP E2E
  detector and fixtures, shared overlay/dropdown primitives, and
  `src/utils/bodyScrollLock.ts`.
- Preserve the distinction between policy-blocked inline styling,
  browser-allowed client property writes, and repository-prohibited application
  authoring patterns.

### Execution steps

1. Reconcile the architecture overview with the actual feature-based `src/`
   tree and describe only durable boundaries and page responsibilities.
2. Reduce state-management detail to an architectural summary and link to
   `docs/state-architecture.md` for ownership rules and feature-specific state
   contracts.
3. Reduce authentication and permission duplication to a security-boundary
   summary and link to `docs/authentication.md` for flows, taxonomy, and gating
   guidance.
4. Consolidate browser support and CSP guidance in this document, retaining the
   correct DOM-style semantics, Tailwind-first rule, runtime stylesheet ban,
   shared scroll-lock and column-width patterns, Motion capability caveats, and
   temporary dropdown gate context.
5. Remove exact emitted Motion chunk sizes and other transient build evidence;
   point operational build and browser-audit procedures to development and
   testing documentation.

### Implementation notes

Capability scans are evidence to investigate, not allowlists and not proof that
every match executes. Do not weaken the rule against React `style` props or
runtime stylesheet injection when correcting the narrower browser CSP claim.

### Validation

- Compare documented directories and named shared utilities with the current
  repository tree.
- Search the updated architecture document for transient Motion byte counts and
  detailed permission/state tables that now belong to other owners.
- Confirm architecture links resolve to the authentication, state,
  development, and testing documents.
- Run `git diff --check`.

### Completion criteria

`docs/architecture.md` accurately owns structure, browser support, and CSP,
while authentication, permissions, state details, commands, and browser-test
procedures are represented only by scoped summaries and links.

## Phase 3: Make Development Own Setup, Commands, Environment, and Builds

### Workspace

.

### Goal

Make `docs/development.md` the single operational reference for local setup,
repository commands, environment configuration, build variants, and container
release behavior.

### Scope

- Supported Node/npm prerequisites and local installation.
- User-managed development runtime and ingress access requirements.
- Current `package.json` scripts and environment variables.
- Standard, production-smoke, and production-container build behavior.
- Links to architecture for CSP semantics and testing for browser harness
  procedures.

### Non-goals

- Changing package scripts, build configuration, CI, containers, or runtime
  behavior.
- Duplicating the complete Playwright operating guide.
- Starting Vite, Tilt, or any other user-managed service.

### Required context

- Read the audit, `docs/development.md`, `package.json`, `.env.example`,
  `Dockerfile`, `Dockerfile.production`, Vite configuration, and relevant GitHub
  Actions workflows.
- Use `docs/architecture.md` as the owner for browser CSP meaning and
  `docs/testing-guide.md` as the owner for test policy and Playwright details.
- The dropdown CSP gate remains required until Plan 2 supplies equivalent
  browser coverage and makes the retirement decision.

### Execution steps

1. Verify all prerequisites, setup instructions, access URLs, scripts,
   environment variables, output paths, and container claims against current
   configuration.
2. Correct the project-structure description so it contains no nonexistent
   top-level `src/pages/` directory and does not duplicate the detailed
   architecture owner.
3. Consolidate standard build, coverage-gated build, production-smoke base
   path, dropdown gate, and production container behavior in the build section.
4. Replace the long Playwright workflow copy with the minimum development
   constraint: the environment is workstation-owned, agents must not start
   servers, and the testing guide owns prerequisites, commands, and artifacts.
5. Remove or correct any claim that the CSP browser audit rejects every
   serialized DOM `style` attribute, linking to architecture for the policy
   distinction.

### Implementation notes

Do not document `npm run lint` as the agent workflow when repository instructions
require `npm run lint:fix`. Keep the production-smoke dropdown check documented
as an active temporary build gate; its removal belongs to Plan 2.

### Validation

- Compare the documented script list with `package.json` and variables with
  `.env.example`.
- Confirm every documented directory, Dockerfile, script, and workflow path
  exists.
- Confirm `docs/development.md` contains no `src/pages/` entry and no claim that
  all final DOM style attributes are CSP failures.
- Run `git diff --check`.

### Completion criteria

Developers can use `docs/development.md` as the accurate setup, command,
environment, and build owner, and it delegates architecture and detailed test
procedures through concise links.

## Phase 4: Curate the Testing Owner

### Workspace

.

### Goal

Make `docs/testing-guide.md` a concise repository-specific owner for test
policy, shared utilities, coverage, and the external Playwright harness.

### Scope

- Vitest, Testing Library, user-event, MSW, and colocated-test conventions.
- Shared test infrastructure and focused/full-suite commands.
- Coverage thresholds and appropriate coverage interpretation.
- Playwright type-checking, workstation-owned prerequisites, harness self-tests,
  application CSP audits, and artifact locations.
- Correct CSP detector semantics and the dropdown gate's current coverage gap.

### Non-goals

- Splitting large tests or changing test coverage; that is Plan 3.
- Adding the dropdown scenarios or retiring/reducing the static gate; that is
  Plan 2.
- Changing test configuration, scripts, mocks, or product code.

### Required context

- Read the audit, `docs/testing-guide.md`, test-related `package.json` scripts,
  `vitest.config.ts`, `src/testing/`, `playwright.config.ts`, and `e2e/`.
- Use `docs/development.md` for setup/build ownership and
  `docs/architecture.md` for CSP semantics.
- Preserve the current distinction between harness self-tests and strict
  application-workflow audits.

### Execution steps

1. Verify commands, thresholds, setup files, mock behavior, Playwright routes,
   and artifact paths against current configuration and test infrastructure.
2. Keep repository-specific policy: tests are colocated, shared infrastructure
   stays under `src/testing/`, new API behavior normally uses MSW, user workflows
   prefer user-event, and tests should cover behavior rather than framework
   implementation details.
3. Reduce generic Testing Library, Vitest, mocking, and debugging tutorials to
   compact local guidance plus authoritative upstream links. Retain examples
   only when they demonstrate a current repository convention or shared helper.
4. Consolidate Playwright instructions here, including CA trust checks,
   externally managed production-smoke route, fail-closed request mocking,
   harness-versus-application commands, CSP evidence semantics, and local
   artifacts.
5. State the temporary dropdown gate's browser-coverage gap and link to the
   architecture/development owners without copying their full CSP or build
   explanations.

### Implementation notes

Documentation-only cleanup is not a reason to run Tilt-dependent browser tests.
Do not claim current single-workflow browser coverage proves every route or
Motion API safe. Do not delete meaningful testing policy merely to reduce line
count.

### Validation

- Compare every documented test command and threshold with `package.json` and
  `vitest.config.ts`.
- Confirm all named setup, mock, Playwright, and artifact paths are current.
- Confirm the guide does not classify every DOM style attribute as a CSP
  violation and does not claim the current browser workflow is exhaustive.
- Run `git diff --check`.

### Completion criteria

`docs/testing-guide.md` is materially shorter, preserves all repository-specific
test and browser-audit contracts, and delegates setup, builds, and CSP meaning
to their owners.

## Phase 5: Consolidate and Correct React Hooks Guidance

### Workspace

.

### Goal

Consolidate the two overlapping React hooks tutorials into one concise,
corrected guide that gives agents enough React lifecycle and effect context to
understand and follow this codebase's decisions.

### Scope

- `docs/useEffect-guide.md` and
  `docs/react-hooks-lifecycle-mental-model.md`.
- `docs/react-hooks-lifecycle-mental-model.md` as the retained React-specific
  guide.
- Links from `AGENTS.md` and documentation files that direct agents to the
  retained guide when working with hooks.
- Concise foundational guidance about render, state, effects, dependencies,
  cleanup, derived values, event handling, and TanStack Query ownership.
- Current local examples of external-system synchronization and cleanup, plus
  small corrected examples where a local source link would not explain the
  rule on its own.

### Non-goals

- Refactoring hooks or components.
- Providing an exhaustive React reference or duplicating API-level details that
  are better maintained by the official React documentation.
- Teaching manual request fetching or effect-based derived-state
  synchronization as application patterns.
- Curating source-code comments such as the `useDebounce` tutorial or URL
  builder examples; that is Plan 4.

### Required context

- Read both existing tutorials and identify useful mental models, rules,
  examples, and repository guidance to preserve before deleting anything.
- Inspect current effects under `src/hooks/`, auth session handling, and shared
  overlay primitives to choose small, accurate local examples.
- Use current official React guidance for external-system synchronization and
  TanStack Query guidance for server state.

### Execution steps

1. Inventory both tutorials and retain the useful lifecycle mental model,
   effect timing and dependency guidance, cleanup guidance, common pitfalls,
   and decision rules rather than discarding material solely because it is
   general React knowledge.
2. Rewrite `docs/react-hooks-lifecycle-mental-model.md` as the single concise
   guide. Explain the render-and-synchronize mental model, when state and
   effects run, dependency and cleanup behavior, and the distinction between
   external systems, derived values, and event-driven work.
3. Preserve the durable repository rules: effects synchronize external
   systems, installed resources need cleanup, server state belongs in TanStack
   Query, and derived values and event handling do not require effects. Support
   them with a few current source links, small corrected examples, and links to
   official React and TanStack Query guidance.
4. Correct or replace misleading examples. Present manual fetching in effects
   only as general React context, if needed to explain why this application
   delegates server state to TanStack Query; do not present it as an
   application pattern. Remove the stale `onFilteredRowsChange` example and
   explain why derived table state should not be synchronized through an
   effect.
5. Add a concise `AGENTS.md` instruction directing agents working with React
   hooks or lifecycle behavior to the retained guide. Update other inbound
   links, then delete `docs/useEffect-guide.md` only after all useful, correct
   guidance has been merged.

### Implementation notes

Keep enough React explanation for the guide to be useful without requiring an
agent to reconstruct the repository's reasoning from rules alone. Prefer links
to current source over copied multi-screen snippets so examples do not drift,
but retain short examples when they materially clarify a lifecycle or effect
decision. Clearly label the difference between valid general React techniques
and the narrower patterns selected by this application.

### Validation

- Search all Markdown for links or references to the removed
  `docs/useEffect-guide.md` filename and for `onFilteredRowsChange`.
- Confirm `AGENTS.md` directs hook-related work to
  `docs/react-hooks-lifecycle-mental-model.md` and all links resolve.
- Confirm each linked local source example exists and still demonstrates the
  stated rule.
- Confirm the consolidated guide includes the lifecycle and dependency context,
  all four preserved repository rules, and no manual-fetch or derived-state
  effect presented as an approved application pattern.
- Run `git diff --check`.

### Completion criteria

`docs/react-hooks-lifecycle-mental-model.md` is a concise but self-sufficient
guide for agents, `AGENTS.md` and other inbound links direct hook-related work
to it, the redundant `docs/useEffect-guide.md` is removed, and useful React
context plus all repository-specific effect and server-state guidance is
preserved without stale or misleading examples.

## Phase 6: Simplify Entry Points and Audit All References

### Workspace

.

### Goal

Finish the ownership model by reducing `README.md`, `docs/README.md`, and
`AGENTS.md` to their intended scopes, then verify all local Markdown links and
repository-path references.

### Scope

- Root landing page and documentation links in `README.md`.
- A compact ownership-oriented index in `docs/README.md`.
- Agent-only rules, guardrails, and working discovery commands in `AGENTS.md`.
- Repository-wide local Markdown link, anchor, and referenced-path validation
  outside generated OpenAPI files.
- Final consistency review across every Plan 1 owner document.

### Non-goals

- Adding onboarding sequences, document status dates, duplicated examples, or
  a second source of truth to the docs index.
- Weakening prerequisite, CSP, component, documentation-discipline, no-dev-
  server, lint-fix, or no-git-write agent guardrails.
- Implementing Plans 2, 3, or 4.

### Required context

- Read all owner documents produced by Phases 1-5 before shortening summaries.
- Use the concern-to-owner table in the audit as the required final ownership
  map.
- Verify discovery commands against the actual repository instead of replacing
  stale paths with guesses.
- Plan files remain ephemeral and must not be linked from non-plan files.

### Execution steps

1. Reduce `README.md` to the project purpose, minimal quick start, feature/stack
   orientation, related repositories, and links to the authoritative documents.
   Remove copied security, CSP, testing, and operating detail that belongs to
   owners.
2. Replace `docs/README.md` with a compact index that names each concern and its
   owner. Remove broken state anchors, stale examples, status dates, onboarding
   sequences, and duplicated contribution rules.
3. Refocus `AGENTS.md` on agent-only boundaries, prerequisites, mandatory
   implementation guardrails, documentation discipline, and useful discovery
   commands. Replace copied architecture, authorization tables, setup/build/test
   walkthroughs, and CSP explanations with terse rules and links while retaining
   enough immediate instruction to prevent unsafe or noncompliant changes.
4. Correct nonexistent discovery references, including the old
   `src/features/transactions/hooks/useTransactions.ts` and
   `src/api/endpoints.ts` paths, and verify every remaining command against the
   current tree.
5. Audit every handwritten Markdown file outside `docs/api/`: resolve relative
   links from the containing file, verify heading fragments using GitHub-style
   generated anchors, and check path literals that purport to name local files
   or directories. Repair every broken or stale reference in scope.
6. Review the complete documentation set for ownership leaks and replace
   repeated commands, rule tables, examples, and explanations with scoped links.
   Preserve the dropdown gate removal condition and keep Plans 2-4 boundaries
   explicit.

### Implementation notes

Shorter agent instructions must remain actionable when opened alone. Keep hard
constraints locally visible, but delegate rationale and changing inventories to
their owners. Do not link README, AGENTS, or other durable docs to this plan or
any file under `docs/plans/`.

### Validation

- Enumerate Markdown links with `rg` and perform a repository-wide local target
  and heading-fragment check from each containing file; report and fix every
  unresolved target outside generated `docs/api/` content.
- Enumerate backticked and command-referenced local paths in the owner docs,
  README files, and `AGENTS.md`; verify each claimed file/directory exists and
  each discovery command succeeds.
- Search for the known stale strings `onFilteredRowsChange`,
  `src/features/transactions/hooks/useTransactions.ts`, `src/api/endpoints.ts`,
  and the removed tutorial filenames; none may remain in active documentation.
- Confirm the dropdown CSP script, its test, package scripts, CI integration,
  and its documented removal condition remain unchanged.
- Confirm no non-plan file links to `docs/plans/`.
- Run `git diff --check` and inspect the full documentation diff for accidental
  loss of durable contracts.

### Completion criteria

Every concern has the owner specified by the audit, entry-point documents are
concise summaries and links, all known drift is corrected, all handwritten
local Markdown links/anchors and repository path references resolve, the
repository-specific React rules remain documented, and Plans 2-4 work has not
been implemented prematurely.
