# Vite Production Chunk Size Plan

## Context

The production build currently emits one large JavaScript entry asset:

```text
dist/assets/index-*.js  ~876 KiB on disk, ~885 KiB reported by Vite
```

Vite warns when an output chunk is larger than its configured warning limit
after minification. This is a production-build warning only; it does not mean
the local Vite dev server is serving the same bundled file.

Local findings:

- `vite.config.ts` has no `build` customization today.
- `src/App.tsx` eagerly imports all route pages, including admin, analytics,
  views, and transaction detail/search UI.
- The build currently produces a single JS entry chunk plus CSS.

## Research Notes

Primary references:

- Vite build options:
  <https://vite.dev/config/build-options.html>
- Vite dependency pre-bundling:
  <https://vite.dev/guide/dep-pre-bundling.html>
- Vite production build:
  <https://vite.dev/guide/build.html>
- Vite why / dev-vs-production model:
  <https://vite.dev/guide/why.html>
- React `lazy`:
  <https://react.dev/reference/react/lazy>
- React `<Suspense>`:
  <https://react.dev/reference/react/Suspense>
- React Router code splitting:
  <https://reactrouter.com/explanation/code-splitting>

Key takeaways:

- Vite dev serves application source as native ESM and uses development-only
  dependency pre-bundling for performance. It is not the same artifact shape as
  `npm run build`.
- Production builds are bundled and optimized. Vite exposes chunk warning
  controls such as `build.chunkSizeWarningLimit`, but raising the limit only
  hides the warning.
- The repo's current declarative `BrowserRouter` + `<Routes>` app structure is
  compatible with `React.lazy` and `<Suspense>` route elements. React Router's
  route-module code splitting is most useful in framework/data-router setups and
  should be treated as a larger routing migration, not the first fix.
- Best practice is to split code at meaningful user-navigation boundaries first,
  then use manual vendor chunking only when measurement shows it helps caching
  or repeated downloads.

## Production vs Local Dev

Do not use the local Vite dev server to judge production chunk size.

| Area | Local Vite dev server | Production build |
| --- | --- | --- |
| Command | `npm run dev` | `npm run build` |
| Served shape | Source modules over native ESM, with HMR | Static bundled assets in `dist/` |
| Dependency handling | Dev-only pre-bundling into `.vite/deps` | Optimized build chunks |
| Chunk-size warning | Not applicable | Emitted during build |
| App access in this repo | Through `https://app.budgetanalyzer.localhost` gateway | Static bundle served by NGINX |

For this repo, validate production behavior with `npm run build` and, when
needed, `npm run preview` or the production container path. Do not rely on
`npm run dev` network waterfall to evaluate final chunk structure.

## Recommended Approach

### 1. Measure Before Changing

Run:

```bash
npm run build
du -h dist/assets/* | sort -hr | head -20
```

Record:

- entry JS size
- number of emitted JS chunks
- largest async route chunk
- whether the Vite warning remains

Result recorded 2026-05-13:

| Measurement | Result |
| --- | --- |
| Build command | `npm run build` |
| Build status | Passed |
| Entry JS asset | `dist/assets/index-C5L-MK_R.js` |
| Entry JS size reported by Vite | `885.20 kB` minified, `263.72 kB` gzip |
| Entry JS size on disk | `876K` from `du -h`; `885199` bytes from `wc -c` |
| Emitted JS chunks | `1` |
| Largest async route chunk | Not applicable; no async JS chunks emitted |
| CSS asset | `dist/assets/index-CgdmO1Z4.css`, `38.15 kB` minified, `7.53 kB` gzip |
| Vite chunk-size warning | Still present: the single entry JS chunk exceeds `500 kB` |

Optional follow-up: add a bundle analyzer dependency only if needed. Before
adding one, verify it does not affect runtime CSP. Build-only tooling is lower
risk, but still keep it out of app code paths.

### 2. Add Route-Level Lazy Loading

Convert heavy route pages in `src/App.tsx` from eager imports to lazy imports.
Keep layouts and global shell code eager so navigation chrome renders quickly.

Start with these lazy boundaries:

- `/admin/*`
  - admin dashboard
  - currencies pages
  - statement format pages
  - admin transaction search
  - users pages
- `/analytics`
- `/views` and `/views/:id`
- `/transactions/:id`

Keep these eager initially:

- `Layout`
- `AdminRoute`
- `AdminLayout`
- `PermissionGuard`
- auth/error pages, unless measurement shows they matter
- `TransactionsPage`, because it is the default route and likely the main entry
  experience

