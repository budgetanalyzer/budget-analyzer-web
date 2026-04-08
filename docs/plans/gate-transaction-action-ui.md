# Plan: Gate user-facing transaction action UI by permission

## Context

`docs/bugs.md:15-21` (P3) reports that users without `transactions:delete`
no longer see `BulkDeleteBar` or `BulkDeleteModal`
(`src/features/transactions/components/TransactionTable.tsx:680-696`), but
they can still tick the checkbox column, see the "All N transactions on
this page are selected" / "Select all matching" banners, and watch their
selection grow with no available action. The selection flow on this table
exists only to drive bulk delete, so the UI should disappear entirely
when bulk delete is unavailable.

While scoping that fix, two adjacent gaps surfaced in the same component
tree:

1. **Per-row Edit and Delete dropdown items** in
   `src/features/transactions/components/EditableTransactionRow.tsx:269-316`
   render unconditionally. They send a request the backend will 403 if the
   user lacks `transactions:write` / `transactions:delete`.
2. **The Import button** mounted in
   `src/features/transactions/pages/TransactionsPage.tsx:218` renders for
   every authenticated user. Importing requires `transactions:write` and
   the backend will 403 the same way.

`docs/plans/permission-based-authorization-cleanup.md:220-229`
(Phase 3 — "Action-level gating targets") explicitly **deferred** sites
1 and 2 with this rationale:

> Individual transaction edit / delete on the user-facing page
> (`TransactionsPage`) — these already gate on `transactions:write` and
> `transactions:delete` at the backend; the UI currently shows the
> buttons to any authenticated user and lets the backend 403. No change
> unless a future role stops carrying those.

The deferral was reasonable when every authenticated user holds the
full transactions bundle. This repo is a portfolio project intended to
showcase the bulletproof-react roles-vs-permissions split end-to-end, so
the convention should hold even where it is currently a no-op. Fixing
the P3 bug, the row dropdown items, and the Import button in one PR is
less churn than three separate PRs and gives one place to update the
plan's "Not gated" section.

## Approach

Three independent gates, all driven by `usePermission(...)` hooks
already in use elsewhere (`src/features/auth/hooks/usePermission.ts:11`):

| Site | Permission | Hook owner |
|---|---|---|
| Selection column / banners / row checkbox cell | `transactions:delete` | `TransactionTable` (already has `canBulkDelete` at line 122) |
| Per-row Edit dropdown item | `transactions:write` | `TransactionTable`, threaded as a prop |
| Per-row Delete dropdown item | `transactions:delete` | `TransactionTable`, threaded as a prop |
| Import button | `transactions:write` | `TransactionsPage` |

Two design decisions worth calling out:

### Refactor `columnWidthClasses` from positional array to named map

Today `EditableTransactionRow` reads column widths positionally
(`columnWidthClasses[0]` = checkbox, `[1]` = date, …, `[7]` = actions —
see `EditableTransactionRow.tsx:152,157,160,177,182,198,205,223`). If we
drop the `select` column from the table when bulk delete is forbidden,
every index shifts by one and the row is silently misaligned.

Switch to a `Record<string, string>` keyed by column id. The row reads
`widths.date`, `widths.actions`, etc., and conditionally renders its
checkbox cell. Removing or keeping the `select` column then has no
effect on any other cell. The change is small (one prop type, eight
indexed accesses) and removes a positional contract that was already a
latent bug — the kind of cleanup a portfolio project rewards.

### Permission flags travel as props, not hooks-in-the-row

`EditableTransactionRow` is `memo`'d. Calling `usePermission` inside it
would still work (hooks compose with `memo`), but the row is otherwise
purely presentational and threading three booleans from the parent
keeps that boundary clean. `TransactionTable` already calls
`usePermission('transactions:delete')` at line 122, so adding a second
call for `transactions:write` is one line.

The `Add to View` submenu stays ungated. It targets a different
resource (views) and there is no `views:*` permission in the catalog
(`src/mocks/handlers.ts:12-25`); when one lands, gating it is a
follow-up.

### `enableRowSelection` and selection state

