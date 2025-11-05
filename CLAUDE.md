# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Interaction Guidelines

**IMPORTANT: Always Ask Before Implementing**

- When the user asks a question or makes an observation (e.g., "looks good, we need to fix X", "is that appropriate?", "do you have suggestions?"), DO NOT immediately start making code changes
- First, answer the question, provide suggestions, or discuss the approach
- Wait for explicit confirmation from the user before writing/editing files
- Only implement changes when the user explicitly says "do it", "implement that", "make those changes", etc.

## Project Overview

Budget Analyzer Web is a React 19 application for managing and analyzing financial transactions. Built with TypeScript, Vite, and modern React patterns including React Query for server state and Redux Toolkit for UI state.

### API Contract

**OpenAPI Specification**: [/docs/budget-analyzer-api.yaml](docs/budget-analyzer-api.yaml)

**IMPORTANT**: Always read this file at the start of new conversations to get the current API endpoint definitions, request/response schemas, and error formats. The spec is the source of truth for the Budget Analyzer API contract.

## Development Commands

### Building and Running

- `npm run dev` - Start development server on port 3000 (auto-opens browser)
- `npm run build` - Type-check with `tsc` then build for production
- `npm run preview` - Preview production build locally

**IMPORTANT**: NEVER run `npm run dev` automatically. The user will manually start and stop the dev server themselves.

### Code Quality

- `npm run lint:fix` - Auto-fix ESLint issues (ALWAYS use this instead of `npm run lint`)
- `npm run format` - Format code with Prettier

**IMPORTANT**: Always use `npm run lint:fix` to automatically fix formatting issues. Never run `npm run lint` first - it wastes time showing errors that can be auto-fixed.

### Testing

- `npm test` - Run tests in watch mode with Vitest
- `npm run test:ui` - Run tests with Vitest UI interface

**Running a single test file:**

```bash
npx vitest src/test/Button.test.tsx
```

**Running tests matching a pattern:**

```bash
npx vitest --grep "renders correctly"
```

## Architecture

### State Management Strategy

This app uses a **dual state management** approach:

- **React Query (`@tanstack/react-query`)** - All server/async state (transactions data, API calls, caching, loading states)
  - Query keys: `['transactions']` for list, `['transaction', id]` for single item
  - 5-minute stale time, 1 retry on failure
  - Configured in `src/hooks/useTransactions.ts`

- **Redux Toolkit** - Client-only UI state (theme, search query, selected items)
  - Single slice: `src/store/uiSlice.ts`
  - Persists theme to localStorage
  - Use typed hooks from `src/store/hooks.ts`

### API Layer Architecture

**Three-mode API system** for flexibility during development:

1. **Mock Data Mode** (default) - Uses static mock data from `src/api/mockData.ts`
2. **MSW Mode** (tests) - Uses Mock Service Worker handlers in `src/mocks/`
3. **Real API Mode** - Connects to actual backend

Toggle via environment variable `VITE_USE_MOCK_DATA`:

- `true` - Uses mock data with simulated delays
- `false` or unset - Makes real API calls via axios client

**API Client (`src/api/client.ts`):**

- Axios instance with 10s timeout
- Request interceptor for future auth token injection
- Response interceptor that transforms all errors into `ApiError` class with standardized error responses
- Base URL configured via `VITE_API_BASE_URL` env var

**Development Proxy:**
Vite dev server proxies `/api` → `http://localhost:8080/budget-analyzer-api` (see `vite.config.ts:14-23`)

### Path Aliases

Use `@/*` for imports instead of relative paths:

```typescript
import { Transaction } from '@/types/transaction';
import { apiClient } from '@/api/client';
```

Configured in:

- `tsconfig.json` - TypeScript resolution
- `vite.config.ts` - Vite bundling
- `vitest.config.ts` - Test resolution

### Component Architecture

**CRITICAL - Separation of Concerns**: Components are ONLY for presentation and UI logic. Never put async/await, API calls, or business logic directly in components.

**Correct patterns:**

- ✅ Use React Query hooks (`useQuery`, `useMutation`) in custom hooks (e.g., `src/hooks/useTransactions.ts`)
- ✅ Call mutations using the `mutate` function with callbacks: `mutate(data, { onSuccess, onError })`
- ✅ Keep components synchronous and declarative
- ✅ Use `isPending`, `isLoading`, `isError` states from hooks for UI feedback
- ✅ Memoize callback functions passed to child components using `useCallback`

**Anti-patterns to AVOID:**

