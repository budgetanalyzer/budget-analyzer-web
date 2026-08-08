# Normalize Transaction Amount Sorting and Reset Pagination Plan

Update the user-facing transaction tables so the Amount column sorts each transaction by its transaction-date value in USD instead of comparing raw amounts denominated in different currencies. Apply the behavior consistently to the main Transactions table and saved-view transaction table, and return pagination to the first page whenever the user changes a sort so the newly ordered results begin at their natural starting point.

Prerequisites are already satisfied: both tables receive the map produced by `useExchangeRatesMap`, and `convertCurrency` already converts a dated amount from its source currency to USD using the application's established exact-rate and fallback-date rules.

## Phase 1: Implement USD-normalized sorting and first-page reset

### Goal

Make ascending and descending Amount sorts compare like-for-like USD values in every user-facing, client-side transaction table, with every sort change returning the user to the first result page.

### Scope

- In `src/features/transactions/components/TransactionTable.tsx`, derive memoized table rows that add a numeric USD sort value by calling `convertCurrency` with each row's amount, date, source currency, the fixed target currency `USD`, and `exchangeRatesMap`.
- Keep the column id as `amount` so the existing header control, sorting state, column-width lookup, and row rendering continue to work.
- Feed the derived rows to TanStack Table and make the Amount column read the derived USD value. Rebuild the derived array when transactions or `exchangeRatesMap` change so TanStack invalidates its row-value and sorted-row caches and recalculates an active Amount sort after rates load or refresh.
- Apply the same memoized USD sort value to `src/features/views/components/ViewTransactionTable.tsx`; retain its existing cells, selected display currency, page size, and pagination controls.
- In both tables, route TanStack's sorting updates through an explicit handler that applies the new sorting state and sets the controlled pagination page index to `0` in the same user interaction.
- Reset to page index `0` for every sortable column and for both direction changes, not only for the Amount column.
- Preserve signed numeric ordering: credits and debits continue to sort by their stored sign after conversion, rather than by absolute magnitude.
- Reuse `convertCurrency` and its existing nearest-date and unavailable-rate fallback semantics; do not duplicate exchange-rate lookup or conversion formulas inside either table.
- Update `docs/architecture.md` with the durable contracts that client-side Amount sorting on Transactions and saved-view detail uses transaction-date USD equivalents even when amounts are displayed in another selected currency, and that changing any table sort returns pagination to the first page.

### Non-goals

- Do not change the visible display currency or the formatted amount shown in table cells.
- Do not change amount filtering, saved-view criteria, statistics, transaction import, transaction editing, page sizes, or pagination controls.
- Do not change the exchange-rate lookup/fallback policy or the missing-exchange-rate banner. When no usable rate exists, sorting inherits `convertCurrency`'s current raw-amount fallback rather than fabricating a USD value.
- Do not change `TransactionSearchTable` in the admin cross-user search. It uses manual, server-side sorting over paginated results; normalized sorting there requires a backend API/query contract and cannot be implemented correctly by reordering one frontend page.
- Do not add dependencies or introduce inline styles.

### Required context

- `src/features/transactions/components/TransactionTable.tsx` currently declares the Amount column with `accessorKey: 'amount'`, which makes TanStack Table compare raw native-currency numbers.
- `src/features/views/components/ViewTransactionTable.tsx` repeats the same raw amount accessor for saved-view rows.
- `src/utils/currency.ts` owns `convertCurrency`; exchange rates are USD-to-target-currency series keyed by date, and source-currency-to-USD conversion divides by the applicable source rate.
- `src/hooks/useCurrencies.ts` builds and supplies `exchangeRatesMap`; map identity changes when fetched rate data changes.
- Both tables render cells from `row.original` (directly or through `EditableTransactionRow`), so changing the sorting accessor must not alter displayed values.
- The main Transactions table currently enables TanStack's automatic page-index reset, while the saved-view table explicitly disables it. The requested UX should be encoded in each controlled sorting callback instead of relying on those differing implicit settings.

### Implementation notes

- Define a local extended row type for each table (the original transaction shape plus an internal USD sort value), and build those rows with `useMemo`. Keep passing the extended row to existing callbacks and presentation components as the compatible base `Transaction` or `ViewTransaction` shape; never render the internal value.
- Prefer an `id: 'amount'` plus numeric `accessorFn` that reads the precomputed internal USD value. If TanStack Table does not infer numeric ordering reliably, set its built-in basic sorting function explicitly; do not write a second currency-aware comparator.
- Do not rely only on a column closure or a changed column definition when `exchangeRatesMap` changes. TanStack Table memoizes core rows by the `data` reference, caches accessor values on those rows, and memoizes the sorted row model by sorting state plus the pre-sorted row model. The derived data array must therefore receive a new identity when the rate map changes.
- A sort selected while rates are loading may initially use the established fallback, but rebuilding the derived data must settle it into USD-normalized order as soon as the populated map arrives. Implement this declaratively with memoized data; do not add an effect that resets sorting state.
- Keep the hard-coded sort basis as USD, independent of Redux's `displayCurrency`; the display preference affects presentation, not the canonical comparison currency requested here.
- Implement first-page snapping directly in the sort-change event handler. Resolve functional TanStack updaters against the current sorting state, update sorting, and reset the controlled page index without a `useEffect`.
- In `TransactionTable`, reset `pagination.pageIndex` while preserving `pagination.pageSize`. In `ViewTransactionTable`, set its separately controlled `pageIndex` to `0`.
- Keep any existing automatic page-reset setting needed for non-sort changes; the explicit sort handler is the source of truth for sort-triggered navigation.
- Use mixed-currency fixtures whose raw numeric order differs from their USD order, such as a JPY transaction and a USD transaction on dates with known rates. Assert row order by unique descriptions or other accessible cell content, not internal TanStack state.

### Validation

- Extend `src/features/transactions/components/__tests__/TransactionTable.test.tsx` to verify mixed-currency ascending and descending Amount sorts use USD equivalents, and that a populated exchange-rate map supplied after render recalculates an already-active Amount sort.
- Extend `src/features/views/components/__tests__/ViewTransactionTable.test.tsx` with the same mixed-currency sorting coverage so the two independent column definitions cannot drift.
- In each table test suite, navigate to a later page, change a sort, and assert that the first page is shown. Cover a direction toggle as well as the initial sort selection across the two suites so the reset is proven to apply to all sorting updates.
- Keep or add a USD-only assertion showing that no exchange-rate entry is required for USD rows.
- Run focused tests:

  ```bash
  npx vitest src/features/transactions/components/__tests__/TransactionTable.test.tsx src/features/views/components/__tests__/ViewTransactionTable.test.tsx
  ```

- Apply repository-standard linting and formatting, then run the full build gate:

  ```bash
  npm run lint:fix
  npm run format
  npm run build
  ```

- Manually verify on both `/` and `/views/:id` with at least two currencies that clicking Amount toggles between ascending and descending USD-equivalent order while cells remain formatted in the selected display currency.

### Completion criteria

- The main Transactions and saved-view tables sort Amount by transaction-date USD equivalents for both directions.
- An active Amount sort refreshes when the exchange-rate map changes.
- Changing any sortable column or toggling its direction returns both client-side tables to page index `0`.
- Visible amount formatting and all non-sort behaviors remain unchanged.
- Mixed-currency regression tests pass for both tables, and the repository build gate passes.
- `docs/architecture.md` records the client-side sorting contract and the implementation adds no CSP violations or new dependency.
