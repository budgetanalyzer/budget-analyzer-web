# Radix Dropdown Violates Strict CSP

**Status:** Open, pre-existing defect  
**Recorded:** 2026-08-13  
**Disposition:** Track separately from the authenticated-route and API-hardening work

## Summary

The shared dropdown implementation imports `@radix-ui/react-dropdown-menu`. Its dependency chain
includes `react-remove-scroll` and `react-style-singleton`, which bundles code that creates a
runtime `<style>` element and writes CSS through `styleSheet.cssText`. This violates the
application's enforced `style-src 'self'` policy and repository rule prohibiting runtime CSS
injection.

The violation predates the current authentication and API-hardening work. The Radix dropdown and
the same `react-style-singleton` version have been present since the initial repository commit;
strict CSP was adopted later. The production-smoke build succeeds because the CSP scan is a
separate command rather than part of the Vite build or an automated package script.

## Evidence

The shared implementation is `src/components/ui/DropdownMenu.tsx`. The installed dependency path
is:

```text
@radix-ui/react-dropdown-menu
└─ @radix-ui/react-menu
   └─ react-remove-scroll
      └─ react-style-singleton
```

After `npm run build:prod-smoke`, the required bundle scan finds `document.createElement('style')`
or `styleSheet.cssText` logic in `dist/`:

```bash
rg -n "createElement\('style'\)|styleSheet\.cssText|eval\(" dist/
```

The dependency is used by currency selection, saved-view selection and settings, the user profile
menu, view transaction actions, and editable transaction row actions. The editable transaction
row also uses a submenu.

Radix's floating-positioning implementation also emits element-level inline positioning styles.
Removing only `react-remove-scroll`, disabling modal behavior, or suppressing the bundle match
would therefore not demonstrate complete strict-CSP compatibility.

## Impact

When strict CSP is enforced, the browser can reject the generated style element and inline
positioning declarations. Dropdown behavior such as body scroll locking or menu positioning may
then be degraded and CSP violations are reported in the browser console. This is a policy and UI
behavior defect; it is not evidence that the authentication or API changes introduced an
executable-code vulnerability.

## Remediation

Replace or refactor the shared dropdown implementation so it uses static, build-time Tailwind CSS
only. Preserve the existing public component API where practical and retain:

- keyboard navigation, Escape dismissal, focus restoration, and outside-click dismissal;
- disabled and destructive item behavior;
- start/end alignment without runtime style attributes;
- submenu behavior used by editable transaction rows;
- usable placement on mobile and desktop without portals that require dynamic inline positioning.

Remove `@radix-ui/react-dropdown-menu` if it has no remaining consumers. Add focused interaction
tests for the shared primitive and representative consumers, then run the complete test, lint,
coverage, bundle, and CSP validation suite. The CSP scan must return no matches; do not add a scan
exception for this dependency.

## Closure Criteria

- All dropdown consumers retain their current user-visible behavior and accessibility contracts.
- No dropdown code creates runtime `<style>` elements or DOM `style` attributes.
- The production-smoke bundle CSP scan returns no matches.
- Full tests, coverage, lint, and production builds pass.
- This temporary bug document is removed once the remediation and any durable architecture or
  operating documentation updates are complete.