When `canBulkDelete` is false, set `enableRowSelection: false` on the
TanStack Table options and never render the select column header or the
two banners. The local `rowSelection` and `selectAllMatching` state can
stay declared — they default to `{}` / `false` and nothing mutates them
once the column and banners are gone.

### Files NOT touched

- `src/features/transactions/components/BulkDeleteBar.tsx` — already
  hidden via `isVisible={canBulkDelete && ...}` at
  `TransactionTable.tsx:685`.
- `src/features/transactions/components/BulkDeleteModal.tsx` — already
  conditionally mounted at `TransactionTable.tsx:689`.
- `src/features/transactions/components/ImportButton.tsx` — kept as a
  pure presentational component. The gate lives in its parent so that a
  hypothetical second mount point (none today) decides for itself.
- `src/features/transactions/pages/TransactionDetailPage.tsx` —
  read-only view, no Edit/Delete affordances to gate.
- `src/utils/columnWidth.ts` — unchanged.
- `src/features/auth/hooks/usePermission.ts`,
  `src/features/auth/utils/permissions.ts` — primitives unchanged.

## Changes

### 1. `src/features/transactions/components/TransactionTable.tsx`

**Add the second permission hook (line ~122):**

```tsx
const canBulkDelete = usePermission('transactions:delete');
const canEditTransactions = usePermission('transactions:write');
```

**Conditionally include the `select` column in the `columns` useMemo
(lines 228-323):**

- Move the existing `select` column literal into a separate const so it
  is easy to spread in only when permitted, e.g.:
  ```tsx
  const selectColumn: ColumnDef<Transaction> = { id: 'select', /* ... */ };
  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      ...(canBulkDelete ? [selectColumn] : []),
      { accessorKey: 'date', /* ... */ },
      // ...rest unchanged
    ],
    [canBulkDelete],
  );
  ```
- Add `canBulkDelete` to the `useMemo` dependency array (currently
  `[]`).

**Replace the positional `columnWidthClasses` array (line 601-603):**

Today:
```tsx
columnWidthClasses={table
  .getAllColumns()
  .map((col) => columnWidthClass(col.getSize()))}
```

New:
```tsx
columnWidths={Object.fromEntries(
  table.getAllColumns().map((col) => [col.id, columnWidthClass(col.getSize())]),
)}
```

The new prop name is `columnWidths` (object) — rename so reviewers
notice the contract change. `col.id` resolves to the column's `id`
field (`'select'`, `'actions'`) or its `accessorKey` (`'date'`,
`'description'`, …) — this is the standard TanStack behavior used
elsewhere in the codebase.

**Update `useReactTable` options (line 336):**

```tsx
enableRowSelection: canBulkDelete,
```

**Wrap both selection banners in `canBulkDelete` (lines 543-569):**

Wrap each `{ ... && (...)}` block in an outer `canBulkDelete && (...)`.
Cleanest as a single combined condition on each block:

```tsx
{canBulkDelete &&
  table.getIsAllPageRowsSelected() &&
  transactions.length > pageSize &&
  !selectAllMatching && (
    /* select-all-matching banner */
  )}

{canBulkDelete && selectAllMatching && (
  /* confirmation banner */
)}
```

This means a user without `transactions:delete` can never reach the
`selectAllMatching === true` state — the column is gone and so is
`toggleAllPageRowsSelected`, so `selectAllMatching` stays `false` and
the second banner stays hidden.

**Thread permission flags into `EditableTransactionRow` (lines 590-606):**

```tsx
<EditableTransactionRow
  key={row.id}
  transaction={row.original}
  /* ...existing props unchanged... */
  columnWidths={columnWidths}
  canSelect={canBulkDelete}
  canEdit={canEditTransactions}
  canDelete={canBulkDelete}
  isSelected={row.getIsSelected()}
  onSelectionChange={(checked) => row.toggleSelected(checked)}
/>
```

(`columnWidthClasses` → `columnWidths`; new flags `canSelect`,
`canEdit`, `canDelete`. `canSelect` is `canBulkDelete` — same boolean,
named for the cell-level concern.)

**Update the empty-state `colSpan` (line 610):**

`colSpan={columns.length}` already references the dynamic columns
array, so it self-adjusts. No change needed beyond verifying.

