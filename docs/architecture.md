# Architecture

Budget Analyzer Web is a React single-page application that presents current-user
transaction, saved-view, analytics, and statement-format workflows plus separate
administrative surfaces. It is the browser-facing interface to backend services;
it does not own authentication, authorization, transaction, currency, or user
data.

## Application Structure

The source tree follows a feature-based organization:

| Path              | Responsibility                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/features/`   | Product features: transactions, saved views, analytics, authentication, statement formats, and administration |
| `src/components/` | Shared application components and owned UI primitives                                                         |
| `src/api/`        | Shared HTTP client and transport contracts                                                                    |
| `src/store/`      | Redux configuration for cross-tree UI preferences                                                             |
| `src/hooks/`      | Shared hooks that are not owned by one feature                                                                |
| `src/lib/`        | Centralized third-party configuration and animation definitions                                               |
| `src/types/`      | Shared domain and transport types                                                                             |
| `src/utils/`      | Shared pure utilities and browser integration helpers                                                         |
| `src/testing/`    | Shared Vitest setup, mocks, and render helpers                                                                |

Features own their pages, components, hooks, types, and utilities. A feature
must not import from another feature; code shared across feature boundaries
belongs in the appropriate top-level directory. `src/App.tsx` is the route
composition boundary and keeps the standard user layout separate from the
administrative layout.

The primary user surfaces are transaction management, transaction detail,
saved-view management, analytics, and statement-format preferences.
Administrative surfaces cover currencies, statement formats, cross-user
transaction search, and users. These are durable task boundaries, while their
component-level workflows remain implementation details within each feature.

Shared UI follows the shadcn model: primitives under `src/components/ui/` are
application-owned source, styled with Tailwind, and may selectively build on
headless libraries whose runtime behavior is compatible with the repository's
CSP rules.

Shared dialog footers own the application-wide action layout: they separate
actions from preceding content with `mt-6` and use `gap-2` for both stacked
mobile buttons and desktop rows. Feature dialogs should use the default
`DialogFooter` spacing instead of repeating local margin or button-gap classes;
specialized separators such as a top border may be added without replacing the
shared spacing.

Shared dialogs follow the
[WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
`DialogContent` supplies modal dialog semantics and associates its
`DialogTitle` and optional `DialogDescription` through stable generated
identifiers. When a dialog opens, it honors an intentional autofocus target,
otherwise focuses the first focusable element or the dialog container. Focus
remains contained while the dialog is open and returns to the previously
focused connected element when it closes. Overlapping dialogs share opening
order for visual stacking and keyboard ownership, so the most recently opened
dialog is both visible above and receives modal keyboard interaction before
earlier dialogs.

Dialogs portal to `document.body` by default. A layout that owns scoped CSS
custom properties must register a dialog portal host beneath that scope through
`DialogPortalContainerProvider` so dialogs opened by its descendants inherit
the layout's theme variables. The administrative layout follows this contract
with a host beneath `.admin`; global and ordinary dialogs continue to use the
body fallback.

`DialogContent` is dismissible by default. Its single `dismissible` input owns
all shared dismissal mechanisms: when false, the close control is absent and
backdrop clicks and Escape do not request closure. This does not prevent the
controlling feature from closing a controlled dialog after successful work.
Feature-owned Cancel controls must reflect the same state when dismissal is
disabled. A dialog that owns an in-flight mutation passes `dismissible={false}`
and disables Cancel until the request settles because closing the dialog does
not cancel the request. Successful mutation callbacks may still close it
programmatically. Dialogs continue to use the reference-counted body scroll
lock described in the CSP contract below.

New and changed visible dialog titles use sentence case, including titles
supplied through component inputs. Consequential destructive confirmations,
such as deleting data that cannot be restored through the interface, include a
warning icon; the icon is decorative when the title and description already
communicate the warning. Reversible actions such as removing transaction
membership from a saved view do not use warning iconography.

## State Boundary

The application separates state by lifetime and authority:

- TanStack Query owns backend and session data.
- URL search parameters own refreshable, shareable route state.
- Redux owns persisted cross-tree UI preferences.
- Components own transient drafts, table mechanics, selection, and overlays.
- Derived data is calculated rather than synchronized into another store.

[State Architecture](state-architecture.md) owns the placement rules and
feature-specific URL, navigation, Redux, and local-state contracts.

## Current-User Transaction Snapshot

Current-user `GET /v1/transactions` returns the complete active collection as a
plain array. TanStack Query caches that snapshot, and ordinary transaction,
saved-view, and analytics surfaces filter, sort, project display amounts, and
aggregate it in the browser. Transaction-table pagination is presentation only;
it does not request another transport page or reduce the collection used by
selection and totals.

Static saved views load ordered membership IDs separately and intersect them
with this shared transaction cache. A missing ID is reported as snapshot skew
and omitted from the derived member objects; it does not trigger a per-ID
transaction fetch.

Cross-user administrative transaction search is the deliberate exception. It
remains a backend-filtered, backend-sorted paged response whose amount bounds
and amount sorting use stored signed numeric amounts rather than the user's
display-currency projection. This architecture introduces neither transport
pagination for the current-user snapshot nor a client or server performance
benchmark; future scaling changes require a separately designed contract.

## Integration and Security Boundaries

Development and production preserve the same same-origin routing shape:

```text
Frontend document and assets:
  Browser -> Istio ingress -> NGINX -> frontend

