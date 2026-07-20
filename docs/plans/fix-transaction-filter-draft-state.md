# Transaction Filter Draft State Regression Fix Plan

Correct three regressions in the shared transaction filter experience: Clear
must discard pending search and amount drafts, saved-view filter changes must
not discard unrelated drafts while pagination and selection still reset, and
dynamic bank/account options must never collide with the frontend's no-filter
sentinel.

No backend or cross-repository prerequisite is required. Bank names and account
IDs remain unrestricted API strings, and the backend contract continues to
represent an absent filter by omitting it rather than by accepting a magic
`all` or `ALL` value. The fixes are confined to this repository's component
state boundaries and internal select-value encoding.

## Phase 1: Make Shared Filter Draft Reset And Select Values Unambiguous

### Goal

Update `TransactionFilterBar` so its Clear action immediately resets all local
draft inputs and cancels pending amount commits, while real bank names and
account IDs round-trip through the selects even when they equal the current
`all` sentinel or resemble the internal encoding.

### Scope

- Add a shared-bar-owned reset mechanism for the draft search and amount input
  subcomponents.
- Route the visible Clear button through a memoized local handler that resets
  drafts and invokes the caller's existing `onClearAllFilters` callback.
- Encode dynamic bank and account select values into a namespace distinct from
  the no-filter option, and decode them before calling the existing filter
  callbacks.
- Expand `TransactionFilterBar` tests for pending drafts, real `all` values,
  and selecting the no-filter options.

### Non-goals

- Do not send `all`, `ALL`, or another magic sentinel to the backend or add a
  backend contract.
- Do not change the visible labels `All Banks`, `All Accounts`, or `All Types`.
- Do not change the 400 ms amount debounce, explicit Enter-to-submit search,
  URL parameter names, or transaction filtering semantics.
- Do not add a UI dependency, inline styles, prop-to-state effects, or ESLint
  suppressions.

### Required context

- `src/components/TransactionFilterBar.tsx` keys its draft subcomponents only
  from their applied values. Clicking Clear while those values are already
  empty does not remount the inputs, so a pending amount timer can restore a
  filter and an unsubmitted search remains visible.
- `useDebounce` synchronizes with a timer; unmounting the amount draft component
  must clean up the pending debounce before it can call
  `onAmountFilterChange`.
- Bank names and account IDs come from API data and are unrestricted strings.
  Transaction type is a closed `DEBIT | CREDIT` enum, so its existing raw
  no-filter sentinel cannot collide with a valid type.
- Radix select item values must be non-empty strings, but those internal values
  do not need to equal the strings sent to filter callbacks.

### Implementation notes

1. Add a reset generation or equivalent local state to
   `TransactionFilterBar`. Include it in the keys for both
   `TransactionSearchInput` and `AmountFilterInputs` so Clear remounts both
   drafts even when their applied-value-derived keys would otherwise remain
   unchanged.
2. Implement a `useCallback` Clear handler that advances the reset generation
   and then invokes `onClearAllFilters`. Keep the callback passed to the shared
   bar as the only authority for clearing applied URL filters.
3. Ensure the reset occurs in the same user action as the applied-filter clear.
   In the regression case, an active bank/date/type filter may make Clear
   visible while search and amount exist only as local drafts; both drafts must
   become empty immediately and the old amount debounce must never fire.
4. Keep applied-value keys in addition to the explicit reset generation so
   browser navigation, analytics drilldowns, and other external URL changes
   continue to replace stale drafts.
5. Define small module-local helpers/constants for dynamic select values. Use
   a tagged representation such as a dedicated no-filter token and a prefix
   applied to every real value. Decode exactly one tag layer so arbitrary
   values including `all`, the no-filter token text, an empty string, or the
   chosen prefix text can round-trip without collision.
6. Apply the tagged representation to both each dynamic `SelectItem` and the
   controlled `Select` value for bank and account filters. The change handlers
   must map only the dedicated no-filter token to `null` and pass decoded real
   values unchanged to the existing callbacks.
7. Leave the transaction-type selector on its simpler enum mapping; its valid
   backend values cannot equal the frontend all-state.