- ❌ `async` functions in components
- ❌ `await` in component code
- ❌ Direct API calls in components (e.g., `await apiClient.post()`)
- ❌ `mutateAsync` with try/catch blocks in components
- ❌ Complex business logic in components
- ❌ Inline function definitions in JSX props (use `useCallback` instead)

**Example of correct pattern:**

```typescript
// ✅ CORRECT - Component uses mutation with callbacks
const { mutate: deleteItem, isPending } = useDeleteItem();

const handleDelete = () => {
  deleteItem(id, {
    onSuccess: () => toast.success('Deleted'),
    onError: (error) => toast.error(error.message),
  });
};
```

**Example of anti-pattern:**

```typescript
// ❌ WRONG - async/await in component
const handleDelete = async () => {
  try {
    await deleteItem.mutateAsync(id);
    toast.success('Deleted');
  } catch (error) {
    toast.error(error.message);
  }
};
```

**Performance - Memoizing Callbacks:**

Always use `useCallback` for functions passed as props to child components to prevent unnecessary re-renders:

```typescript
// ✅ CORRECT - Memoized callback
const handleDateFilterChange = useCallback(
  (from: string | null, to: string | null) => {
    const params = new URLSearchParams();
    if (from && to) {
      params.set('dateFrom', from);
      params.set('dateTo', to);
    }
    setSearchParams(params);
  },
  [setSearchParams],
);

<ChildComponent onChange={handleDateFilterChange} />
```

```typescript
// ❌ WRONG - Inline function (creates new instance every render)
<ChildComponent
  onChange={(from, to) => {
    const params = new URLSearchParams();
    if (from && to) {
      params.set('dateFrom', from);
      params.set('dateTo', to);
    }
    setSearchParams(params);
  }}
/>
```

**Shadcn/UI Pattern**: Components in `src/components/ui/` are copy-pasted primitives (not npm packages). They are fully owned and customizable. Built with Tailwind CSS using the `cn()` utility from `src/lib/utils.ts` for conditional class merging.

**Table Implementation**: Uses TanStack Table (v8) in headless mode. See `src/components/TransactionTable.tsx` for column definitions, sorting, filtering, and pagination.

**Error Handling**:

- `ErrorBoundary.tsx` - React error boundary for component crashes
- `ErrorBanner.tsx` - Displays API errors with retry functionality
- All API errors are normalized through the `ApiError` class

**Animation Configuration**:

- **CRITICAL**: All Framer Motion animation props (variants, transitions, durations, easing) MUST be defined in [src/lib/animations.ts](src/lib/animations.ts)
- **NEVER** inline animation values in components (e.g., `duration: 0.3`, `ease: "easeInOut"`, or inline variant objects)
- Components should only import and use the exported constants from `animations.ts`
- This ensures consistency across the app and makes animation timing/easing changes easy to manage centrally

**Correct pattern:**

```typescript
// ✅ CORRECT - Import animation config
import { fadeVariants, fadeTransition } from '@/lib/animations';

<motion.div variants={fadeVariants} transition={fadeTransition}>
  {content}
</motion.div>
```

**Anti-pattern:**

```typescript
// ❌ WRONG - Inline animation values
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3, ease: 'easeInOut' }}
>
  {content}
</motion.div>
```

**Date Handling**:

- **CRITICAL**: [src/lib/dateUtils.ts](src/lib/dateUtils.ts) is the ONLY place in the codebase where date operations are allowed
- **NEVER** import from `date-fns` outside of `dateUtils.ts`
- **NEVER** use `new Date()` constructor outside of `dateUtils.ts`
- **NEVER** perform date parsing, formatting, or manipulation outside of `dateUtils.ts`
- All date operations must go through the centralized utilities to avoid timezone bugs

**Date Format Types**:
- **LocalDate (YYYY-MM-DD)**: Transaction dates, date filters - NO timezone info (e.g., `"2025-07-01"`)
- **ISO 8601 (with timezone)**: Timestamps like createdAt, updatedAt - HAS timezone info (e.g., `"2025-07-01T12:34:56Z"`)

**Correct pattern:**

```typescript
// ✅ CORRECT - Import from dateUtils
import { formatLocalDate, parseLocalDate, formatTimestamp } from '@/lib/dateUtils';

// Format a LocalDate (YYYY-MM-DD) for display
const displayDate = formatLocalDate(transaction.date);

// Format an ISO timestamp for display
const displayTimestamp = formatTimestamp(transaction.createdAt);

// Parse a LocalDate for comparisons
const dateObj = parseLocalDate(transaction.date);
```

