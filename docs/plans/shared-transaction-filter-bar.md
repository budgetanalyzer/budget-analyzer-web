# Shared Transaction Filter Bar Plan

Consolidate the duplicated transaction search/filter headers into one shared,
controlled component and give saved-view detail the same temporary bank,
account, transaction type, and amount filters as the main Transactions page.
The main and saved-view tables keep their distinct row behavior and actions;
only their filtering model, filter UI, and client-side filter semantics are
shared.

No backend prerequisite is required. `ViewTransaction` already extends
`Transaction`, the canonical saved-view membership endpoint already supplies
all fields needed by these filters, and the new saved-view filters operate only
on the transactions already loaded for that view. They must not modify the
saved view's persisted criteria, pins, or exclusions.

## Phase 1: Extract And Adopt The Shared Filter Foundation

### Goal

Create a reusable transaction filter model, client-side filter utility, and
filter-bar component, then replace the main transaction table's inline header
without changing its user-facing controls or main-only actions.

### Scope

- Add a shared filter value type for:
  - description search text;
  - optional date bounds;
  - bank name;
  - account ID;
  - transaction type (`DEBIT` or `CREDIT`);
  - absolute minimum and maximum amount.
- Add a shared, generic client-side transaction filtering utility that accepts
  both `Transaction[]` and subtypes such as `ViewTransaction[]`.
- Add `src/components/TransactionFilterBar.tsx` as the single rendering and
  interaction implementation for the filter header.
- Refactor `TransactionTable` and `TransactionsPage` to use the shared model,
  utility, and component.
- Add focused tests beside the shared component and utility, and update the
  existing main transaction tests where their setup is affected.

### Non-goals

- Do not reuse the complete `TransactionTable` for saved views.
- Do not change editable rows, delete behavior, selection behavior,
  pagination, sorting, imports, or saved-view creation behavior.
- Do not add a UI dependency or change the backend API contract.
- Do not add currency as a filter; it is not present in the current main
  transaction filter bar.
- Do not integrate the shared bar into `ViewTransactionTable` in this phase.

### Required context

- `src/features/transactions/components/TransactionTable.tsx` currently owns
  the main filter markup plus draft search and amount input state.
- `src/features/transactions/pages/TransactionsPage.tsx` currently applies
  the filters and builds `ViewCriteriaApi` for `SaveAsViewButton`.
- `src/features/transactions/hooks/useTransactionFiltersSync.ts` is currently
  the complete URL-backed filter implementation.
- `src/utils/transactionSearch.ts` defines the existing case-insensitive,
  description-only search semantics and must remain the source for text
  matching.
- `src/components/DateRangeFilter.tsx`, the existing Select primitives, and
  Tailwind classes are the required UI building blocks.
- The strict CSP prohibition on inline styles and runtime style injection
  applies to the new component.

### Implementation notes

1. Define one shared filter value shape rather than passing slightly different
   date and amount shapes between pages. Keep `null` as the absence value so it
   aligns with the existing URL hook and table props.
2. Implement the shared filtering utility with the current product semantics:
   - apply each present date boundary independently with helpers from
     `src/utils/dates.ts`;
   - use `filterTransactionsByTableSearch` for description search;
   - compare bank name, account ID, and transaction type exactly;
   - compare minimum and maximum against `Math.abs(transaction.amount)`;
   - preserve the input order and generic subtype in the result.
   Independent date bounds make a partially entered range behave consistently
   on both transaction surfaces; cover this explicitly because the main page
   currently waits for both bounds while view detail already supports either
   bound.
3. Make `TransactionFilterBar` controlled for applied filter values and
   callbacks. It should render, in the same order on both pages:
   - description search;
   - date range;
   - bank selector when more than one bank option exists;
   - account selector when more than one account option exists;
   - transaction type selector with All Types, Debit, and Credit;
   - minimum and maximum amount inputs;
   - separator, Clear action, and an optional contextual action area when any
     filter is active.
4. Preserve the existing explicit search submission on Enter and 400 ms amount
   debounce. Draft inputs must also reflect URL changes caused by Clear,
   browser navigation, or analytics drilldowns. Do not use an effect merely to
   copy props into state; isolate draft input components and reset them with
   keys based only on their corresponding applied value. An effect remains
   appropriate for committing debounced amount drafts because it synchronizes
   with the debounce timer.
5. Keep the header responsive with one shared Tailwind class layout. Add
   accessible button text for icon-only search clearing; do not use a tooltip
   or a `title` attribute as the only label.
6. Let the caller supply an optional React node for contextual actions. The
   main table should supply `SaveAsViewButton` only under the same conditions as
   today; the shared component must not import or understand saved views.
7. Remove the filter-specific inputs, icons, select handlers, draft state, and
   debounce logic from `TransactionTable` after the shared component owns them.
   Keep table-specific state and behavior inside `TransactionTable`.