### 2. `src/features/transactions/components/EditableTransactionRow.tsx`

**Update the props interface (lines 28-40):**

```tsx
interface EditableTransactionRowProps {
  transaction: Transaction;
  displayCurrency: string;
  exchangeRatesMap: Map<string, Map<string, ExchangeRateResponse>>;
  isExchangeRatesLoading: boolean;
  onSave: (id: number, data: { description?: string; accountId?: string }) => void;
  onDelete: (transaction: Transaction) => void;
  onRowClick: (transaction: Transaction) => void;
  isUpdating: boolean;
  columnWidths: Record<string, string>;
  canSelect: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isSelected: boolean;
  onSelectionChange: (checked: boolean) => void;
}
```

Destructure the new props in the function signature (lines 42-54).
Note: when `canSelect` is `false`, the parent guarantees `isSelected`
will always be `false` and `onSelectionChange` will never be called,
because the checkbox is not rendered.

**Replace positional width lookups (lines 152, 157, 160, 177, 182, 198,
205, 223) with named keys:**

| Old | New |
|---|---|
| `columnWidthClasses[0]` | `columnWidths.select` |
| `columnWidthClasses[1]` | `columnWidths.date` |
| `columnWidthClasses[2]` | `columnWidths.description` |
| `columnWidthClasses[3]` | `columnWidths.bankName` |
| `columnWidthClasses[4]` | `columnWidths.accountId` |
| `columnWidthClasses[5]` | `columnWidths.type` |
| `columnWidthClasses[6]` | `columnWidths.amount` |
| `columnWidthClasses[7]` | `columnWidths.actions` |

**Conditionally render the checkbox cell (lines 151-154):**

```tsx
{canSelect && (
  <TableCell className={columnWidths.select} onClick={(e) => e.stopPropagation()}>
    <Checkbox checked={isSelected} onCheckedChange={onSelectionChange} disabled={isEditing} />
  </TableCell>
)}
```

When `canSelect` is `false`, the `select` key is absent from
`columnWidths` (because the parent dropped the column from `columns`)
and the cell is never rendered, so no lookup happens.

**Conditionally render Edit dropdown item (lines 270-278):**

```tsx
{canEdit && (
  <DropdownMenuItem
    onClick={(e) => {
      e.stopPropagation();
      handleStartEdit();
    }}
  >
    <Pencil className="mr-2 h-4 w-4" />
    Edit
  </DropdownMenuItem>
)}
```

**Conditionally render Delete dropdown item and its preceding separator
(lines 305-315):**

```tsx
{canDelete && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      destructive
      onClick={(e) => {
        e.stopPropagation();
        onDelete(transaction);
      }}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Delete
    </DropdownMenuItem>
  </>
)}
```

The separator moves inside the `canDelete` branch so a user without
`transactions:delete` does not see a dangling divider after `Add to
View`.

**Inline edit affordances when `canEdit` is false:**

The Save / Cancel buttons (lines 224-254) only appear while
`isEditing === true`. Because the only entry point to `isEditing` is
the Edit dropdown item, hiding that item is sufficient — the editing
branch becomes unreachable. No change to the editing UI itself is
required, but verify by reading the file: the only `setIsEditing(true)`
call is in `handleStartEdit` at line 64, which only `Edit` invokes.

The dropdown trigger button (the `MoreVertical` button at lines 258-267)
stays unconditional because the `Add to View` submenu is always
available, so the menu always has at least one actionable item.

### 3. `src/features/transactions/pages/TransactionsPage.tsx`

**Add the permission hook at the top of `TransactionsPage` (after the
existing `useAppSelector` calls, near line 39):**

```tsx
import { usePermission } from '@/features/auth/hooks/usePermission';
// ...
const canImportTransactions = usePermission('transactions:write');
```

**Conditionally pass the Import button to `PageHeader` (line 218):**

```tsx
<PageHeader
  title="Transactions"
  description="View and manage transactions"
  action={
    canImportTransactions ? (
      <ImportButton onSuccess={handleImportSuccess} onError={handleImportError} />
    ) : undefined
  }
/>
```

`PageHeader.action` is `ReactNode | undefined`
(`src/components/PageHeader.tsx:9`) so passing `undefined` simply
collapses the right-hand slot — no layout change for users without
the permission beyond the missing button.

