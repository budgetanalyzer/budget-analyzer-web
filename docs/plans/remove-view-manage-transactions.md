# Remove View Manage Transactions Popup Plan

## Goal

Remove the broad saved-view "Manage Transactions" popup and make the view
detail page behave more like the main Transactions page: the visible table is
the management surface for visible rows, with inline row actions, bulk actions,
filters, pagination, and detail navigation.

Keep a narrow restore-only path for excluded transactions, because excluded
rows are intentionally absent from the view table and cannot be restored from
that surface.

No prerequisites were found in the current documentation for this change.

## Current State

- `ViewPage` renders a header button labeled "Manage Transactions".
- Clicking it opens `ManageViewTransactionsModal`, which fetches all user
  transactions plus view membership and lets users pin, unpin, exclude, or
  restore transactions inside a dialog.
- `ViewTransactionTable` already supports the non-popup path for transactions
  currently in the view: search, row navigation, row pin/unpin/exclude, row
  selection, and bulk pin/exclude.
- The popup is the only current UI that can restore excluded transactions or pin
  a transaction that is not already in the view result.
- `BulkViewTransactionModal` copy currently says excluded transactions can be
  restored from Manage Transactions, which will become false.
- `docs/plans/analytics-view-scope-unification.md` already includes a broader
  plan to add URL-backed date filtering to view detail. This plan can implement
  that narrower piece independently or supersede that phase when executed.

## Non-Goals

- Do not merge the all-transactions page and view-detail page.
- Do not add another popup, drawer, or secondary all-transaction browser on the
  view page.
- Do not change backend saved-view APIs or generated OpenAPI files.
- Do not introduce inline styles or UI dependencies; CSP rules still apply.

## Product Decision

We should remove the all-transactions management workflow, not every modal
mechanic. A small restore-only dialog is justified because excluded rows do not
appear in `ViewTransactionTable`, so an inline restore action has nowhere to
live.

Replace `ManageViewTransactionsModal` with a purpose-built
`RestoreExcludedTransactionsModal`:

- it shows excluded transactions only
- it offers one action: restore
- it does not fetch or browse all transactions
- it does not pin, unpin, or exclude
- it does not duplicate the view table

## Phase 1: Replace Broad Popup Wiring

Files likely affected:

- `src/features/views/pages/ViewPage.tsx`
- `src/features/views/components/ManageViewTransactionsModal.tsx`
- new `src/features/views/components/RestoreExcludedTransactionsModal.tsx`
- `src/features/views/components/__tests__/ManageViewTransactionsModal.test.tsx`
- new `src/features/views/components/__tests__/RestoreExcludedTransactionsModal.test.tsx`
- `src/features/views/index.ts`
- `src/hooks/useViews.ts`

Tasks:

1. Remove the "Manage Transactions" header button from `ViewPage`.
2. Add a small "Excluded" or "Restore Excluded" action only when
   `view.excludedCount > 0`.
3. Replace `isManageModalOpen` state with restore-modal state.
4. Remove `useTransactions()` from `ViewPage` when it is only used by the
   popup.
5. Remove `ManageViewTransactionsModal.tsx`.
6. Remove `ManageViewTransactionsModal.test.tsx`.
7. Add `RestoreExcludedTransactionsModal.tsx`.
8. Add a hook for excluded transaction details, for example
   `useExcludedViewTransactions(viewId)`.
9. Remove exports/imports that reference the deleted component.

Implementation notes:

- Use `viewKeys.transactions(id)` membership data to get `excluded` IDs.
- Do not fetch all transactions. Reuse cached `['transaction', id]` records when
  available and fetch missing excluded IDs individually with `useQueries`, using
  `transactionApi.getTransaction`.
- Keep `useUnexcludeTransaction` and `viewApi.unexcludeTransaction`; they remain
  live code for the restore-only flow.

Acceptance criteria:

- No "Manage Transactions" button appears on `/views/:id`.
- Opening `/views/:id` does not fetch all transactions just to support restore.
- A restore action appears only when the saved view has excluded transactions.
- The restore dialog shows excluded transactions only.
- Restoring a row calls `useUnexcludeTransaction` and invalidates the saved-view
  detail, saved-view transactions, and saved-view list queries through the
  existing hook.
- `rg "ManageViewTransactionsModal|Manage Transactions"` returns no live UI
  references.

## Phase 2: Keep Management In The View Table

Files likely affected:

- `src/features/views/components/ViewTransactionTable.tsx`
- `src/features/views/components/BulkViewTransactionModal.tsx`
- `src/features/views/components/__tests__/ViewTransactionTable.test.tsx`

Tasks:

1. Keep existing inline actions for visible rows:
   - matched row -> pin or exclude
   - pinned row -> unpin or exclude