8. Add focused tests that:
   - render an unrelated applied filter, enter unsubmitted search and amount
     drafts, click Clear, and assert both inputs reset immediately;
   - advance fake timers beyond 400 ms after Clear and assert the discarded
     amount draft is not committed;
   - select real bank and account options literally named `all` and assert the
     callbacks receive the string `all`, not `null`;
   - cover a real value resembling the chosen tag/prefix so the encoding is
     demonstrably reversible;
   - select `All Banks` and `All Accounts` from an applied state and assert the
     callbacks still receive `null`.

### Validation

Run the shared component test and local quality checks:

```bash
npx vitest src/components/__tests__/TransactionFilterBar.test.tsx
npm run lint:fix
npm run format
npm run build:bundle
```

Inspect the component to confirm that no backend-facing value or URL filter is
set to the internal sentinel and that no inline `style` prop was introduced.

### Completion criteria

- Clear immediately removes pending search and amount drafts in addition to
  invoking the applied-filter clear callback.
- Advancing the debounce clock after Clear cannot restore the discarded amount
  filter.
- Every dynamic bank name and account ID, including `all`, is selectable and
  reaches its callback unchanged.
- Selecting the visible all-state continues to produce `null`.
- The focused test, lint autofix, formatting, and bundle build pass.

## Phase 2: Preserve Saved-View Drafts Outside The Table Reset Boundary

### Goal

Refactor `ViewTransactionTable` so an applied filter change resets table-only
state without remounting `TransactionFilterBar`, while navigating to a
different saved view still resets that view's drafts.

### Scope

- Move the saved-view filter bar outside the content subtree keyed by applied
  filters.
- Keep pagination, row selection, select-all state, modal state, and other
  table-local state inside the keyed reset subtree.
- Key the filter bar by saved-view identity so drafts do not leak between
  different views.
- Add regression coverage for preserving amount and search drafts across
  same-view filter changes and retaining the existing pagination/selection
  reset behavior.

### Non-goals

- Do not preserve pagination or bulk selection across applied filter changes.
- Do not preserve drafts when `viewId` changes.
- Do not alter saved-view membership, pin/exclude mutations, sorting behavior,
  table columns, URL synchronization, or the table's 20-row page size.
- Do not add effects that copy filter props into table state.

### Required context

- `src/features/views/components/ViewTransactionTable.tsx` currently keys the
  entire `ViewTransactionTableContent` with `viewId` plus serialized filters.
  That successfully resets pagination and selection but also remounts the
  nested shared filter bar.
- `TransactionFilterBar` owns an amount draft that commits after 400 ms and a
  search draft that commits on Enter. Neither draft belongs to table
  pagination or row selection state.
- The existing saved-view component tests assert that applied filters reset
  pagination and selection and that changing `viewId` clears an unsubmitted
  search draft. Both contracts must remain covered after moving the boundary.
- The outer layout currently uses one `space-y-4` wrapper around the filter
  bar, selection banners, table, and pagination; preserve the rendered layout
  when separating the resettable content.

### Implementation notes

1. Make the public `ViewTransactionTable` render the shared
   `TransactionFilterBar` outside the filter-keyed content component. Pass the
   same controlled filter values, option arrays, and callbacks as today.
2. Key the filter bar by `viewId` only. This preserves drafts when bank,
   account, date, type, amount, or applied search changes within one view, but
   remounts the drafts when navigation switches to another view.
3. Keep a separate child containing all TanStack table state and saved-view row
   actions. Key that child by `viewId` and the complete applied filter values so
   all existing reset behavior remains deterministic for URL-driven changes,
   including browser navigation.
4. Avoid duplicating the outer spacing or introducing fragments that change
   banner/table layout. Adjust component props so the resettable child receives
   only the values and callbacks it actually needs; the filter callback props
   should remain at the public boundary for the filter bar.
5. Preserve the empty-state calculation based on the current complete filter
   object, even though the filter bar is no longer rendered by the resettable
   child.
6. Add a regression test that enters an amount draft, changes another applied
   filter on the same view before 400 ms, confirms the input draft remains,
   then advances the timer and confirms the amount callback commits it.
