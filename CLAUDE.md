# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Budget Analyzer Client is a React 19 application for managing and analyzing financial transactions. Built with TypeScript, Vite, and modern React patterns including React Query for server state and Redux Toolkit for UI state.

## Development Commands

### Building and Running
- `npm run dev` - Start development server on port 3000 (auto-opens browser)
- `npm run build` - Type-check with `tsc` then build for production
- `npm run preview` - Preview production build locally

### Code Quality
- `npm run lint` - Run ESLint (uses flat config with TypeScript, React, and Prettier)
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format code with Prettier

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

**Shadcn/UI Pattern**: Components in `src/components/ui/` are copy-pasted primitives (not npm packages). They are fully owned and customizable. Built with Tailwind CSS using the `cn()` utility from `src/lib/utils.ts` for conditional class merging.

**Table Implementation**: Uses TanStack Table (v8) in headless mode. See `src/components/TransactionTable.tsx` for column definitions, sorting, filtering, and pagination.

**Error Handling**:
- `ErrorBoundary.tsx` - React error boundary for component crashes
- `ErrorBanner.tsx` - Displays API errors with retry functionality
- All API errors are normalized through the `ApiError` class

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

## Important Implementation Notes

**Theme Persistence**: Theme state lives in Redux but is synced to localStorage and DOM class (`dark`) via the `uiSlice` reducers. On initial load, theme is read from localStorage (see `src/store/uiSlice.ts:11`).

**Transaction Type System**: All transaction types are defined in `src/types/transaction.ts`. The API expects RFC 7807-style error responses (type defined in `src/types/apiError.ts`).

**Date Handling**: Uses `date-fns` library for all date formatting and manipulation. Import from `date-fns` not `date-fns/*` for tree-shaking.

**Routing**: React Router v7 with data router pattern. Routes defined in `src/App.tsx`. Use `useNavigate()` for programmatic navigation, `<Link>` for declarative navigation.
