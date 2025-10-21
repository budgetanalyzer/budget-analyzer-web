# ARCHITECTURE.md

# Architecture Overview

This document explains the architectural decisions and patterns used in the Budget Analyzer Client application.

## Table of Contents

1. [Application Architecture](#application-architecture)
2. [State Management Strategy](#state-management-strategy)
3. [Data Flow](#data-flow)
4. [Component Hierarchy](#component-hierarchy)
5. [Error Handling](#error-handling)
6. [Performance Optimizations](#performance-optimizations)

## Application Architecture

### Tech Stack Rationale

#### React 19
- **Concurrent Features**: Better handling of async operations
- **Server Components Ready**: Future-proof architecture
- **Improved Hydration**: Better SSR support if needed
- **Automatic Batching**: Better performance out of the box

#### TypeScript
- **Type Safety**: Catch errors at compile time
- **Better DX**: Autocomplete and IntelliSense
- **Self-Documenting**: Types serve as inline documentation
- **Refactoring Confidence**: Safe large-scale changes

#### Vite
- **Speed**: 10-100x faster than webpack in development
- **Native ESM**: Modern module system
- **Optimized Builds**: Rollup-based production builds
- **Plugin Ecosystem**: Rich ecosystem of plugins

### Directory Structure Philosophy
```
src/
├── api/          # External data sources and API clients
├── components/   # Reusable UI components
├── hooks/        # Custom React hooks (business logic)
├── lib/          # Pure utility functions
├── pages/        # Route-level components
├── store/        # Global state management
├── types/        # TypeScript type definitions
└── test/         # Test utilities and test files
```

**Rationale:**
- **Separation of Concerns**: Each directory has a single responsibility
- **Scalability**: Easy to find and add new features
- **Testability**: Clear boundaries make testing easier
- **Colocation**: Related files stay close together

## State Management Strategy

### React Query (TanStack Query) for Server State

**Use Cases:**
- Fetching transaction data from API
- Caching API responses
- Managing loading and error states
- Background refetching
- Optimistic updates

**Why React Query?**
```typescript
// Before: Manual state management
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  fetch('/api/transactions')
    .then(res => res.json())
    .then(data => setData(data))
    .catch(err => setError(err))
    .finally(() => setLoading(false));
}, []);

// After: React Query
const { data, isLoading, error } = useQuery({
  queryKey: ['transactions'],
  queryFn: fetchTransactions,
});
```

**Benefits:**
- Automatic caching with configurable stale time
- Background refetching
- Request deduplication
- Retry logic built-in
- DevTools for debugging

### Redux Toolkit for Client State

**Use Cases:**
- Theme preference (light/dark mode)
- Search/filter state
- Selected transaction ID
- UI state that needs to be shared across components

**Why Redux Toolkit?**
- **Minimal Boilerplate**: Simplified Redux with modern patterns
- **Immutability**: Built-in with Immer
- **DevTools**: Time-travel debugging
- **Type Safety**: Excellent TypeScript support

**Example:**
```typescript
// uiSlice.ts
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
  },
});
```

### State Management Decision Tree
```
Is it data from the server?
├─ YES → Use React Query
│   └─ Automatic caching, loading states, error handling
└─ NO → Is it shared across components?
    ├─ YES → Use Redux Toolkit
    │   └─ Global UI state, preferences
    └─ NO → Use local state (useState)
        └─ Component-specific state
```

## Data Flow

### Fetching Transactions Flow
```
User visits page
    ↓
TransactionsPage component mounts
    ↓
useTransactions hook called
    ↓
React Query checks cache
    ↓
Cache miss? → API call via transactionApi.ts
    ↓
Axios client with interceptors
    ↓
Response/Error interceptor processes result
    ↓
React Query updates cache
    ↓
Component re-renders with data/error
```

### Error Handling Flow
```
API Error occurs
    ↓
Axios response interceptor catches error
    ↓
Creates ApiError with structured response
    ↓
React Query receives error
    ↓
Component renders ErrorBanner
    ↓
User clicks retry
    ↓
React Query refetch() called
    ↓
Process repeats
```

## Component Hierarchy

### Page Components
High-level components that represent routes:
- Fetch data using hooks
- Handle loading and error states
- Compose smaller components
- Manage page-level state

### Feature Components
Mid-level components with specific functionality:
- TransactionTable: Complex table logic
- ErrorBanner: Error display logic
- Reusable across pages

### UI Components
Low-level, generic components:
- Button, Input, Card
- No business logic
- Highly reusable
- Styled with Tailwind CSS

### Component Communication
```
TransactionsPage (smart)
    ↓ props: transactions[]
TransactionTable (feature)
    ↓ props: transaction
TransactionRow (presentation)
    ↓ uses
Button, Badge, etc. (ui)
```

## Error Handling

### Three-Layer Error Handling

1. **Axios Interceptor** (API Layer)
```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Transform all errors to ApiError
    throw new ApiError(status, response);
  }
);
```

2. **React Query** (Data Layer)
```typescript
const { error } = useQuery({
  queryFn: fetchData,
  retry: 1, // Retry failed requests once
});
```

3. **Error Boundary** (UI Layer)
```typescript
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### Error Types

- **ApiError**: Structured API errors (404, 500, 503)
- **Network Error**: Connection failures
- **Uncaught Errors**: Caught by ErrorBoundary

## Performance Optimizations

### React Query Optimizations
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

**Benefits:**
- Reduced API calls with 5-minute cache
- No unnecessary refetches on window focus
- Controlled retry strategy

### TanStack Table Optimizations

- **Virtual Scrolling Ready**: Can handle thousands of rows
- **Client-Side Operations**: Sorting/filtering without API calls
- **Memoized Columns**: Column definitions computed once

### Component Optimizations
```typescript
// Memoized column definitions
const columns = useMemo<ColumnDef<Transaction>[]>(() => [...], []);

// Memoized calculations
const stats = useMemo(() => {
  // Calculate totals
}, [transactions]);
```

### Bundle Optimizations

- **Code Splitting**: Route-based with React.lazy (if needed)
- **Tree Shaking**: Vite removes unused code
- **CSS Purging**: Tailwind removes unused styles in production

## Testing Strategy

### Unit Tests
- **UI Components**: Button, Input, Card
- **Utility Functions**: formatCurrency, formatDate
- **Custom Hooks**: useTransactions

### Integration Tests
- **API Client**: Axios interceptors
- **Error Handling**: ApiError transformation

### E2E Tests (Future)
- User flows with Playwright/Cypress
- Full transaction list → detail flow

## Security Considerations

### API Security
- No credentials in client code
- CORS handled by backend
- API keys via environment variables only

### XSS Prevention
- React escapes by default
- No dangerouslySetInnerHTML used
- Validated user input

## Future Enhancements

### Planned Features
1. **Filtering**: Advanced transaction filters
2. **Exports**: CSV/PDF export functionality
3. **Real-time Updates**: WebSocket integration
4. **Offline Support**: Service worker for PWA
5. **Advanced Analytics**: Charts and visualizations

### Scalability Considerations
- **Code Splitting**: Implement React.lazy for routes
- **Virtual Scrolling**: For large transaction lists
- **SSR/SSG**: Consider Next.js migration if needed
- **Micro-frontends**: Module federation for large teams