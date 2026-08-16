# Strict CSP Runtime Style Dependencies

**Status:** Open

## Problem

The application requires `style-src 'self'` without `'unsafe-inline'` or
`'unsafe-eval'`, and repository policy also prohibits runtime style attributes,
dynamic `<style>` elements, and CSSOM rule injection. The production source
follows those rules, but the generated bundle contains style-manipulation paths
from existing runtime dependencies.

This is a pre-existing repository-wide CSP hardening issue. Its known baseline
matches must not block unrelated implementation plans, but new source or bundle
matches still require investigation.

## Current Evidence

Run the production smoke build:

```bash
npm run build:prod-smoke
```

The build and the existing dropdown CSP gate pass. The broader bundle scan does
not return cleanly:

```bash
rg -n "createElement\(['\"]style['\"]\)|setAttribute\(['\"]style|document\.(body|documentElement)\.style|styleSheet\.cssText|insertRule\(|eval\(|new Function\(" dist/
```

Known baseline findings:

- The Framer Motion chunk contains an `AnimatePresence` pop-layout helper that
  creates a `<style>` element and calls `insertRule()`.
- The React DOM chunk contains generic renderer support for style elements and
  style properties. A literal zero-match scan therefore cannot distinguish
  application behavior from dormant renderer capability.
- Application source currently has no `AnimatePresence mode="popLayout"` use;
  it uses the default mode and `mode="wait"`. This makes the specific Motion
  pop-layout injector dormant, but does not prove that normal Motion animations
  avoid runtime style attributes.
- The application imports `motion`, `AnimatePresence`, and `LayoutGroup` across
  transactions, saved views, analytics, admin pages, and shared components.
  Framer Motion must be treated as an application-wide CSP risk until verified
  or removed.

Inventory current Motion usage with:

```bash
rg -n "AnimatePresence|LayoutGroup|from ['\"]framer-motion|<motion\." \
  src --glob '*.{ts,tsx}'
```

The application-source scan currently finds only explanatory CSP comments:

```bash
rg -n "style=|\.style\.|setAttribute\(['\"]style|createElement\(['\"]style|cssText|insertRule|eval\(|new Function\(" \
  src --glob '*.{ts,tsx,js,jsx}'
```

### Runtime browser evidence

Run the repository audit against the trusted, externally managed
production-smoke route:

```bash
check-budget-analyzer-local-ca-trust
npm run test:e2e:csp
```

The basic application scenario authenticates with deterministic browser
fixtures, renders the transaction list, selects one transaction to reveal the
bulk-action bar, and clears the selection to dismiss it. The monitor is active
before application scripts run and remains active through the whole workflow.
Exact auth/session and scenario API requests are mocked; no real protected
service data is captured.

The current run fails the strict product audit. It reports runtime `style`
attribute changes on the selection-dependent fixed action bar and transaction
statistics elements, plus final DOM `style` attributes on statistics elements.
It did not report a product-side dynamic `<style>` insertion or a
`securitypolicyviolation` event in this exercised workflow. These are observed
DOM categories, not proof that a particular dependency caused them. The source
inventory above correlates the route with Motion usage, while causation remains
to be established during remediation.

`npm run test:e2e:harness` is separate acceptance evidence for detector and
fixture correctness: its controlled mutation test passes only after confirming
that prohibited style behavior is detected and rejected. A passing detector
self-test must not be interpreted as product cleanliness. Product-audit
screenshots, traces, and error context remain local under
`test-results/playwright/`; the HTML report is under `playwright-report/`.

## Why the Existing Scan Is Insufficient

A raw bundle substring is useful for discovery but is not proof that a path is
reachable. Conversely, a clean application-source scan does not prove that a
dependency avoids style mutation at runtime. Minifying, renaming, suppressing,
or allowlisting a bundle string would make the scan quiet without establishing
CSP compliance.

Do not patch generated `dist/` files, weaken the CSP, add `'unsafe-inline'`, hide
signatures through build transforms, or broadly allow vendor chunks.

## Recommended Remediation

1. Expand the production-browser CSP audit under the real response policy. The
   implemented basic transaction selection workflow listens for
   `securitypolicyviolation` and inspects DOM `style` attributes and dynamically
   added `<style>` elements. Add representative Motion paths for loading and
   error transitions, import controls, admin form states, and remaining routes
   and viewports.
2. Replace Framer Motion usages with statically emitted CSS/Tailwind classes and
   stylesheet-defined keyframes or transitions. Preserve reduced-motion and
   accessibility behavior. Keep reusable animation configuration centralized;
   do not move animation values into component-local inline styles.
3. Remove `framer-motion` from `package.json` and the lockfile after the last
   import is gone. Do not introduce another runtime styling dependency.
4. Replace the broad zero-match bundle assertion with a maintained CSP gate
   that combines:
   - prohibited application-source patterns;
   - a dependency denylist for known unconditional style injectors;
   - the production-browser CSP smoke test;
   - investigation and classification of any new bundle signature.
5. Update `AGENTS.md` and durable CSP documentation with the final gate, then
   remove the temporary known-baseline exception and this issue link.

Work in small route or component groups and run their focused tests after each
migration. Do not redesign unrelated UI while removing Motion.

## Acceptance Criteria

- No `framer-motion` dependency, imports, `motion.*` elements,
  `AnimatePresence`, or `LayoutGroup` remain.
- Animations use only statically emitted stylesheet/Tailwind classes and respect
  reduced-motion preferences.
- Representative production-browser workflows emit no CSP violations and leave
  no runtime-generated `<style>` elements or DOM `style` attributes.
- The source CSP scan contains no executable violations.
- The replacement CSP gate has automated tests and fails for a fixture that
  introduces runtime style injection.
- `npm run lint:fix`, `npm run format`, `npm run build`, and
  `npm run build:prod-smoke` pass.
- Durable CSP documentation is updated and the temporary exception in
  `AGENTS.md` is removed.
