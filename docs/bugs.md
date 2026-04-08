# Known Bugs

Open user-facing issues captured during review.

## 2026-04-08

### P2: Avoid nesting the full-screen `UnauthorizedPage` in admin routes

- Status: Fixed
- File: `src/features/admin/transactions/pages/AdminTransactionsPage.tsx:73-74`
- Summary: When an admin user lacks `transactions:read:any`, the page returned `UnauthorizedPage` inside `AdminLayout`. `UnauthorizedPage` is a standalone full-screen route (`h-screen`), so nested admin URLs rendered a second 100vh container with broken centering and double scrolling.
- Scope: The same regression applied to the `users:write` guard in `DeactivateUserPage`.
- Fix: Both guarded admin pages now return `<Navigate to="/unauthorized" replace />` instead of rendering `UnauthorizedPage` inline, so unauthorized admins are redirected to the single canonical `/unauthorized` route mounted outside `AdminLayout`.

### P3: Disable selection UI when bulk delete is not permitted

- Status: Fixed
- File: `src/features/transactions/components/TransactionTable.tsx:680-685`
- Summary: Users without `transactions:delete` no longer see `BulkDeleteBar` or `BulkDeleteModal`, but they can still use the checkbox column, row selection state, and select-all-matching banners.
- Impact: Row selection in this table exists only to drive bulk delete, so these users are left with a dead-end interaction that has no available action.
- Scope: While scoping the fix, two adjacent gaps surfaced in the same component tree: per-row Edit/Delete dropdown items in `EditableTransactionRow.tsx` and the Import button in `TransactionsPage.tsx` both rendered for every authenticated user and let the backend 403.
- Fix: Three-pronged gating driven by `usePermission(...)`. `TransactionTable` drops the `select` column, banners, and `enableRowSelection` when the user lacks `transactions:delete`; per-row Edit/Delete dropdown items are gated on `transactions:write`/`transactions:delete` via props threaded from the table; and `TransactionsPage` only passes `ImportButton` to `PageHeader` when the user has `transactions:write`. See `docs/plans/gate-transaction-action-ui.md`.