8. Derive available banks and accounts from the complete unfiltered main
   transaction collection, as today. Ensure options are unique and sorted.
9. Use path aliases for all new imports and Tailwind classes for all styling.
   Do not add inline `style` props or ESLint suppressions.

### Validation

Run focused checks after the refactor:

```bash
npx vitest src/components/__tests__/TransactionFilterBar.test.tsx
npx vitest src/utils/__tests__/transactionFilters.test.ts
npx vitest src/features/transactions/components/__tests__/TransactionTable.test.tsx
npx vitest src/features/transactions/pages/__tests__/TransactionsPage.test.tsx
npm run lint:fix
npm run format
npm run build:bundle
```

Tests must cover search submission and clearing, conditional bank/account
selectors, type selection, debounced amount changes, Clear, the optional
contextual action, every filtering dimension, combined filters, and one-sided
date ranges.

### Completion criteria

- The main Transactions page renders its existing filter controls through
  `TransactionFilterBar`.
- `TransactionTable` contains no duplicate filter-header markup or draft input
  implementation.
- Main-page filtering and Save as View remain functional.
- The shared filter utility is subtype-safe and fully covered by focused tests.
- The focused tests, lint autofix, formatting, and bundle build pass.

## Phase 2: Give Saved-View Detail The Complete Shared Filter Experience

### Goal

Use the same URL-backed filter model, shared header, and client-side filter
utility on saved-view detail so users can temporarily separate debits from
credits and apply every filter available on the main Transactions page.

### Scope

- Move the complete URL-backed filter hook to a shared top-level hook location
  and update both transaction surfaces to import it.
- Remove the reduced saved-view-specific filter hook and its duplicate tests.
- Extend `ViewPage` to compute filter options and apply every shared filter to
  visible saved-view membership.
- Replace `ViewTransactionTable`'s search/date-only header with
  `TransactionFilterBar`.
- Update hook, component, and page tests for the complete saved-view filtering
  behavior.

### Non-goals

- Do not mutate `SavedView.criteria` when a temporary table filter changes.
- Do not call an additional backend endpoint or push temporary filters into
  `useViewTransactions`.
- Do not change which transactions are matched, pinned, excluded, or restored.
- Do not put Save as View inside an existing saved view.
- Do not merge the main and saved-view table bodies, row actions, bulk actions,
  selection banners, or pagination settings.

### Required context

- `src/features/views/hooks/useViewTransactionFiltersSync.ts` currently
  supports only `dateFrom`, `dateTo`, and `q`.
- `src/features/transactions/hooks/useTransactionFiltersSync.ts` already
  parses and serializes the complete filter set, including the legacy `bank`
  and `account` aliases.
- `ViewPage` obtains canonical visible membership through
  `useViewTransactions(id)` and derives both stats and table rows from its
  locally filtered list.
- `ViewTransactionTable` has saved-view-only membership columns, pin/unpin and
  exclude actions, bulk actions, and a 20-row page size; these remain separate
  from the main table.
- Analytics drilldowns add date filters plus `returnTo` and `breadcrumbLabel`;
  filter updates must preserve that unrelated URL context, while clearing all
  filters must continue to remove it.

### Implementation notes

1. Relocate the complete hook to
   `src/hooks/useTransactionFiltersSync.ts`. Update both pages to consume its
   common `filters` object and callbacks, then delete both obsolete feature
   hook implementations. Do not leave compatibility wrappers that allow the
   hooks to diverge again.
2. Relocate and expand the hook tests under `src/hooks/__tests__/`. Cover:
   - parsing every canonical filter parameter;
   - accepting the existing `bank` and `account` aliases;
   - serializing search, dates, bank, account, type, and amounts while
     preserving unrelated URL parameters;
   - rejecting invalid transaction type and non-finite amount values safely;
   - clearing all filter parameters, aliases, and analytics return context.
3. In `ViewPage`, derive unique sorted bank and account options from the full
   `transactions` membership before temporary filters are applied. A pinned
   transaction contributes options exactly like a matched transaction.
4. Apply the shared filtering utility to the canonical view transactions.
   Pass that one filtered result to both `useTransactionStats` and
   `ViewTransactionTable`, so cards and rows always describe the same subset.
5. Pass all shared filter values, option lists, and callbacks through
   `ViewTransactionTable` to `TransactionFilterBar`. Do not pass a contextual
   action, so saved-view detail displays Clear but not Save as View.
6. Retain the saved-view empty-state distinction:
   - no temporary filters: `No transactions in this view.`;
   - any temporary filter: `No transactions match these filters.`
   The active-filter calculation must include bank, account, type, and amount.
