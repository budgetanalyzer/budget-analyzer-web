# Dependency Automation

This repository uses Renovate as the sole owner of dependency-update pull
requests. GitHub's dependency graph and Dependabot alerts provide alert-only
vulnerability evidence; Dependabot version-update and security-update pull
requests must remain disabled. The shared operating policy is owned by the
[orchestration dependency-automation guide](https://github.com/budgetanalyzer/orchestration/blob/main/docs/dependency-automation.md).

## Update discovery

`renovate.json` extends the Budget Analyzer shared production preset. Renovate
discovers:

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

Lockfile maintenance is discovery work, not permission to run `npm audit fix`
or silently refresh the checked-in lockfile. Review dependency and lockfile
diffs together. For image updates, retain immutable digests and verify the
selected tag/digest supports the required platform before merging.

## Audit evidence

`.github/workflows/dependency-audit.yml` runs weekly on `main` and supports
manual execution on `main`. It installs exactly `package-lock.json` with
`npm ci`, then independently captures:

- `npm audit --json` as `npm-audit-full.json`;
- `npm audit --omit=dev --json` as `npm-audit-production.json`.

The workflow packages only `dependency-audit-reports` into one gzip archive.
The helper rejects a compressed payload above 24 MiB (25,165,824 bytes), and
the workflow uploads the precompressed archive with upload-action compression
disabled. The `npm-audit-reports` artifact is retained for seven days. The job
summary presents severity counts and the archive measurement for the two audit
scopes.

An npm audit exit status caused by findings does not fail this scheduled report;
the backlog remains visible without blocking unrelated pull requests. Missing
or malformed JSON, an npm-reported registry error, an unexpected command
status, or an `npm ci` failure does fail the workflow. Installation errors
remain separate in the named install step's log. Audit errors and any partial
reports are still packaged by the always-run evidence steps when the report
directory is available.

Audit reports are inputs to human triage, not proof of reachability. In
particular, development-server findings are not production-browser findings,
and this SPA does not use React Server Components or React Router's
server/framework modes. Those distinctions inform priority but do not justify
dropping findings from the full report.

## Bot pull request checks

Every Renovate pull request targets `main` and remains non-automerged. The
`Build` pull-request workflow runs locked installation, ESLint, the Vitest
coverage gate, the production-smoke CSP gate, and the standard TypeScript/Vite
bundle. Reviewers must inspect release notes, the resolved lockfile change,
browser and SSR/RSC applicability, strict-CSP behavior, and Node/image platform
compatibility.

The [development guide](development.md#repository-commands) owns local build and
validation commands. CSP-sensitive dependency changes must also follow the
[architecture CSP contract](architecture.md#content-security-policy) and the
[external browser harness](testing-guide.md#external-browser-harness); the bot
cannot infer runtime stylesheet injection or mobile/browser compatibility from
a successful package lookup.