### 4. Tests

No tests exist today for `TransactionTable`, `EditableTransactionRow`,
`ImportButton`, or `TransactionsPage` (verified via
`Glob '**/TransactionTable*.test.*'` etc., zero matches). Add
focused unit tests for the new gating using the same pattern as
`src/features/admin/components/__tests__/AdminLayout.test.tsx:1-77`:
mock `usePermission`, render the component, assert visibility.

Three new test files:

#### `src/features/transactions/components/__tests__/TransactionTable.test.tsx`

Mock `useAuth` and `usePermission`. Provide a minimal Redux store with
`uiReducer` and a `MemoryRouter`. Render the table with two or three
fake transactions and assert:

- **All permissions granted**: select column header checkbox is visible
  (`screen.getByRole('checkbox')` returns the header + per-row
  checkboxes), each row exposes a checkbox, the per-row dropdown
  contains both `Edit` and `Delete` items.
- **Without `transactions:delete`**: no checkboxes anywhere
  (`screen.queryAllByRole('checkbox')` is empty), no select-all-matching
  banner can appear (force-select would not work; just assert the
  initial render has no checkboxes), the per-row dropdown still has
  `Edit` but not `Delete`, and `BulkDeleteBar` is absent
  (`screen.queryByText(/transactions selected/)` returns null).
- **Without `transactions:write`**: checkboxes are still present, the
  dropdown contains `Delete` but not `Edit`.
- **Without either**: dropdown contains only `Add to View`; no
  checkboxes; `BulkDeleteBar` absent.

Use `mockUsePermission.mockImplementation((p) => p === '...')` to
toggle individual permissions per test, the same idiom as
`AdminLayout.test.tsx:55,62`.

#### `src/features/transactions/pages/__tests__/TransactionsPage.test.tsx`

Mock `usePermission`, `useTransactions`, `useExchangeRatesMap`,
`useMissingCurrencies`, and any other hooks called at the top of the
page. Render with a Redux store and a `MemoryRouter`. Assert:

- **With `transactions:write`**: `screen.getByRole('button', { name: /Import Transactions/ })` resolves.
- **Without `transactions:write`**: the same query returns null
  (`screen.queryByRole(...)`).

If mocking the page's full hook fan-out turns out to be high-friction
(it pulls in `useExchangeRatesMap` which itself fetches), narrow the
test to a smaller render — e.g. extract the `PageHeader` action choice
into a tiny pure helper and unit-test that helper. Decide during
implementation; do not balloon the test fixture for this single
assertion.

#### Optional: `src/features/transactions/components/__tests__/EditableTransactionRow.test.tsx`

Skip unless the `TransactionTable` test above ends up unable to assert
on the row dropdown items reliably (e.g. because the Radix dropdown
portal is hard to query inside the table render). If needed, render the
row in isolation inside a `<table><tbody>...</tbody></table>` wrapper
and assert dropdown contents directly.

### 5. Documentation updates

#### `docs/bugs.md`

Mark the P3 entry (lines 15-21) as Fixed, with a brief Fix line
describing the three-pronged gating. Pattern matches the P2 entry
above it (lines 7-13).

#### `docs/plans/permission-based-authorization-cleanup.md`

Update the "Not gated" subsection (lines 220-229) to reflect that the
user-facing per-row Edit/Delete affordances and the Import button are
now gated, with a one-line forward reference to this plan. Do not
delete the rationale paragraph — keep it as historical context for why
the original phase 3 deferred them.

#### `AGENTS.md`

Extend the existing "Roles vs Permissions" subsection (originally added
in Phase 4 of the parent cleanup, `AGENTS.md:153-198`) in two ways.

**1. Add two rule paragraphs.** Insert after the "Never gate an action
on `isAdmin`" paragraph (currently ending around line 175) and before
the "Action-level gating sites today" table. These document conventions
this PR applies but does not invent — the review of this plan surfaced
that neither was written down anywhere, which is what prompted adding
them here:

> **Reads are not gated at the table.** Read-only list bodies, detail
> pages, and table cells render unconditionally. If the user reaches a
> page they cannot read, the backend returns 403, React Query surfaces
> the error, and `ErrorBanner` renders it (see `TransactionsPage.tsx`
> for the pattern). Gating the table itself would make the "no rows"
> and "backend 403" states unreachable behind a third "no permission"
> state, and every authenticated user has the self-scope
> `transactions:read` permission by definition. This matches the
> bulletproof-react reference convention: gate the button, not the
> table.
>
> **`:any` permissions are feature-level, not read-level.** Strings
> ending in `:any` (`transactions:read:any`, `transactions:write:any`,
> `transactions:delete:any`) expand scope from "my own resources" to
> "across all users." They gate **distinct cross-user features** — the
> admin transactions search page, the dashboard cross-user tile, the
> admin sidebar nav item — at the route / tile / page level. User-
> facing pages check the **unscoped** permission (`transactions:write`,
> `transactions:delete`) because those are the self-scope variants.
> When adding a new gated site, pick the scope from the question the
> site answers: "same feature but on someone else's data?" → `:any`.
> "an action on the current user's own data?" → unscoped.

**2. Extend the "Action-level gating sites today" table.** Add one row
for each site this PR gates. Existing rows stay as-is — the "Bulk
delete trigger (self-scope)" row on `TransactionTable.tsx` is unchanged
by this PR; only the selection UI that leads into it is new.

| Site | File | Permission |
|---|---|---|
| Import transactions button (self-scope) | `src/features/transactions/pages/TransactionsPage.tsx` | `transactions:write` |
| Per-row Edit (self-scope) | `src/features/transactions/components/EditableTransactionRow.tsx` (prop threaded from `TransactionTable.tsx`) | `transactions:write` |
| Per-row Delete (self-scope) | `src/features/transactions/components/EditableTransactionRow.tsx` (prop threaded from `TransactionTable.tsx`) | `transactions:delete` |
| Row selection column and banners (self-scope) | `src/features/transactions/components/TransactionTable.tsx` | `transactions:delete` |

## Verification

1. `npm run lint:fix` — clean.
2. `npm test -- TransactionTable` — new gating tests pass; existing
   tests (none today) continue to pass.
3. `npm test -- TransactionsPage` — new Import button gating test
   passes.
4. `npm test` (full suite) — no regressions in
   `AdminLayout.test.tsx`, `usePermission.test.tsx`, or any other
   permission test.
5. `npx tsc --noEmit` — confirms the `columnWidths` prop type rename
   propagates cleanly to every call site (only one: `TransactionTable`
   itself).
6. `npm run build` — clean.
7. Manual smoke against a dev cluster, by temporarily reducing the
   `permissions` array in `src/mocks/handlers.ts:12-25`:
   - Remove `transactions:delete` and `transactions:delete:any`. Reload
     `/`. Expected: checkbox column gone, "select all matching"
     banner gone, per-row dropdown shows Edit + Add to View only,
     `BulkDeleteBar` never appears.
   - Restore delete, remove `transactions:write` and
     `transactions:write:any`. Expected: checkboxes back, per-row
     dropdown shows Delete + Add to View only, the "Import
     Transactions" button is gone from the page header.
   - Remove all of `transactions:write`, `transactions:delete`, and
     their `:any` variants. Expected: no checkboxes, no Import button,
     per-row dropdown shows only "Add to View".
   - Restore the full permissions list before committing.

## Out of scope

- **`Add to View` submenu gating.** No `views:*` permission exists in
  the backend catalog yet; revisit when one is introduced.
- **Currency / Statement format admin pages.** The parent cleanup plan
  explicitly defers these (lines 220-224); no bug filed.
- **`AdminTransactionsPage` (cross-user search).** Already gated by
  Phase 3 of the parent cleanup.
- **Refactoring `EditableTransactionRow` for permission-aware editing
  shortcuts** (e.g. inline editing on row click). The Edit dropdown
  item is the only entry point today; any future entry points will
  need their own gating but are not in scope here.
- **A `<Can permission="...">` wrapper component.** The parent plan
  explicitly rejects this abstraction
  (`docs/plans/permission-based-authorization-cleanup.md:155-164`) and
  inline `usePermission` checks remain the convention.