Implementation shape:

```tsx
import { lazy, Suspense } from 'react';

const AnalyticsPage = lazy(() =>
  import('@/features/analytics/pages/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  })),
);
```

Wrap lazy route elements in a small route-loading component:

```tsx
function LazyRoute({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>;
}
```

Use a compact existing loading primitive. Do not add animated or runtime
style-injecting dependencies.

Result recorded 2026-05-13:

- Implemented in `src/App.tsx` with `React.lazy`, `<Suspense>`, and the existing
  `LoadingSpinner` fallback.
- Kept `Layout`, `AdminRoute`, `AdminLayout`, `PermissionGuard`, auth/error
  pages, and the default `TransactionsPage` eager.
- Lazy-loaded `/admin/*` page components, `/analytics`, `/views`,
  `/views/:id`, and `/transactions/:id`.
- Preserved protected route behavior by keeping `<PermissionGuard>` outside the
  lazy page subtree for permission-gated routes.
- Verification: `npm run lint:fix` passed; `npm run build` passed;
  `npx vitest --run` passed with `28` files and `135` tests.
- Build result after lazy loading: `31` JavaScript chunks emitted.
- Entry JS changed from `885.20 kB` to `767.57 kB` reported by Vite
  (`760K` from `du -h`; `767569` bytes from `wc -c`).
- Largest async route chunk: `dist/assets/ViewPage-DervDk83.js` at `24.23 kB`
  reported by Vite (`32K` from `du -h`; `24225` bytes from `wc -c`).
- Vite chunk-size warning remains because the eager entry chunk is still above
  `500 kB`.

### 3. Preserve Auth And Permission Behavior

Lazy loading must not weaken route protection.

For protected routes, keep the guard outside or directly around the lazy page:

```tsx
<PermissionGuard permission="users:read">
  <LazyRoute>
    <UsersListPage />
  </LazyRoute>
</PermissionGuard>
```

This preserves the existing behavior where denied users do not mount protected
page subtrees or fire their data hooks.

For the admin area, keep `AdminRoute` and `AdminLayout` eager at first. The page
behind each admin route can be lazy.

### 4. Rebuild And Compare

Run:

```bash
npm run lint:fix
npm run build
du -h dist/assets/* | sort -hr | head -20
```

Expected result:

- more than one JS chunk in `dist/assets`
- initial entry chunk smaller than the current single `~885 KiB` bundle
- admin/analytics/views code emitted as async chunks
- Vite chunk-size warning gone or limited to a specific route/vendor chunk

If the warning remains on one async route chunk but the initial entry is much
smaller, treat that as a separate measurement question. A large lazy admin chunk
is less urgent than a large initial entry chunk.

### 5. Consider Manual Vendor Chunks Only If Needed

If route-level splitting still leaves a warning that matters, add explicit
vendor chunking in `vite.config.ts`.

For this repo's current Vite/Rollup build pipeline, the likely place is:

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        react: ['react', 'react-dom', 'react-router', 'react-router-dom'],
        query: ['@tanstack/react-query'],
        table: ['@tanstack/react-table'],
      },
    },
  },
}
```

Do this only after route splitting and measurement. Manual chunks can improve
browser caching, but they can also create extra requests and awkward shared
chunks if chosen too early.

### 6. Avoid Warning-Only Fixes

Do not start by setting:

```ts
build: {
  chunkSizeWarningLimit: 1000,
}
```

That is acceptable only if measurement shows the remaining large chunk is
intentional and not user-impacting. It should be documented with the measured
reason.

## Test Plan

Run:

```bash
npm run lint:fix
npm run build
npx vitest --run
```

Manual checks:

- Open the default transactions route and confirm it renders before navigating
  elsewhere.
- Navigate to `/analytics` and verify the lazy fallback does not visually fight
  the layout.
- Navigate to `/views` and `/views/:id`.
- Navigate to several `/admin/*` routes as an admin.
- Navigate to a denied admin route as a user without permission and confirm the
  guarded page does not mount.
- Confirm session heartbeat and toast rendering still work globally.

## Success Criteria

- Initial JS entry chunk is materially smaller than the current `~885 KiB`.
- Production build emits route-level async chunks.
- Vite chunk-size warning is resolved or narrowed to a documented lazy/vendor
  chunk.
- No route protection behavior changes.
- No new runtime styling or CSP risks are introduced.
