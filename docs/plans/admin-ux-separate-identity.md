# Admin UX Design - Separate Identity Model

## Design Decisions (Confirmed)

1. **Admin-only identity**: Admin accounts cannot own transactions. Purely oversight/management. If a person wants both roles, they use two separate accounts.
2. **Read-only transaction browse**: Admin can search and view all transactions system-wide but cannot create, edit, import, or delete.
3. **User attribution**: Admin transaction table includes a user/owner column with filtering capability.
4. **Role logic**: If `ADMIN` is present in `roles`, user is treated as admin — regardless of other roles. No dual USER+ADMIN experience.

## Architecture

### Two Completely Separate Experiences

```
BEFORE (current):                    AFTER:
┌─────────────────────┐              ┌─────────────────────┐
│  <Layout />         │              │  Route: /admin/*     │
│  ┌─────────────────┐│              │  <AdminLayout />     │
│  │ User Header/Nav ││              │  ┌─────────────────┐│
│  ├─────────────────┤│              │  │ Admin Nav       ││
│  │ User Pages      ││              │  ├─────────────────┤│
│  │ AND             ││              │  │ Admin Pages     ││
│  │ Admin Pages     ││              │  │ (own world)     ││
│  │ (mixed)         ││              │  └─────────────────┘│
│  └─────────────────┘│              ├─────────────────────┤
└─────────────────────┘              │  Route: /*          │
                                     │  <Layout />         │
                                     │  ┌─────────────────┐│
                                     │  │ User Header/Nav ││
                                     │  ├─────────────────┤│
                                     │  │ User Pages      ││
                                     │  │ (unchanged)     ││
                                     │  └─────────────────┘│
                                     └─────────────────────┘
```

**Regular User** (`roles` does NOT include `ADMIN`)
- Lands on `/` (TransactionsPage - their own transactions)
- Nav: Transactions, Analytics, Views
- Full CRUD on own transactions, import, views, analytics
- No access to `/admin/*` (redirected to `/`)

**Admin** (`roles` includes `ADMIN`)
- Lands on `/admin` (AdminDashboard)
- Sidebar/nav: Dashboard, Currencies, Statement Formats, Transactions (Phase 3)
- Read-only browse of all transactions with user column
- No access to `/`, `/analytics`, `/views` (redirected to `/admin`)
- Cannot create/import/edit/delete transactions

### Role Helper

```ts
// src/features/auth/utils/role.ts
export function isAdmin(roles: UserRole[]): boolean {
  return roles.includes('ADMIN');
}
```

Single source of truth. ADMIN in the array → admin experience, always.

### Redirect Behavior

| Scenario | Result |
|----------|--------|
| Admin hits `/` | Redirected to `/admin` |
| Admin hits `/admin/currencies` | Works normally |
| User hits `/admin` | Redirected to `/` |
| Unauthenticated hits `/admin` | Redirected to `/login` |
| Admin logs in | Lands on `/admin` |
| User logs in | Lands on `/` |

---

## Implementation Phases

### Phase 1 — Route Separation (Visible Admin Shell)

**Goal:** Admin users see a distinct admin experience immediately. Existing currency/statement-format pages work inside AdminLayout instead of user Layout.

**Status:** Complete

**Files to modify/create:**

| File | Action |
|------|--------|
| `src/features/auth/utils/role.ts` | **Create** — `isAdmin()` helper |
| `src/features/admin/components/AdminRoute.tsx` | **Create** — route guard (not auth → `/login`, not admin → `/`, admin → render) |
| `src/App.tsx` | **Modify** — pull admin routes out of `<Layout />`, make them top-level under `<AdminRoute>` + `<AdminLayout>` |
| `src/features/admin/components/AdminLayout.tsx` | **Modify** — add Statement Formats + Transactions (greyed out) to nav |
| `src/features/admin/pages/AdminDashboard.tsx` | **Create** — minimal landing page with links to Currencies and Statement Formats |
| `src/components/Layout.tsx` | **Modify** — redirect admin users to `/admin`, remove Currencies `<Authorization>` link |
| `src/features/auth/pages/LoginPage.tsx` | **Modify** — role-aware redirect (admin → `/admin`, user → `/`) |

**Route structure after Phase 1:**

```tsx
{/* Admin — top-level, separate layout */}
<Route path="/admin" element={<AdminRoute />}>
  <Route element={<AdminLayout />}>
    <Route index element={<AdminDashboard />} />
    <Route path="currencies" element={<CurrenciesListPage />} />
    <Route path="currencies/new" element={<CurrencyCreatePage />} />
    <Route path="currencies/:id" element={<CurrencyEditPage />} />
    <Route path="statement-formats" element={<StatementFormatsListPage />} />
    <Route path="statement-formats/new" element={<StatementFormatCreatePage />} />
    <Route path="statement-formats/:formatKey" element={<StatementFormatEditPage />} />
  </Route>
</Route>

{/* User — unchanged */}
<Route path="/" element={<Layout />}>
  {/* ... existing user routes ... */}
</Route>
```