2. Keep bulk pin and bulk exclude for selected visible rows.
3. Update bulk-exclude dialog copy to reference the restore-excluded action
   instead of Manage Transactions.
4. Review row action copy against the main Transactions table style:
   - icon button/dropdown actions
   - stable column widths via `columnWidthClass`
   - no tooltips or inline `style` props
5. Ensure selection reset behavior remains intact after bulk success.

Acceptance criteria:

- All membership changes still available from the visible view table continue to
  work.
- Copy points users to the narrow restore path instead of the deleted management
  popup.
- View table tests cover bulk pin/exclude copy and mutation payloads.

## Phase 3: Align Filters With The Main Transactions Page

Files likely affected:

- `src/features/views/pages/ViewPage.tsx`
- `src/features/views/components/ViewTransactionTable.tsx`
- new `src/features/views/hooks/useViewTransactionFiltersSync.ts`
- `src/components/DateRangeFilter.tsx`
- `src/utils/transactionSearch.ts`

Tasks:

1. Add URL-backed view table filter state for:
   - `dateFrom`
   - `dateTo`
   - `q` or the existing search query equivalent
2. Apply date filtering in `ViewPage` before local description search.
3. Add `DateRangeFilter` beside the search input in `ViewTransactionTable`,
   matching the main Transactions table placement.
4. Add a clear-filters action when search or date filters are active.
5. Reset page index when filters change.
6. Preserve existing return navigation parameters where they are meaningful, and
   clear them when filters are explicitly cleared.

Optional follow-up after the popup removal is stable:

- Add bank, account, type, and amount filters to the view table if parity with
  the main Transactions page is still desired. Keep this separate if it makes
  the removal too large.

Acceptance criteria:

- `/views/:id?dateFrom=2026-01-01&dateTo=2026-01-31` filters the view table.
- View detail search remains local description search, consistent with
  `docs/api-integration.md`.
- Filtered stats and table rows agree because both derive from the same filtered
  transaction list.

## Phase 4: Remove Now-Unused Client Code

Files likely affected:

- `src/hooks/useViews.ts`
- `src/api/viewApi.ts`
- `src/types/view.ts`

Tasks:

1. Run `rg "useUnexcludeTransaction|unexcludeTransaction|/exclude/\\$\\{txnId\\}" src`.
2. Keep `useUnexcludeTransaction` and `viewApi.unexcludeTransaction` if the new
   restore-only flow uses them.
3. Remove only the all-transactions manage-modal support code:
   - `ManageViewTransactionsModal`
   - all-transactions membership decoration used only by that modal
   - pin/unpin/exclude actions inside the deleted modal
4. Keep shared types and API methods used by `useViewTransactions`,
   `ViewTransactionTable`, and bulk pin/exclude.
5. Do not edit generated OpenAPI specs solely because the frontend no longer
   calls one endpoint.

Acceptance criteria:

- No unused component/helper code remains from the deleted broad popup.
- TypeScript compile catches no stale imports.

## Phase 5: Tests And Verification

Tests to update:

- Delete `ManageViewTransactionsModal.test.tsx`.
- Add `RestoreExcludedTransactionsModal.test.tsx` covering:
  - excluded rows render
  - restore calls `useUnexcludeTransaction`
  - empty excluded list state, if reachable
- Update `ViewTransactionTable.test.tsx` for the new bulk-exclude copy.
- Add or update tests for view date/search filter behavior if Phase 3 is
  included.
- Add a `ViewPage` test only if one already exists or the filter sync work makes
  page-level behavior hard to cover through table tests.

Commands:

```bash
npm run lint:fix
npx vitest src/features/views/components/__tests__/ViewTransactionTable.test.tsx
npx vitest src/features/views/components/__tests__/RestoreExcludedTransactionsModal.test.tsx
npx vitest src/features/views
npm run build
```

Acceptance criteria:

- Lint autofix passes.
- A focused view test run passes.
- Production build passes.

## Phase 6: Documentation

Files likely affected:

- `docs/api-integration.md`
- `docs/plans/analytics-view-scope-unification.md`
- `README.md` only if user-facing feature summaries mention the removed popup

Tasks:

1. Update `docs/api-integration.md` saved-view section:
   - replace "restored from Manage Transactions" wording with the new
     restore-excluded action
   - document that saved-view membership changes happen from the view table
     for visible rows
   - document any new URL-backed view filters
2. Update or trim the overlapping view-detail filter phase in
   `docs/plans/analytics-view-scope-unification.md` after implementation, so
   future work does not plan the same change twice.
3. Leave generated OpenAPI docs unchanged.

Acceptance criteria:

- Docs describe the UI that exists after the popup deletion.
- No non-plan documentation links to this plan file.