7. Preserve the existing behavior that a filter change returns the saved-view
   table to its first page and prevents stale bulk selection from acting on a
   newly filtered set. Extend the existing keyed reset or use explicit
   callbacks for every new filter dimension; do not add prop-to-state effects.
8. Treat type selection as temporary presentation state. Choosing Credit must
   hide debit rows and recalculate the stats, but it must not update view
   metadata or issue a saved-view mutation.
9. Keep navigation to transaction detail based on the complete current
   `location.pathname + location.search`, so returning from a row preserves all
   temporary filters.

### Validation

Run the focused shared and saved-view tests:

```bash
npx vitest src/hooks/__tests__/useTransactionFiltersSync.test.tsx
npx vitest src/features/views/components/__tests__/ViewTransactionTable.test.tsx
npx vitest src/features/views/pages/__tests__/ViewPage.test.tsx
npx vitest src/components/__tests__/TransactionFilterBar.test.tsx
npx vitest src/utils/__tests__/transactionFilters.test.ts
npm run lint:fix
npm run format
npm run build:bundle
```

Use fixtures containing at least one debit and one credit, multiple banks, and
multiple accounts. Verify through user-visible behavior that selecting Credit
updates the URL, rows, empty state, and stats without invoking pin, exclude, or
view-update mutations. Also verify bank, account, and amount filters and a
combined filter case.

### Completion criteria

- Main Transactions and saved-view detail render the same shared filter-bar
  component and control order.
- Saved-view detail exposes working bank, account, type, and amount filters in
  addition to search and dates.
- All temporary saved-view filters are refreshable and shareable through the
  URL.
- Filtered saved-view stats and rows use the identical transaction subset.
- No saved-view criteria or membership mutation runs when a temporary filter
  changes.
- Only one complete URL filter hook remains in the repository.
- Focused tests, lint autofix, formatting, and the bundle build pass.

## Phase 3: Document And Verify The Consolidated Behavior

### Goal

Update durable documentation and run the full quality gates so the shared
filter contract is clear and the refactor is safe across the application.

### Scope

- Update the nearest saved-view and transaction filtering documentation.
- Review the final implementation for duplicated filter markup, feature-layer
  import violations, accessibility, responsive layout, and strict CSP
  compliance.
- Run the repository's full test coverage and production bundle checks.

### Non-goals

- Do not introduce unrelated table redesigns or opportunistic dependency
  upgrades.
- Do not run `npm run dev`; the user controls the development server.
- Do not perform git write operations.
- Do not link this plan from durable non-plan documentation.

### Required context

- `docs/api-integration.md` currently says saved-view detail supports only
  `dateFrom`, `dateTo`, and `q`; that statement becomes incorrect after Phase
  2.
- Documentation must distinguish persisted saved-view criteria from temporary
  URL-backed detail filters.
- Repository coverage thresholds are 80% statements, 80% branches, 75%
  functions, and 80% lines.
- `npm run lint:fix` is required instead of running the non-fixing lint command
  first.

### Implementation notes

1. Update `docs/api-integration.md` to list the full saved-view detail filter
   parameters: `q`, `dateFrom`, `dateTo`, `bankName`, `accountId`, `type`,
   `minAmount`, and `maxAmount`.
2. Document that these parameters filter already loaded canonical membership
   locally, affect both table rows and stats, survive refresh/navigation, and
   do not alter persisted view criteria or membership.
3. Keep the existing description-only search and absolute amount semantics
   explicit. Retain the analytics return-context behavior.
4. Search the final source to confirm both tables import
   `TransactionFilterBar` and no old inline header or feature-specific filter
   hook remains.
5. Confirm the shared component has no inline styles, tooltip-only information,
   runtime style injection, or new dependency. Because no dependency is added,
   a dependency-specific CSP bundle audit is not required, but the normal
   production bundle must still succeed.
6. Run formatting after lint autofix if either command changes files, then
   rerun any affected focused tests before the full gates.

### Validation

```bash
npm run lint:fix
npm run format
npm run test:coverage
npm run build:bundle
rg -n "TransactionFilterBar" src/features/transactions src/features/views
rg -n "useViewTransactionFiltersSync|features/transactions/hooks/useTransactionFiltersSync" src
rg -n "style=|title=\"Clear search\"" src/components/TransactionFilterBar.tsx
```

The last two searches are expected to produce no matches. Inspect coverage
failures for missing product behavior rather than adding percentage-only tests.

### Completion criteria

- `docs/api-integration.md` accurately describes the consolidated temporary
  filter behavior and URL contract.
- Durable documentation does not link to this plan.
- There is one shared filter header, one shared filter model/utility, and one
  shared URL-state hook.
- Main and saved-view-specific table actions remain separate and functional.
- Lint autofix, formatting, full coverage, and the production bundle all pass.
- No dev server or git write operation was run.