**Deliverable:** Admin logs in → lands at `/admin` → sees AdminLayout sidebar with Dashboard, Currencies, Statement Formats. All existing admin pages work. User experience unchanged.

---

### Phase 2 — AdminLayout Redesign + Visual Identity

**Goal:** Iterate on admin layout based on feedback from Phase 1. Make admin visually distinct from user experience.

**Status:** Complete

**Changes made:**

| File | Action |
|------|--------|
| `src/index.css` | **Modified** — Added `.admin` / `.dark .admin` CSS variable overrides (amber primary) |
| `src/features/admin/components/AdminLayout.tsx` | **Modified** — Amber-branded sidebar header with Shield icon, user avatar, "Management" section label, "Soon" badge on disabled nav, ThemeToggle in footer, `.admin` class on root for color scoping |
| `src/features/admin/pages/AdminDashboard.tsx` | **Modified** — Welcome message with user name, summary cards showing live currency/format counts from React Query hooks, quick action links (view all / add new) |
| `src/features/admin/pages/AdminNotFoundPage.tsx` | **Created** — Admin 404 page with back-to-dashboard link |
| `src/features/admin/components/AdminRoute.tsx` | **Modified** — Loading state now renders `AdminSkeleton` mimicking full sidebar + content layout |
| `src/App.tsx` | **Modified** — Added `path="*"` catch-all route rendering `AdminNotFoundPage` inside admin routes |

**Visual identity approach:** CSS variable scoping via `.admin` class on the layout root. Overrides `--primary`, `--primary-foreground`, and `--ring` with amber tones. All existing Tailwind utilities (`bg-primary`, `text-primary`, etc.) automatically pick up admin colors within the admin layout. No inline styles; fully CSP-compliant.

**Deliverable:** Admin experience is visually distinct (amber vs blue), has a polished dashboard with live data, proper 404 handling, and skeleton loading states.

---

### Phase 3 — Admin Transaction Browsing (Read-Only)

**Goal:** Admin can browse ALL users' transactions. No edit, delete, import, or bulk actions.

**Status:** Complete. See [admin-ux-phase-3-transactions.md](./admin-ux-phase-3-transactions.md) for the implementation plan and rationale.

**Backend prerequisite:** Endpoint returning transactions across all users with user-based filtering. Satisfied by `GET /v1/admin/transactions` (`docs/api/budget-analyzer-api.yaml:1239-1463`). Owner email/name on the row was deferred — the transaction service does not join across the permission/identity service.

**Decision: New `AdminTransactionTable` (not reusing `TransactionTable`)**

Existing `TransactionTable` is deeply coupled to user operations (inline edit, delete, bulk delete, save-as-view, Redux filter state). Stripping all that out via flags would be fragile and violates the "features don't import from each other" rule.

**Files to create:**

| File | Purpose |
|------|---------|
| `src/features/admin/api/useAdminTransactions.ts` | React Query hook for admin transactions endpoint |
| `src/features/admin/components/AdminTransactionTable.tsx` | Read-only TanStack Table with user column |
| `src/features/admin/pages/AdminTransactionsPage.tsx` | Page wiring hook to table |

**AdminTransactionTable features:**
- Columns: date, description, amount, type, bank, account, **user/owner** (new)
- Filters: search, date range, bank, account, type, amount, **user filter** (new)
- Sorting + pagination (server-side via React Query)
- Row click → detail view (read-only)
- NO: inline edit, row selection, bulk delete, save-as-view

**Deliverable:** Admin can search and browse all users' transactions with filtering by user.

---

### Phase 4 — Hardening

**Goal:** Production-ready polish.

- Deep link preservation through login flow (store intended path before redirect)
- Role revocation handling (re-fetch user → `isAdmin` returns false → redirect)
- Audit existing admin pages for stale Layout assumptions
- Tests: route guards, `isAdmin`, redirect loops, AdminTransactionTable read-only enforcement

---

## Open Questions

- ~~What user info should the transaction owner column show? (email, name, ID?)~~ **Resolved:** ID only. Per user decision, transaction-service does not join across permission-service. Revisit when an identity lookup endpoint exists.
- Should admin have any write actions beyond currencies/statement-formats? (e.g., disable a user account)
- Does the admin need export for the all-transactions view?
- ~~How does the backend admin transactions endpoint work? (separate endpoint vs query param on existing)~~ **Resolved:** Single search endpoint `GET /v1/admin/transactions`. The `id` query param covers lookup-by-id, so no separate by-id endpoint is needed.
