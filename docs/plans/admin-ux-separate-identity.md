# Admin UX Design - Separate Identity Model

## Design Decisions (Confirmed)

1. **Admin-only identity**: Admin accounts cannot own transactions. Purely oversight/management. If a person wants both roles, they use two separate accounts.
2. **Read-only transaction browse**: Admin can search and view all transactions system-wide but cannot create, edit, import, or delete.
3. **User attribution**: Admin transaction table includes a user/owner column with filtering capability.
4. **Status**: Design exploration only - no implementation yet.

## Architecture Summary

### Two Distinct Experiences

**Regular User** (`roles: ['USER']`)
- Lands on `/` (TransactionsPage - their own transactions)
- Nav: Transactions, Analytics, Views
- Full CRUD on own transactions, import, views, analytics
- No access to `/admin/*`

**Admin** (`roles: ['ADMIN']`)
- Lands on `/admin` (AdminLayout with sidebar)
- Sidebar: Transactions (all users), Currencies, Statement Formats, (future: Users)
- Read-only browse of all transactions with user column
- No access to `/`, `/analytics`, `/views`
- Cannot create/import/edit/delete transactions

### Frontend Changes Required

1. **Routing**: Role-based redirects on login. Admin -> `/admin`, User -> `/`. Block cross-access.
2. **AdminLayout**: Already exists (`src/features/admin/components/AdminLayout.tsx`) with sidebar - currently unused. Wire it up as the root layout for all `/admin` routes.
3. **Admin Transactions Page**: New page under `/admin/transactions` - reuses TanStack Table but with different columns (adds user/owner), no action buttons, calls a different API endpoint that returns all users' transactions.
4. **Layout.tsx**: Hide/block for admin-only accounts. Currently shows regular nav to everyone.

### Backend Requirements

- Endpoint to fetch ALL transactions (not just current user's) - admin only
- Transaction response needs user/owner info (at minimum: user ID, email/name)
- Enforce that admin-role-only accounts cannot create/import transactions
- Support users having ONLY `ADMIN` role (no implicit `USER` role)

### Open Questions

- Can the same account have both `USER` and `ADMIN` roles, or are they strictly exclusive?
- What user info should the transaction owner column show? (email, name, ID?)
- Should admin have any write actions beyond currencies/statement-formats? (e.g., disable a user account)
- Does the admin need pagination/export for the all-transactions view?
- How does admin search work? Same filters as user (date range, search text) plus user filter?
