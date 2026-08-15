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

## Why the Existing Scan Is Insufficient

A raw bundle substring is useful for discovery but is not proof that a path is
reachable. Conversely, a clean application-source scan does not prove that a
dependency avoids style mutation at runtime. Minifying, renaming, suppressing,
or allowlisting a bundle string would make the scan quiet without establishing
CSP compliance.

Do not patch generated `dist/` files, weaken the CSP, add `'unsafe-inline'`, hide
signatures through build transforms, or broadly allow vendor chunks.

## Recommended Remediation

1. Add a production-browser CSP smoke test under the real response policy. It
   should listen for `securitypolicyviolation`, inspect for DOM `style`
   attributes and dynamically added `<style>` elements, and exercise
   representative Motion paths: page entry, list/layout changes, loading and
   error transitions, bulk action bars, import controls, and admin form states.
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