Authentication paths:
  Browser -> Istio ingress -> Session Gateway

API requests:
  Browser -> Istio ingress -> ext_authz -> NGINX -> backend service
```

The Session Gateway owns OAuth2/OIDC and server-side sessions. The browser
receives an opaque, secure session cookie rather than identity-provider tokens.
For protected API traffic, ext_authz validates the session before NGINX routes
the request to transaction, currency, permission, or other backend services.
Those services remain authoritative for authorization and resource ownership.

The SPA uses roles only to select layout chrome and permissions to gate routes
and affordances. Frontend checks improve navigation but are not an authorization
boundary. [Authentication and Authorization](authentication.md) owns login,
logout, session lifecycle, role and permission taxonomy, and gating guidance.
[API Integration](api-integration.md) owns frontend transport behavior; the
generated specifications under `docs/api/` own endpoint and payload schemas.

The sibling orchestration repository owns the full deployed topology. Local
access and environment instructions belong to [Development](development.md).

## Browser Support

The supported browser floor is Chrome/Edge 125+, Firefox 147+, and Safari/iOS
26+. Shared dropdowns require this floor because they use the native Popover
API, implicit invoker anchors, CSS `anchor()` positioning, and static block and
inline fallback positions.

These browser capabilities place menus in the top layer and keep them aligned
without portals, JavaScript coordinate measurement, application-authored
inline styles, or runtime-generated CSS. Programmatic opens pass the trigger as
the Popover API `source`, preserving the invoker relationship used by implicit
anchor positioning.

## Content Security Policy

The production application is a statically served, client-rendered SPA with
`style-src 'self'` and neither `'unsafe-inline'` nor `'unsafe-eval'`. Browser CSP
semantics and repository authoring rules are related but distinct.

Under the enforced policy, parser-created or server-rendered `style="..."`
attributes and direct `setAttribute('style', ...)` writes are blocked.
Authorized client JavaScript can update individual properties through
`element.style`, `Object.assign(element.style, ...)`, or
`style.setProperty(...)`. Browsers serialize those allowed property writes as a
DOM `style` attribute, so attribute presence alone is not evidence of a CSP
violation.

`CSSStyleDeclaration.cssText` also applies without a policy violation in the
exercised Chromium environment. That result is not generalized to untested
engines, and `cssText` is not an application-authoring pattern. Writing
stylesheet content through `cssText` is a different operation and remains
prohibited.

The repository imposes stricter application conventions:

- Application styling is Tailwind-first. React `style` props are prohibited,
  including for values that a browser might allow under CSP.
- Runtime stylesheet injection is prohibited. Application code and dependencies
  must not create `<style>` elements, insert CSSOM rules, write stylesheet
  content, or generate CSS through `eval()` or `new Function()`.
- Dynamic table widths use the static Tailwind maps in
  `src/utils/columnWidth.ts`.
- Dialogs and mobile overlays acquire reference-counted body locks through
  `acquireBodyScrollLock()` in `src/utils/bodyScrollLock.ts`, which toggles the
  statically emitted `overflow-hidden` class.
- Transient toasts and toast dependencies are not part of the application
  contract. Feedback uses stable contextual surfaces. `sonner` remains
  prohibited because it unconditionally injects a runtime stylesheet.
- Shared dropdowns use `src/components/ui/DropdownMenu.tsx`, native popovers,
  and statically emitted anchor-positioning utilities. They do not use portals,
  measured coordinates, or runtime CSS.

Bundle capability scans are evidence to investigate, not an allowlist and not
proof that a matching path executes. Motion 13 is consumed through its supported
`motion/react` facade; the transitive `framer-motion` package is its React
implementation. Its bundle contains a runtime stylesheet path for
`AnimatePresence mode="popLayout"`, which application source does not select.
React DOM also contains generic renderer capabilities. These known matches do
not weaken the ban on runtime stylesheet injection or remove the need to
investigate new and changed matches. A `MotionConfig` nonce would authorize a
generated style block only if the response policy supplied the same per-response
nonce; this static SPA does not currently provide one.

The production-smoke build retains a temporary dropdown-specific static gate
for known Radix menu and `react-remove-scroll` signatures. It covers the emitted
bundle, production source imports, and package metadata, but it is not a general
CSP verifier and does not replace browser-policy evidence. The gate remains
until browser coverage exercises desktop and mobile dropdown behavior,
placement and viewport fallback, top-layer clipping escape, CSP violations, and
prohibited runtime or final stylesheets.

[Development](development.md#build--deployment) owns build commands and static
scan procedures. [Testing](testing-guide.md#external-browser-harness) owns the
browser harness, CSP detector, executable findings, and current coverage limits.