7. In the same-view boundary tests, verify an unsubmitted search draft also
   survives an unrelated applied filter change. Keep the separate existing
   assertion that changing `viewId` resets the draft.
8. Retain or strengthen the existing test showing that a filter change returns
   page 2 to page 1 and clears bulk row selection. These assertions prove the
   reset boundary moved rather than being removed.

### Validation

Run the shared and saved-view component tests, then the local quality checks:

```bash
npx vitest src/features/views/components/__tests__/ViewTransactionTable.test.tsx
npx vitest src/components/__tests__/TransactionFilterBar.test.tsx
npm run lint:fix
npm run format
npm run build:bundle
```

Use fake timers only around the amount-debounce regression and restore real
timers after the test so unrelated user-event tests remain stable.

### Completion criteria

- Changing an applied filter within the same saved view does not remount the
  filter bar or erase unrelated search/amount drafts.
- A pending amount draft still commits after an unrelated same-view filter
  change.
- Applied filter changes still reset pagination, row selection, select-all
  state, and other table-local state.
- Changing `viewId` still resets drafts and table-local state.
- Focused tests, lint autofix, formatting, and the bundle build pass.

## Phase 3: Document And Verify The Corrected Filter Contract

### Goal

Record the user-visible draft/reset behavior in durable documentation and run
the repository's full gates across the main Transactions and saved-view
surfaces.

### Scope

- Update the nearest filtering documentation with the corrected Clear and
  saved-view draft-preservation behavior.
- Review both consumers of `TransactionFilterBar` for consistent behavior.
- Run full coverage, formatting, lint autofix, and production bundle checks.

### Non-goals

- Do not document internal sentinel strings as API values; they are private UI
  implementation details.
- Do not broaden the work into filter redesign, backend changes, dependency
  upgrades, or unrelated table cleanup.
- Do not run `npm run dev`; the user controls the development server.
- Do not perform git write operations or link this plan from durable non-plan
  documentation.

### Required context

- `docs/api-integration.md` is the nearest durable description of the shared
  URL-backed temporary filters and already states that Clear removes the
  transaction filter parameters and analytics return context.
- The corrected contract distinguishes applied URL filter state from local,
  not-yet-submitted search and amount drafts.
- The internal dynamic select encoding is not part of the backend API. An
  absent bank/account filter remains `null` in component callbacks and omitted
  from the URL/API request.
- Repository coverage thresholds are 80% statements, 80% branches, 75%
  functions, and 80% lines.

### Implementation notes

1. Update `docs/api-integration.md` near the temporary-filter description to
   state that Clear also discards unsubmitted search and amount drafts, and
   that applying one saved-view filter resets pagination/selection without
   discarding unrelated drafts in the filter bar.
2. Keep the documentation phrased as user-visible behavior. Do not mention the
   private select sentinel, its tag/prefix, React keys, or component names.
3. Search both table implementations to confirm they still consume the same
   shared filter bar and that the saved-view filter-keyed subtree contains only
   table state.
4. Review test coverage for all three reported cases on both surfaces. The
   shared component test owns Clear and collision-free option coverage; the
   saved-view table test owns the reset-boundary regression.
5. Run lint autofix before formatting. If either modifies source or tests,
   rerun the affected focused tests before the full coverage and bundle gates.

### Validation

```bash
npm run lint:fix
npm run format
npm run test:coverage
npm run build:bundle
rg -n "TransactionFilterBar" src/features/transactions src/features/views
rg -n "style=" src/components/TransactionFilterBar.tsx src/features/views/components/ViewTransactionTable.tsx
```

The final search is expected to produce no matches. Review the diff to ensure
only this repository changed and that no generated bundle or coverage artifact
is included in the implementation changes.

### Completion criteria

- Durable documentation describes the corrected Clear and saved-view draft
  behavior without exposing frontend sentinels as backend values.
- Regression tests cover all three review findings and pass.
- Main Transactions and saved-view detail continue to share one filter bar and
  retain their intended distinct table behavior.
- Lint autofix, formatting, full coverage, and the production bundle pass.
- No new dependency, inline style, dev server, backend change, or git write
  operation was introduced.
