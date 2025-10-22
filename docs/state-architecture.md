# State Architecture Guide

This document explains how state management works in the Budget Analyzer application.

## Overview

This app uses **THREE different state management systems** working together:

1. **React Query** (Server State) - Transactions, API data
2. **Redux Toolkit** (Client/UI State) - Theme, selections
3. **Local Component State** (`useState`) - Temporary UI state

---

## Complete State Architecture Map

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR APPLICATION                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. REACT QUERY CACHE (Server State)                 │  │
│  │     - Transactions data ✅ (This is where they live!) │  │
│  │     - Loading states                                  │  │
│  │     - Error states                                    │  │
│  │     - Automatic refetching                            │  │
│  │     - 5-minute cache (staleTime)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↑                                   │
│                          │ useTransactions() hook            │
│                          │                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  2. REDUX STORE (UI State)                           │  │
│  │     - theme: 'light' | 'dark'                        │  │
│  │     - selectedTransactionId: number | null           │  │
│  │     - searchQuery: string                            │  │
│  │     (NO transaction data!)                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↑                                   │
│                          │ useSelector() / useDispatch()     │
│                          │                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  3. LOCAL COMPONENT STATE (Temporary)                │  │
│  │     TransactionsPage:                                │  │
│  │       - globalFilter: string                         │  │
│  │       - filteredTransactions: Transaction[]          │  │
│  │     TransactionTable:                                │  │
│  │       - sorting: SortingState                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. React Query - Server State (Where Transactions Live)

**Location:** `src/hooks/useTransactions.ts`

```typescript
export const useTransactions = () => {
  return useQuery<Transaction[], ApiError>({
    queryKey: ['transactions'],  // ← Cache key
    queryFn: async () => {
      // Fetch from API or return mock data
      return transactionApi.getTransactions();
    },
    staleTime: 1000 * 60 * 5,  // Cache for 5 minutes
    retry: 1,
  });
};
```

### How it works:

1. **First call:** Fetches data from API → stores in cache with key `['transactions']`
2. **Subsequent calls:** Returns cached data (for 5 minutes)
3. **After 5 minutes:** Marks data as "stale", refetches in background
4. **Storage:** In memory (not Redux, not localStorage)

### Usage:

```typescript
// In TransactionsPage.tsx
const { data: transactions, isLoading, error, refetch } = useTransactions();
```

The `transactions` variable contains the array from React Query's cache!

### Why React Query for Transactions?

✅ **Automatic caching** - No manual cache management
✅ **Background refetching** - Always fresh data
✅ **Deduplication** - Multiple components can call `useTransactions()`, only 1 request
✅ **Loading/error states** - Built-in
✅ **Optimistic updates** - Easy to implement
✅ **Less boilerplate** - No actions, reducers, sagas

---

## 2. Redux - UI State ONLY

**Location:** `src/store/uiSlice.ts`

### What's Stored:

```typescript
interface UiState {
  theme: 'light' | 'dark';              // ← Dark mode toggle
  selectedTransactionId: number | null; // ← Which row is selected
  searchQuery: string;                  // ← Search box text
}
```

### What's NOT Stored in Redux:

- ❌ Transactions data
- ❌ Loading states
- ❌ API errors

### Why Separate UI State from Server State?

- **UI state** = Client-only preferences (theme, selections)
- **Server state** = Data from backend (transactions, users, etc.)
- React Query is **better** for server state (caching, refetching, deduplication)

### Usage:

```typescript
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { toggleTheme } from '@/store/uiSlice';

function ThemeToggle() {
  const theme = useAppSelector(state => state.ui.theme);
  const dispatch = useAppDispatch();

  return (
    <button onClick={() => dispatch(toggleTheme())}>
      Toggle Theme
    </button>
  );
}
```

### Why Redux for UI State?

✅ **Global UI preferences** - Theme accessible everywhere
✅ **Persisted to localStorage** - Theme survives page refresh
✅ **Predictable updates** - Clear actions for state changes
✅ **DevTools** - Time-travel debugging

---

## 3. Local Component State - Temporary UI

### TransactionsPage.tsx:

```typescript
const [globalFilter, setGlobalFilter] = useState('');
const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
```

### TransactionTable.tsx:

```typescript
const [sorting, setSorting] = useState<SortingState>([]);
```

### Why Local State?

✅ **Component-specific** - Values only matter in one component
✅ **Automatic cleanup** - Reset when component unmounts
✅ **Simple** - No boilerplate

---

## Data Flow: Complete Examples

