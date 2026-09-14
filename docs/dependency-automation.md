# Dependency Automation

**Status:** Local configuration and audit workflow prepared; automation is not
installed or active. Authenticated acceptance is pending the system-wide
activation phase.

This repository uses Renovate as the sole owner of dependency-update pull
requests. GitHub's dependency graph and Dependabot alerts provide alert-only
vulnerability evidence; Dependabot version-update and security-update pull
requests must remain disabled. The shared operating policy is owned by the
[orchestration dependency-automation guide](https://github.com/budgetanalyzer/orchestration/blob/main/docs/dependency-automation.md).

## Update discovery

`renovate.json` extends the Budget Analyzer shared preset. Renovate discovers:

- direct npm dependencies and lockfile selections from `package.json` and
  `package-lock.json`;
- Node and NGINX build/runtime images, tags, and digests in all three
  Dockerfiles;
- pinned GitHub Actions and `actions/setup-node` runtime inputs in the workflow
  files.

Routine updates and lockfile maintenance run on the shared weekly schedule.
React and React DOM updates are grouped, as are the Vitest runner, UI, and
coverage packages. The shared policy disables automerge, keeps patch, minor,
and major proposals distinguishable, and requires Dependency Dashboard approval
for majors. Toolchain majors such as TypeScript, Vite, Vitest, ESLint, Tailwind,
React Router, and Node therefore remain visible for compatibility review rather
than being excluded or constrained to historical target versions.

Lockfile maintenance is discovery work, not permission to run `npm audit fix` or
silently refresh the checked-in lockfile during onboarding. Review dependency
and lockfile diffs together. For image updates, retain immutable digests and
verify the selected tag/digest supports the required platform before merging.

## Audit evidence

`.github/workflows/dependency-audit.yml` preserves weekly and manual operation on
`main` and also accepts direct runs of the exact trial ref. It installs exactly
`package-lock.json` with `npm ci`, then independently captures:

- `npm audit --json` as `npm-audit-full.json`;
- `npm audit --omit=dev --json` as `npm-audit-production.json`.

On `main`, download the seven-day `npm-audit-reports` artifact from the workflow
run to compare the raw JSON reports. Trial runs start with schedules, optional
npm caching, and uploads off. They measure the complete report directory and can
upload only one sealed one-day archive beneath the 25 MiB cap after the operator
enables the repository upload variable. The job summary presents severity counts
for the two scopes and the trial archive measurement.

An npm audit exit status caused by findings does not fail this scheduled report;
the existing backlog remains visible without blocking unrelated pull requests.
Missing or malformed JSON, an npm-reported registry error, an unexpected command
status, or an `npm ci` failure does fail the workflow. Installation errors remain
separate in the named install step's log, while audit errors and partial report
files remain available through the always-upload artifact step.

`build.yml` also accepts pushes to the exact trial branch and pull requests based
on either `main` or that branch. Trial builds disable the optional npm cache and
measure `dist`, coverage output, and the complete build log before any upload.
The exact schedule, cache, and upload variables are owned by the
[orchestration trial workflow policy](../../orchestration/docs/dependency-automation.md#trial-workflow-controls).
Production `main` build uploads remain unchanged; release publishing is outside
the trial changes.

The credential-free onboarding run on 2026-09-06 reproduced the saved review
against the unchanged lockfile:

| Scope                   | Critical | High | Moderate | Low | Total | Top-level vulnerable paths                                                                                                                                                                                                                                                            |
| ----------------------- | -------: | ---: | -------: | --: | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full dependency tree    |        3 |   13 |        2 |   2 |    20 | `@babel/core`, `@humanfs/node`, `@vitest/coverage-v8`, `@vitest/ui`, `axios`, `brace-expansion`, `browserslist`, `fflate`, `flatted`, `form-data`, `js-yaml`, `nanoid`, `picomatch`, `postcss`, `postcss-selector-parser`, `react-router`, `react-router-dom`, `vite`, `vitest`, `ws` |
| Production dependencies |        0 |    4 |        0 |   0 |     4 | `axios`, `form-data`, `react-router`, `react-router-dom`                                                                                                                                                                                                                              |

Both commands returned status 1 because findings exist, produced valid
vulnerability metadata, and reported no registry error. Compare advisory and
package identities in future runs rather than relying on the historical total:
new advisories can appear while old ones are remediated.

Reachability and runtime applicability remain human triage. In particular,
development-server findings are not production-browser findings, and this SPA
does not use React Server Components or React Router's server/framework modes.
Those distinctions inform priority but do not justify dropping findings from the
full report.

## Credential-free validation evidence

The onboarding extraction ran under Node 24 with Renovate 44.65.5 and found 65
dependency occurrences across seven files: 44 npm declarations, five Dockerfile
declarations across all three Dockerfiles, and 16 GitHub Actions declarations
across all three workflows. The Dockerfile set included the three Node build
images, the NGINX runtime image, and the Dockerfile syntax image. The Actions set
included pinned action versions and both `actions/setup-node` Node 22 inputs.

Public npm lookups produced current-line and later-major proposals, including
the saved review's React, React Router, Axios, Vite, Vitest, and PostCSS package
identities. Later TypeScript, Vite, Vitest, ESLint, Tailwind, and React Router
lines remained visible. React/React DOM and all three direct Vitest packages
resolved onto their respective grouped branches, and the enabled lockfile
maintenance configuration produced a distinct maintenance branch.

GitHub Actions and setup-node lookups reported `github-token-required`; those
authenticated lookups are deliberately pending the activation phase. The local
Docker Hub lookup did not authenticate and remains an unresolved environment
limitation: Renovate repeatedly emitted
`ERR_SOCKET_CLOSED_BEFORE_CONNECTION` while obtaining anonymous Docker tokens
and recorded `no-result` for `node` and `nginxinc/nginx-unprivileged`. Direct
anonymous checks of Docker's token endpoint succeeded, so this is not recorded
as an authentication deferral or a successful image lookup. No runtime-image
proposal from the local run is accepted as evidence; activation must demonstrate
the hosted lookups or stop for diagnosis.

## Bot pull request checks

Every Renovate pull request remains non-automerged. The existing `Build`
pull-request workflow runs locked installation, ESLint, the Vitest coverage gate,
the production-smoke CSP gate, and the standard TypeScript/Vite bundle. Reviewers
must also inspect release notes, the resolved lockfile change, browser and SSR/RSC
applicability, strict-CSP behavior, and Node/image platform compatibility.

The [development guide](development.md#repository-commands) owns local build and
validation commands. CSP-sensitive dependency changes must also follow the
[architecture CSP contract](architecture.md#content-security-policy) and the
[external browser harness](testing-guide.md#external-browser-harness); the bot
cannot infer runtime stylesheet injection or mobile/browser compatibility from
a successful package lookup.

## Phase 12 hosted and authenticated evidence handoff

No GitHub, registry, or Mend credentials are required or used during local
preparation. The activation operator must complete and retain these checks:

1. Publish the orchestration preset, install the free Mend Renovate Community
   App for this repository, and retain the hosted Renovate log or Dependency
   Dashboard URL proving the preset resolves and npm, lockfile-maintenance,
   Dockerfile, GitHub Actions, and setup-node inputs are discovered without
   authentication, configuration, timeout, or lookup failures. In particular,
   prove successful lookups for `node` and `nginxinc/nginx-unprivileged`; if the
   local anonymous-token socket failure repeats in the hosted run, stop
   activation and diagnose it rather than treating extraction alone as update
   coverage.
2. Dispatch or observe `.github/workflows/dependency-audit.yml` on trusted
   `main`. Retain the successful workflow URL and `npm-audit-reports` artifact
   proving `npm ci` succeeded and both raw JSON scopes were captured. A findings
   exit status is expected; installation, registry, and malformed-report errors
   must still fail the job.
3. Confirm the dependency graph and Dependabot alerts are enabled while
   Dependabot update pull requests remain disabled. Retain alert URLs and map
   advisory/package identities to the two audit reports, including explained
   misses and production-versus-development applicability.
4. Retain the successful existing `Build` workflow URL for representative bot
   pull requests, including lockfile maintenance and a toolchain-major proposal
   after dashboard approval.

The orchestration coverage report owns final cross-repository acceptance. Local
preparation does not activate Renovate, prove hosted audit execution, or establish
vulnerability-review parity.
