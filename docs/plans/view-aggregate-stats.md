# Aggregate Stats with View Selection on Views Page

## Overview

Add aggregate statistics to the Views page showing combined totals from selected views. Users can select/deselect views by single-clicking cards, while double-clicking navigates to view details. All views are selected by default, and selections persist across sessions.

## Key Design Decisions

### 1. State Management: Redux + localStorage
- **Store**: Add `selectedViewIds: string[]` to `uiSlice.ts`
- **Persistence**: Sync to localStorage on every change (follows existing theme/displayCurrency pattern)
- **Initialization**: On views load, if localStorage is empty or contains only invalid IDs, select all views
- **Why Redux**: Centralized state with dev tools support, consistent with existing UI state

### 2. Click Interaction: Delay Pattern
- **Single click**: Toggle selection (250ms delay to detect double-click)
- **Double click**: Navigate to view detail page
- **Implementation**: `setTimeout` pattern with cleanup
- **Visual feedback**: Border color + background tint for selected state, checkmark icon in corner

### 3. Transaction Deduplication
- **Method**: `Map<number, Transaction>` using transaction ID as key
- **Complexity**: O(n) aggregation with automatic deduplication
- **Logic**: Collect transactions from all selected views, Map ensures uniqueness
- **Reuse**: Existing `filterTransactionsByCriteria()` for per-view filtering, `useTransactionStats()` for calculation

### 4. Stats Display
- **Layout**: Same as TransactionsPage - two `TransactionStatsGrid` components (main stats + monthly averages)
- **Components**: Reuse `StatCard`, `buildMainStatsConfig()`, `buildMonthlyStatsConfig()`
- **Placement**: Above view cards grid
- **Empty state**: Dashed card with message when no views selected

## File Changes

### 1. `/workspace/budget-analyzer-web/src/store/uiSlice.ts`

**Add to `UiState` interface:**
```typescript
selectedViewIds: string[];
```

**Add to `initialState`:**
```typescript
selectedViewIds: JSON.parse(localStorage.getItem('selectedViewIds') || '[]'),
```

**Add reducers:**
```typescript
toggleViewSelection: (state, action: PayloadAction<string>) => {
  const viewId = action.payload;
  const currentSet = new Set(state.selectedViewIds);
  if (currentSet.has(viewId)) {
    currentSet.delete(viewId);
  } else {
    currentSet.add(viewId);
  }
  state.selectedViewIds = Array.from(currentSet);
  localStorage.setItem('selectedViewIds', JSON.stringify(state.selectedViewIds));
},
setSelectedViewIds: (state, action: PayloadAction<string[]>) => {
  state.selectedViewIds = action.payload;
  localStorage.setItem('selectedViewIds', JSON.stringify(action.payload));
},
```

**Export actions:**
```typescript
export const {
  // ...existing exports
  toggleViewSelection,
  setSelectedViewIds,
} = uiSlice.actions;
```

### 2. `/workspace/budget-analyzer-web/src/features/views/hooks/useAggregateViewStats.ts` (NEW)

Create new hook that:
- Accepts `{ views, selectedViewIds, transactions, displayCurrency, exchangeRatesMap }`
- Uses `useMemo` to aggregate transactions from selected views
- Deduplicates using `Map<number, Transaction>` (transaction ID as key)
- Calls `useTransactionStats({ transactions: aggregatedTransactions, displayCurrency, exchangeRatesMap })`
- Returns `{ stats, monthlyAverages }`

**Dependencies**:
- `filterTransactionsByCriteria` from `@/utils/filterTransactions`
- `useTransactionStats` from `@/features/transactions/hooks/useTransactionStats`

### 3. `/workspace/budget-analyzer-web/src/features/views/components/SelectableViewCard.tsx` (NEW)

Extract ViewCard logic from ViewsPage.tsx with additions:
- **Props**: `view`, `isSelected`, `onToggleSelection`, plus data props (transactions, exchangeRatesMap, displayCurrency)
- **State**: `clickTimeout` for single/double-click discrimination
- **Handlers**:
  - `handleCardClick`: Set 250ms timeout to call `onToggleSelection`, cancel on double-click
  - `handleCardDoubleClick`: Cancel timeout, call `navigate(\`/views/${view.id}\`)`
  - Cleanup timeout on unmount