### Initial Page Load

```
1. User navigates to /transactions
   ↓
2. TransactionsPage renders
   ↓
3. useTransactions() hook called
   ↓
4. React Query checks cache for ['transactions']
   ↓
5. Cache miss → calls queryFn (API fetch)
   ↓
6. API returns data → React Query stores in cache
   ↓
7. Component re-renders with data
   ↓
8. transactions passed to TransactionTable
   ↓
9. Table renders rows
```

### User Types in Search Box

```
1. User types "CREDIT" in search input
   ↓
2. onChange fires → setGlobalFilter('CREDIT')
   ↓
3. TransactionsPage state updates
   ↓
4. globalFilter prop passed to TransactionTable
   ↓
5. TanStack Table filters rows internally
   ↓
6. useEffect detects change
   ↓
7. Calls onFilteredRowsChange(filteredRows)
   ↓
8. TransactionsPage: setFilteredTransactions(filteredRows)
   ↓
9. stats useMemo recomputes with filtered data
   ↓
10. StatCards re-render with new numbers
```

### 5 Minutes Later (React Query Refetch)

```
1. React Query detects staleTime exceeded
   ↓
2. Automatically refetches in background
   ↓
3. New data arrives
   ↓
4. Cache updated
   ↓
5. Components re-render with fresh data
```

---

## Key Principles

### Choose React Query When:
- Data comes from an API
- Need caching and automatic refetching
- Multiple components might need the same data
- Need loading/error states

### Choose Redux When:
- UI preferences that need to be global
- State needs to persist across page refreshes
- Complex UI state shared across many components

### Choose Local State When:
- State is component-specific
- Temporary UI state (modals, forms, filters)
- Doesn't need to survive component unmount

---

## Common Patterns

### Fetching and Displaying Data

```typescript
function TransactionsPage() {
  // ✅ Use React Query for server data
  const { data, isLoading, error } = useTransactions();

  // ✅ Use local state for UI
  const [filter, setFilter] = useState('');

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorBanner error={error} />;

  return <TransactionTable transactions={data} />;
}
```

### Sharing Filter State Between Components

```typescript
function ParentPage() {
  // ✅ Lift state to parent
  const [globalFilter, setGlobalFilter] = useState('');
  const [filteredData, setFilteredData] = useState([]);

  return (
    <>
      <StatsCards data={filteredData} />
      <DataTable
        globalFilter={globalFilter}
        onFilterChange={setGlobalFilter}
        onFilteredDataChange={setFilteredData}
      />
    </>
  );
}
```

### Global UI Preferences

```typescript
function App() {
  // ✅ Use Redux for global UI state
  const theme = useAppSelector(state => state.ui.theme);

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <YourApp />
    </div>
  );
}
```

---

## Anti-Patterns to Avoid

### ❌ DON'T: Store Server Data in Redux

```typescript
// ❌ BAD: Managing server data in Redux
const fetchTransactions = createAsyncThunk('transactions/fetch', async () => {
  return api.getTransactions();
});

// ❌ Creates lots of boilerplate
// ❌ Manual cache management
// ❌ No automatic refetching
```

### ✅ DO: Use React Query

```typescript
// ✅ GOOD: Let React Query handle it
const { data } = useQuery({
  queryKey: ['transactions'],
  queryFn: api.getTransactions,
});
```

### ❌ DON'T: Put Temporary UI State in Redux

```typescript
// ❌ BAD: Search filter in Redux
const searchFilter = useSelector(state => state.ui.searchFilter);

// ❌ Persists when navigating away
// ❌ Unnecessary global state
// ❌ Extra boilerplate
```

### ✅ DO: Use Local State

```typescript
// ✅ GOOD: Local state for temporary UI
const [searchFilter, setSearchFilter] = useState('');

// ✅ Automatically cleaned up
// ✅ Simple and direct
```

---

## Quick Reference

| State Type | Tool | Example | Persists? |
|------------|------|---------|-----------|
| Server data | React Query | Transactions from API | In memory (5 min) |
| Global UI | Redux | Theme preference | localStorage |
| Temporary UI | useState | Search filter | No (resets on unmount) |
| Computed values | useMemo | Filtered/sorted data | No (recalculated) |
| Side effects | useEffect | Syncing child → parent | No |

---

## Further Reading

- [React Query Documentation](https://tanstack.com/query/latest)
- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [React Hooks Documentation](https://react.dev/reference/react)
- See also: `docs/useEffect-guide.md` for detailed useEffect explanations