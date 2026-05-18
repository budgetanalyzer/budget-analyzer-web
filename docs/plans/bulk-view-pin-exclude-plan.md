# Bulk Saved-View Pin and Exclude Plan

## Context

The OpenAPI spec now defines bulk saved-view transaction updates:

- `POST /v1/views/{id}/pin` with `{ "ids": number[] }`
- `POST /v1/views/{id}/exclude` with `{ "ids": number[] }`

Both endpoints return:

```json
{
  "updatedCount": 5,
  "notFoundIds": [999, 1000]
}
```

`notFoundIds` are transaction IDs that are missing, deleted, or not owned by the
caller. The implementation should follow the same interaction model as bulk
delete on the main transactions table: row selection, optional select-all
matching, fixed bottom action bar, confirmation modal, toast feedback, and query
invalidation after success.

No separate blocking prerequisite was found in repository documentation. The API
contract is already present in `docs/api/budget-analyzer-api.yaml`.

## Phase 1: API Types and Client

Add typed request/response support in `src/types/view.ts`:

- `BulkViewTransactionRequest`
- `BulkViewTransactionResponse`

Add API client methods in `src/api/viewApi.ts`:

- `bulkPinTransactions(viewId: string, ids: number[])`
- `bulkExcludeTransactions(viewId: string, ids: number[])`

Use the exact request shape from OpenAPI:

```ts
{ ids }
```

Do not return or synthesize a `SavedView` from these methods. The bulk response
only contains update counts and missing IDs.

## Phase 2: React Query Mutations

Add mutations beside the existing single-row saved-view mutations in
`src/hooks/useViews.ts`:

- `useBulkPinTransactions`
- `useBulkExcludeTransactions`

Mutation variables should include:

```ts
{
  viewId: string;
  ids: number[];
}
```

On success, invalidate:

- `viewKeys.detail(viewId)`
- `viewKeys.transactions(viewId)`
- `viewKeys.list()`

Do not add optimistic count updates. The API does not return the updated view,
and the current single-row invalidation pattern is already the safest local
pattern.

## Phase 3: View Table Selection

Extend `src/features/views/components/ViewTransactionTable.tsx` with table row
selection using TanStack Table's `RowSelectionState`.

Add a select column before the current pinned indicator column:

- Header checkbox toggles all rows on the current page.
- Row checkbox toggles a single transaction.
- `getRowId` should use `transaction.id.toString()`.
- Selection should not trigger row navigation.

Mirror the main transactions table behavior:

- `selectedIds` from selected rows.
- `allFilteredIds` from the table's `transactions` prop.
- `selectAllMatching` state.
- `idsToUpdate = selectAllMatching ? allFilteredIds : selectedIds`.
- Clear selection after a successful bulk action.
- Clear `selectAllMatching` when selection changes manually.

For this view, "all matching" means all rows in the current `transactions`
prop. `ViewPage` already filters that prop by the applied view-table search
before rendering `ViewTransactionTable`.

## Phase 4: Bulk Action Bar

Create a view-specific floating action bar, for example:

- `src/features/views/components/BulkViewTransactionBar.tsx`

Use the same animation pattern as `BulkDeleteBar`:

- `AnimatePresence`
- `slideUpVariants`
- `slideUpTransition`

Show:

- selected count
- `Clear selection`
- `Pin`
- `Exclude`

Use lucide icons where helpful:

- `Pin`
- `EyeOff`

Bulk pin should only submit IDs for rows that are not already pinned. If every
selected row is already pinned, disable the `Pin` button.

Bulk exclude should submit the selected IDs, consistent with the existing row
menu behavior.

## Phase 5: Confirmation Modal

Add a reusable modal, for example:

- `src/features/views/components/BulkViewTransactionModal.tsx`

Props:

```ts
type BulkViewTransactionAction = 'pin' | 'exclude';

interface BulkViewTransactionModalProps {
  viewId: string;
  selectedIds: number[];
  action: BulkViewTransactionAction;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}
```

Behavior should match `BulkDeleteModal`:

- Use `mutate(..., { onSuccess, onError })`.
- Block closing while pending.
- On full success, show a success toast.
- On partial success, show a warning toast including the number not found.
- If `updatedCount` is `0`, show an error toast.
- On mutation error, use `formatApiError`.
- Close and clear selection after handled success.

Suggested copy:

- Pin title: `Pin Transactions`
- Pin description: `Pin {count} transaction(s) to this view? Pinned transactions stay in the view regardless of filters.`
- Exclude title: `Exclude Transactions`
- Exclude description: `Exclude {count} transaction(s) from this view? Excluded transactions can be restored from Manage Transactions.`

## Phase 6: View Table Integration

Wire the new pieces into `ViewTransactionTable.tsx`:

- Add state for the active bulk action.
- Open the modal from the action bar.
- Pass `idsToUpdate`.
- Reset row selection and `selectAllMatching` in a shared success callback.
- Include pending states from bulk mutations only inside the modal, not in the
  table's existing row-menu `isMutating` state.

Keep existing single-row actions unchanged:

- Pin/Unpin row action remains in the row dropdown.
- Exclude row action remains in the row dropdown.
- Row navigation behavior remains unchanged.

## Phase 7: Tests

Update `src/features/views/components/__tests__/ViewTransactionTable.test.tsx`.

Cover:

- The select column renders with header and row checkboxes.
- Selecting one or more rows shows the bulk action bar.
- Clearing selection hides the bulk action bar.
- Bulk pin opens the confirmation modal.
- Confirming bulk pin calls the hook with `{ viewId, ids }`.
- Bulk exclude opens the confirmation modal.
- Confirming bulk exclude calls the hook with `{ viewId, ids }`.
- Successful bulk action clears selection.
- Selecting only already pinned rows disables bulk pin.
- Existing search behavior still works.
- Existing view-key remount behavior still resets draft search input.

If test setup needs hook mocks, extend the existing `vi.mock('@/hooks/useViews')`
block to include:

- `useBulkPinTransactions`
- `useBulkExcludeTransactions`

## Phase 8: Documentation

Update `docs/api-integration.md` under Saved Views:

- Document bulk pin and bulk exclude endpoints.
- Document request and response shapes.
- Note that the view table supports selecting visible/search-filtered rows and
  applying bulk pin or exclude.
- Note that partial success is surfaced through warning toast feedback.

Do not link this plan from permanent documentation. Files under `docs/plans/`
are ephemeral working documents.

No `AGENTS.md` permission table update is needed unless the implementation adds
a new permission gate. Existing single-row view pin/exclude actions are not
permission-gated in the frontend, so the bulk actions should remain consistent
unless backend authorization requirements change.

## Phase 9: Verification

Run:

```bash
npm run lint:fix
npx vitest src/features/views/components/__tests__/ViewTransactionTable.test.tsx
npm run build
```

If new UI dependencies are added, also run the strict CSP smoke check:

```bash
npm run build:prod-smoke && rg -n "createElement\\('style'\\)|styleSheet\\.cssText|eval\\(" dist/
```

No new UI dependency should be needed for this work.
