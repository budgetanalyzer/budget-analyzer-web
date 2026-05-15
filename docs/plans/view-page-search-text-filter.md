# View Page Search Text Filter Plan

Date: 2026-05-15

## Goal

Add a simple `searchText` control to the saved view detail page so a user can narrow the transactions currently visible in that view, especially while cleaning up broad views such as "all debits".

The behavior should match the main transactions search:

- The input uses the same quoted phrase and bare term parsing.
- Multiple terms are OR'd together.
- Matching is case-insensitive.
- A term matches when it appears in the transaction description or bank name.
- Typing does not apply the filter until Enter is pressed.
- Clearing the search applies immediately.
- The table returns to page 1 when the applied search changes.

## Current Code Shape

- Main transaction search lives across:
  - `src/features/transactions/pages/TransactionsPage.tsx`
  - `src/features/transactions/components/TransactionTable.tsx`
  - `src/utils/parseSearchTerms.ts`
- Saved view detail page lives in:
  - `src/features/views/pages/ViewPage.tsx`
  - `src/features/views/components/ViewTransactionTable.tsx`
- `ViewPage.tsx` currently passes all loaded view transactions directly into `ViewTransactionTable`.
- `ViewTransactionTable.tsx` owns local sorting and pagination but has no search toolbar.
- `src/utils/filterTransactions.ts` uses `criteria.searchText` with saved-view API semantics, which intentionally match descriptions only. Do not change that backend criteria behavior as part of this work.

## Assumptions

- This is a local UI filter for the current view page. It should not update the saved view criteria, call `updateView`, or persist `criteria.searchText`.
- The filter should operate only on the transactions already returned by `useViewTransactions(id)`, including matched and pinned transactions that are active in the view.
- Excluded transactions are not visible in `ViewTransactionTable` today and should remain out of scope.
- View stats should update to reflect the locally searched rows, matching how the main transactions page stats use `filteredTransactions`.
- No route-level permission gate is needed because this does not expose a new action or backend resource.

## Implementation Steps

1. Add a shared transaction table search helper.

   Create `src/utils/transactionSearch.ts` with a small exported helper, for example:

   - `filterTransactionsByTableSearch<T extends Pick<Transaction, 'description' | 'bankName'>>(transactions: T[], searchText: string): T[]`
   - Internally call `parseSearchTerms(searchText)`.
   - Return the original array when `searchText` is blank or parses to no terms.
   - Match any term against lower-cased `description` or `bankName`.

   Keep this helper separate from `filterTransactionsByCriteria` because saved-view API criteria intentionally have different `searchText` semantics.

2. Reuse the helper in the main transactions page.

   Update `src/features/transactions/pages/TransactionsPage.tsx`:

   - Remove the inline `parseSearchTerms` import and inline description/bank filter block.
   - Import `filterTransactionsByTableSearch`.
   - Replace the global filter branch with `filtered = filterTransactionsByTableSearch(filtered, globalFilter)`.

   This locks the view-page search to the same implementation as the main transactions search instead of copy/pasting behavior.

3. Add local applied search state to `ViewPage.tsx`.

   Update `src/features/views/pages/ViewPage.tsx`:

   - Add `const [viewSearchText, setViewSearchText] = useState('');`.
   - Add `handleViewSearchChange` with `useCallback((query: string) => setViewSearchText(query), [])`.
   - Build `filteredTransactions` with `useMemo(() => filterTransactionsByTableSearch(transactions ?? [], viewSearchText), [transactions, viewSearchText])`.
   - Use `filteredTransactions` for stats and date range calculations so stat cards reflect the current local search.
   - Keep the `PageHeader` description based on the full view count unless product direction says otherwise. The table footer will show the filtered count.
   - Pass `filteredTransactions` to `ViewTransactionTable`.
   - Pass `searchText={viewSearchText}` and `onSearchChange={handleViewSearchChange}` to `ViewTransactionTable`.

