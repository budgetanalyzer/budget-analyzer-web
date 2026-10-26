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

`.github/workflows/dependency-audit.yml` runs weekly on `main`, supports
manual execution on `main`, and runs on pull requests to `main` that change
`package.json`, `package-lock.json`, or the workflow itself. Each pull request
has its own concurrency group, so a new push cancels the superseded run;
scheduled and manual runs share one non-cancelling group. The workflow uses no
secrets. It installs exactly `package-lock.json` with `npm ci`, then
independently captures:

- `npm audit --json` as `npm-audit-full.json`;
- `npm audit --omit=dev --json` as `npm-audit-production.json`.

The workflow uploads `dependency-audit-reports` directly as the single
`npm-audit-reports` artifact and retains it for seven days. A successful run
must include the audit status and both complete audit reports; incomplete
successful-run evidence fails under the shared orchestration policy. The job
summary presents severity counts for the two audit scopes.

An npm audit exit status caused by findings does not fail scheduled, manual, or
pull-request runs; the backlog remains visible in the job summary and artifact
without blocking unrelated pull requests. Missing or malformed JSON, an
npm-reported registry error, an unexpected command status, or an `npm ci`
failure does fail the workflow, including on pull requests. Installation errors
remain separate in the named install step's log. Audit errors and any partial
reports are still uploaded by the always-run evidence step when the report
directory is available, while the original error keeps the workflow failed.

Do not make this workflow a required status check while its pull-request
trigger is path-filtered: pull requests outside the filter never run it, so a
required check would wait indefinitely.

Audit reports are inputs to human triage, not proof of reachability. In
particular, development-server findings are not production-browser findings,
and this SPA does not use React Server Components or React Router's
server/framework modes. Those distinctions inform priority but do not justify
dropping findings from the full report.

## Bot pull request checks

Every Renovate pull request targets `main` and remains non-automerged. The
`Build` pull-request workflow runs locked installation, ESLint, the Vitest
coverage gate, the production-smoke CSP gate, and the standard TypeScript/Vite
bundle. Changes to image build inputs also run the
[image build check](#image-build-check). Reviewers must inspect release notes,
the resolved lockfile change, browser and SSR/RSC applicability, strict-CSP
behavior, and Node/image platform compatibility.

The [development guide](development.md#repository-commands) owns local build and
validation commands. CSP-sensitive dependency changes must also follow the
[architecture CSP contract](architecture.md#content-security-policy) and the
[external browser harness](testing-guide.md#external-browser-harness); the bot
cannot infer runtime stylesheet injection or mobile/browser compatibility from
a successful package lookup.

### Image build check

`.github/workflows/image-build-check.yml` (`Image Build Check`) runs on pull
requests to `main` that change `Dockerfile`, `Dockerfile.production`,
`.dockerignore`, `nginx.production.conf`, `package.json`, `package-lock.json`,
or the workflow itself, and on manual dispatch. Application source is excluded
because the `Build` workflow already compiles and tests it on every pull
request.

A `fail-fast: false` matrix builds each image for `linux/arm64` with the
repository root as context:

- `Dockerfile.production`, the release image built by `publish-release.yml`.
  Its `build` stage runs on BuildKit's build platform, so only the NGINX
  runtime stage is arm64. This entry proves the arm64 NGINX base manifest, the
  `nginx.production.conf` copy, and the coverage-gated build inside the image.
- `Dockerfile`, the development image built by the orchestration `Tiltfile`.
  It runs `npm ci` under arm64 emulation, so this entry is what proves the
  arm64 Node base manifest and `npm ci` resolution of the lockfile's
  platform-specific optional binaries.

The check does not log in to a registry, tag, push, or cache images, and passes
no secrets. It does not prove runtime behavior, the Vite development server,
NGINX routing, or strict-CSP behavior, and it does not scan for
vulnerabilities. Emulated builds are slow; each entry has a 30-minute timeout.
`Dockerfile.dev` is not built because it has no known consumer.

Do not make this check a required status check while it is path-filtered:
pull requests outside the filter never run it, so a required check would wait
indefinitely.