- **Visual**:
  - Selected: `border-primary bg-primary/5 shadow-md`
  - Unselected: default border with hover effects
  - Checkmark icon (lucide-react Check) in top-right corner when selected
- **Accessibility**: `role="checkbox"`, `aria-selected`, `tabIndex={0}`, keyboard handlers (Space to toggle, Enter to navigate)

**Calculate stats locally** using `filterTransactionsByCriteria()` for the card's own view (same as current ViewsPage line 128-130).

### 4. `/workspace/budget-analyzer-web/src/features/views/components/AggregateViewStats.tsx` (NEW)

Display aggregate statistics:
- **Props**: `views`, `selectedViewIds`, `transactions`, `displayCurrency`, `exchangeRatesMap`, `isExchangeRatesLoading`
- **Hook**: Call `useAggregateViewStats()` to get stats and monthly averages
- **Build configs**: Use `buildMainStatsConfig()` and `buildMonthlyStatsConfig()` (from transactions feature)
- **Empty state**: If `selectedViewIds.size === 0`, show dashed Card with message "Select one or more views to see aggregate statistics"
- **Layout**:
  - Header with "Aggregate Statistics" title and Badge showing selection count
  - Two `TransactionStatsGrid` components (main stats + monthly stats)
  - Wrap in `motion.div` with `layout` and `layoutTransition`

**Imports**:
- `buildMainStatsConfig`, `buildMonthlyStatsConfig` from `@/features/transactions/components/statsConfig`
- `TransactionStatsGrid` from `@/features/transactions/components/TransactionStatsGrid`

### 5. `/workspace/budget-analyzer-web/src/features/views/pages/ViewsPage.tsx`

**Modifications**:
- Import Redux hooks: `useAppSelector`, `useAppDispatch` from `@/store/hooks`
- Import actions: `toggleViewSelection`, `setSelectedViewIds` from `@/store/uiSlice`
- Get `selectedViewIds` from Redux store: `const selectedViewIds = useAppSelector(state => state.ui.selectedViewIds)`
- Convert to Set for usage: `const selectedViewIdsSet = new Set(selectedViewIds)`
- Add initialization `useEffect`:
  - Dependency: `[views, selectedViewIds, dispatch]`
  - If views loaded and (selectedViewIds is empty OR all IDs are invalid), dispatch `setSelectedViewIds(views.map(v => v.id))`
- Fetch exchange rates: `const { data: exchangeRatesMap, isLoading: isExchangeRatesLoading } = useExchangeRatesMap()`
- Add `<AggregateViewStats>` component before view cards grid
- Replace inline `ViewCard` with `<SelectableViewCard>` component
- Pass props: `isSelected={selectedViewIdsSet.has(view.id)}`, `onToggleSelection={() => dispatch(toggleViewSelection(view.id))}`
- Remove local `viewStatsMap` calculation (moved to SelectableViewCard)
- Wrap in `<LayoutGroup>` for Framer Motion layout animations

## Implementation Sequence

1. **Redux state** (`uiSlice.ts`) - Foundation
2. **Aggregate stats hook** (`useAggregateViewStats.ts`) - Core logic
3. **SelectableViewCard** (`SelectableViewCard.tsx`) - Reusable card
4. **AggregateViewStats** (`AggregateViewStats.tsx`) - Stats display
5. **ViewsPage integration** (`ViewsPage.tsx`) - Wire together

## Edge Cases

- **No views selected**: Show empty state message, no stats
- **Invalid IDs in localStorage**: Initialization logic filters and resets to all views
- **Deleted view was selected**: Automatic cleanup via Set operations on page load
- **Exchange rates loading**: Pass `isLoading` to StatCard components (shows skeletons)
- **No transactions in selected views**: Stats show zeros (handled by `useTransactionStats`)
- **Transaction overlap**: Deduplication ensures each transaction counted once

## Testing Checklist

- [ ] Single click toggles selection after 250ms delay
- [ ] Double click navigates immediately without toggling
- [ ] Selections persist across page reload
- [ ] All views selected by default on first load
- [ ] Stats update when toggling selections
- [ ] Deduplication works with overlapping views
- [ ] Empty state shows when no views selected
- [ ] Keyboard navigation (Space, Enter, Tab) works
- [ ] Responsive grid layout on mobile/tablet/desktop
- [ ] Visual selection feedback is clear (border, background, checkmark)