4. Add the search toolbar to `ViewTransactionTable.tsx`.

   Update `src/features/views/components/ViewTransactionTable.tsx`:

   - Add imports for `Input`, `Search`, and `X`.
   - Extend props with:
     - `searchText: string`
     - `onSearchChange: (query: string) => void`
   - Add `const [localSearchValue, setLocalSearchValue] = useState(searchText);`.
   - Add `handleSearchSubmit` with `useCallback(() => onSearchChange(localSearchValue), [localSearchValue, onSearchChange])`.
   - Add `handleSearchKeyDown` to call submit on Enter.
   - Add `handleClearSearch` to set local state to `''` and call `onSearchChange('')`.
   - Render a compact search input above the table, matching `TransactionTable` markup:
     - leading `Search` icon
     - placeholder `"exact phrase" term1 term2 ↵`
     - `className="pl-9 pr-9"`
     - trailing clear button with `X`
   - Do not add inline styles; use Tailwind classes only.
   - Do not add tooltips. If the clear button needs accessible text, use an `sr-only` label rather than `title`.

5. Reset view table pagination when search changes.

   In `ViewTransactionTable.tsx`, ensure applied search changes return the table to page 1:

   - Either call `setPageIndex(0)` inside `handleSearchSubmit` and `handleClearSearch`, or
   - Add a focused `useEffect` that watches `searchText` and calls `setPageIndex(0)`.

   Prefer the event-handler approach to avoid adding `useEffect` for non-external state unless a later implementation detail requires syncing local input with external state.

6. Improve empty-state copy.

   In `ViewTransactionTable.tsx`, distinguish the no-results case from the empty-view case:

   - If `searchText` is non-empty and `transactions.length === 0`, show `No transactions match this search.`
   - If `searchText` is empty and `transactions.length === 0`, keep `No transactions in this view.`

7. Add focused tests.

   Add `src/features/views/components/__tests__/ViewTransactionTable.test.tsx`:

   - Render a table with at least three transactions: one description match, one bank-name match, one non-match.
   - Type a bare term, press Enter, and assert the callback receives the typed query.
   - Render with filtered rows and `searchText` set, then assert the filtered empty state says `No transactions match this search.`
   - Click the clear button and assert the callback receives `''`.

   Update or add a utility test for `filterTransactionsByTableSearch`:

   - Bare terms match descriptions.
   - Bare terms match bank names.
   - Quoted phrases match exact phrases.
   - Multiple terms are OR'd.
   - Blank input returns all rows.

   Add a lightweight regression in `TransactionsPage` only if the helper refactor is not already covered by the utility tests.

8. Run verification.

   Run:

   ```bash
   npm run lint:fix
   npx vitest src/features/views/components/__tests__/ViewTransactionTable.test.tsx
   npx vitest src/utils
   ```

   If the utility tests live outside `src/utils`, adjust the final command to the actual test path.

   Do not run `npm run dev`; the repository instructions say the user controls the dev server.

9. Update documentation if implementation changes behavior beyond this plan.

   No broad docs update should be needed for a local view-page control. If the implementation changes saved-view criteria semantics, update `docs/api-integration.md`, but that is explicitly out of scope for this plan.

## Implementation Status

- Steps 7-9 completed on 2026-05-15.
- Added focused tests for `ViewTransactionTable` search submit, filtered empty state, and clear behavior.
- Added utility coverage for `filterTransactionsByTableSearch` description matching, bank-name matching, quoted phrases, OR matching, and blank input.
- Verification passed:
  - `npm run lint:fix`
  - `npx vitest src/features/views/components/__tests__/ViewTransactionTable.test.tsx`
  - `npx vitest src/utils`

## Acceptance Criteria

- A search input appears on `/views/:id` above the view transaction table.
- Pressing Enter applies the text filter.
- The clear button removes the filter immediately.
- Matching behavior is identical to main transactions search for description, bank name, quoted phrases, bare terms, OR matching, and case-insensitivity.
- Stats on the view page reflect the searched rows.
- Pagination resets to the first page when a new search is applied or cleared.
- No inline `style={...}` props or runtime style injection are introduced.
- Tests cover the shared search helper and the view table search control behavior.

## Clarifying Questions

1. Should the view page search update the URL query string for bookmarkability, or is reset-on-navigation local state preferred?
2. Should the `PageHeader` description stay as the full saved-view count, or change to something like `12 of 340 transactions` when search is active?
3. Should the search apply only when pressing Enter, exactly like the current main transactions table, or should this new view-page search filter as the user types?