**Anti-patterns:**

```typescript
// ❌ WRONG - Importing date-fns directly
import { format, parseISO } from 'date-fns';

// ❌ WRONG - Using Date constructor with string
const date = new Date('2025-07-01'); // Creates UTC date, causes off-by-one day bugs!

// ❌ WRONG - Date manipulation in component
const formatted = transaction.date.split('-').join('/');
```

### UI/UX Principles

**No Tooltips**:

- **NEVER** use tooltips or hover states to display information
- Tooltips don't work on mobile/touch devices
- All information must be visible inline by default

### Testing Setup

**Vitest configuration** (`vitest.config.ts`):

- jsdom environment for React component testing
- Setup file: `src/test/setup.ts` (configures MSW server and jest-dom matchers)
- Path aliases resolved
- CSS processing enabled

**MSW (Mock Service Worker):**

- Handlers: `src/mocks/handlers.ts`
- Server setup: `src/mocks/server.ts`
- Started in `beforeAll`, reset in `afterEach`, closed in `afterAll`

## Code Style

- **ESLint**: Flat config (ESLint 9) in `eslint.config.js`
  - TypeScript strict mode enabled
  - React 19 (no need for `React` imports in JSX)
  - Unused vars error (except `_` prefix for intentionally unused params)
  - Prettier integration (rules conflicts resolved)

- **Prettier**: See `.prettierrc` for formatting rules
  - 100 char line width
  - Single quotes for JS/TS, double quotes for JSX
  - Semicolons, trailing commas

## Environment Variables

Required variables (see `.env.example`):

- `VITE_API_BASE_URL` - API endpoint
  - Dev default: `/api` (proxied to localhost:8080)
  - Production: Full URL like `https://api.bleurubin.com`

- `VITE_USE_MOCK_DATA` - Enable mock data mode
  - `true` - Use static mocks
  - `false` - Make real API calls

## Code Quality Standards

### Architecture Principles

- **Production Parity**: All development configurations should work identically in production. Avoid dev-only hacks or workarounds.
- **Explicit over Clever**: Prefer verbose, clear code over "clever" solutions that are hard to understand or maintain.
- **Question Complexity**: If a solution requires unusual workarounds (DNS resolvers, custom builds, non-standard patterns), challenge whether it's the right approach.
- **No Magic**: Avoid configurations that require "magic" environment-specific settings (special DNS servers, undocumented assumptions, etc.).

### When Suggesting Solutions

**IMPORTANT**: When proposing technical solutions, especially for infrastructure/configuration:

1. **Explain tradeoffs** - Don't just provide a solution, explain pros/cons
2. **Flag code smells** - If something feels hacky, say so upfront
3. **Offer alternatives** - Present multiple approaches (simple vs. complex)
4. **Production implications** - Explicitly state if something won't work the same in production
5. **Ask for feedback** - When there are multiple valid approaches, ask which the user prefers

### Red Flags to Avoid

- ❌ Solutions that require DNS resolvers for internal routing
- ❌ Configurations that only work in Docker/dev but not production
- ❌ "Magic" environment variables or undocumented dependencies
- ❌ Workarounds that add fragility (race conditions, timing dependencies)
- ❌ Performance penalties hidden by "it works" (unnecessary DNS lookups, extra network hops)

### When in Doubt

If a solution requires more than 2 lines of explanation for "why this works", it's probably too complex. Step back and find a simpler approach.

## Important Implementation Notes

**Theme Persistence**: Theme state lives in Redux but is synced to localStorage and DOM class (`dark`) via the `uiSlice` reducers. On initial load, theme is read from localStorage (see `src/store/uiSlice.ts:11`).

**Transaction Type System**: All transaction types are defined in `src/types/transaction.ts`. The API returns standardized error responses with type, message, code, and fieldErrors fields (type defined in `src/types/apiError.ts`).

**Date Handling**: All date operations are centralized in [src/lib/dateUtils.ts](src/lib/dateUtils.ts). This module is the ONLY place that imports `date-fns` or uses the `Date` constructor. Use functions like `formatLocalDate()`, `parseLocalDate()`, `formatTimestamp()`, etc. Never import `date-fns` directly or manipulate dates outside of `dateUtils.ts`.

**Routing**: React Router v7 with data router pattern. Routes defined in `src/App.tsx`. Use `useNavigate()` for programmatic navigation, `<Link>` for declarative navigation.
