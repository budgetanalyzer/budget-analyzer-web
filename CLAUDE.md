# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Interaction Guidelines

**IMPORTANT: Always Ask Before Implementing**
- When the user asks a question or makes an observation (e.g., "looks good, we need to fix X", "is that appropriate?", "do you have suggestions?"), DO NOT immediately start making code changes
- First, answer the question, provide suggestions, or discuss the approach
- Wait for explicit confirmation from the user before writing/editing files
- Only implement changes when the user explicitly says "do it", "implement that", "make those changes", etc.

## Project Overview

Budget Analyzer Client is a React 19 application for managing and analyzing financial transactions. Built with TypeScript, Vite, and modern React patterns including React Query for server state and Redux Toolkit for UI state.

### API Contract

**OpenAPI Specification**: [/docs/budget-analyzer-api.yaml](docs/budget-analyzer-api.yaml)

**IMPORTANT**: Always read this file at the start of new conversations to get the current API endpoint definitions, request/response schemas, and error formats. The spec is the source of truth for the Budget Analyzer API contract.

## Development Commands

### Building and Running
- `npm run dev` - Start development server on port 3000 (auto-opens browser)
- `npm run build` - Type-check with `tsc` then build for production
- `npm run preview` - Preview production build locally

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
- Response interceptor that transforms all errors into `ApiError` class with RFC 7807-style error responses
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

**Anti-patterns to AVOID:**
- ❌ `async` functions in components
- ❌ `await` in component code
- ❌ Direct API calls in components (e.g., `await apiClient.post()`)
- ❌ `mutateAsync` with try/catch blocks in components
- ❌ Complex business logic in components

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

**Transaction Type System**: All transaction types are defined in `src/types/transaction.ts`. The API expects RFC 7807-style error responses (type defined in `src/types/apiError.ts`).

**Date Handling**: Uses `date-fns` library for all date formatting and manipulation. Import from `date-fns` not `date-fns/*` for tree-shaking.

**Routing**: React Router v7 with data router pattern. Routes defined in `src/App.tsx`. Use `useNavigate()` for programmatic navigation, `<Link>` for declarative navigation.
