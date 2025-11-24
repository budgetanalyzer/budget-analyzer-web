# Budget Analyzer Web - React Financial Management Application

## Repository Scope

**Boundary**: This repository only.

**Allowed**:
- Read `../service-common/` and `../orchestration/docs/`
- All operations within this repository

**Forbidden**:
- Writing outside this repository

Cross-service changes: coordinate through orchestration or service-common.

## Application Purpose

React 19 web application for managing and analyzing financial transactions.

**Type**: Single-page application (SPA)
**Responsibilities**:
- Transaction management UI (list, search, import, delete)
- Multi-bank CSV file upload
- Date-based filtering and search
- Light/dark theme support
- Responsive design (mobile and desktop)

## Frontend Architecture

### Technology Stack

**Discovery:**
```bash
# View React version
cat package.json | grep '"react"'

# Check build tool
cat package.json | grep '"vite"'

# See all dependencies
cat package.json | jq '.dependencies'
```

**Core Technologies:**
- React 19 with TypeScript
- Vite (build tool and dev server)
- TanStack Query (server state management)
- Redux Toolkit (UI state management)
- React Router v7 (routing)
- TanStack Table (data tables)
- Shadcn/UI + Tailwind CSS (styling)

### Project Structure

**Pattern**: Feature-based organization (Bulletproof React)

**Key directories:**
- `features/` - Feature modules (PRIMARY) - transactions, analytics (future)
- `components/ui/` - Shadcn/UI primitives
- `api/` - API client and endpoints
- `store/` - Redux (UI state only)
- `lib/` - Third-party configs (animations, date-fns)

**Discovery:**
```bash
# View structure
tree src -L 2 -I 'node_modules'

# Or without tree
find src -maxdepth 2 -type d | sort
```

**Key Principles:**
- Features don't import from other features
- Shared items stay at top level

### State Management Strategy

**Dual state approach** - Different tools for different state types:

**1. React Query (`@tanstack/react-query`)** - Server/async state:
- Transaction data, API calls
- Automatic caching (5-minute stale time)
- Loading/error states
- Query keys: `['transactions']` for list, `['transaction', id]` for single

**2. Redux Toolkit** - Client-only UI state:
- Theme (light/dark) with localStorage persistence
- Search query
- Selected items
- Single slice: `src/store/uiSlice.ts`

**Discovery:**
```bash
# Find React Query hooks
cat src/features/transactions/hooks/useTransactions.ts

# View Redux slice
cat src/store/uiSlice.ts

# Check typed hooks
cat src/store/hooks.ts
```

### API Layer

**Three-mode system** for development flexibility:

1. **Mock Data Mode** (default) - Static mocks from `src/api/mockData.ts`
2. **MSW Mode** (tests) - Mock Service Worker handlers
3. **Real API Mode** - Actual backend via axios

**Toggle:** `VITE_USE_MOCK_DATA` environment variable

**API Client (`src/api/client.ts`):**
- Axios instance with 10s timeout
- Request interceptor for auth tokens (future)
- Response interceptor normalizes all errors to `ApiError` class
- Base URL: `VITE_API_BASE_URL` (dev default: `/api`)

**Development Architecture (HTTPS):**

Browser access: `https://app.budgetanalyzer.localhost`

Request flow:
1. Browser → NGINX (port 443, SSL termination)
2. NGINX → Session Gateway (port 8081)
3. Session Gateway → NGINX API Gateway (`https://api.budgetanalyzer.localhost`)
4. NGINX API Gateway → Backend services (Transaction: 8082, Currency: 8084)

**Setup**: Run `orchestration/nginx/scripts/dev/setup-local-https.sh` to generate SSL certificates with mkcert.

**Important**: Vite dev server (port 3000) is proxied through NGINX, not accessed directly.

## Component Patterns

### Separation of Concerns

**Components = presentation + UI logic only**

**✅ Do:**
- React Query hooks with callbacks: `mutate(data, { onSuccess, onError })`
- Memoize callbacks: `useCallback` for props
- Synchronous, declarative components

**❌ Don't:**
- `async`/`await` in components
- `mutateAsync` with try/catch
- IIFEs or multi-line logic in JSX
- Inline function definitions in JSX props

### useEffect Usage

**ONLY for external systems** (DOM, timers, event listeners, browser APIs, third-party libs)

**NEVER for:** derived state, event handlers, data transforms, state initialization

**Golden rule:** Not syncing with external system? Don't use `useEffect`.

## UI Patterns

### Shadcn/UI Components

Components in `src/components/ui/` are **copy-pasted primitives** (not npm packages):
- Fully owned and customizable
- Built with Tailwind CSS
- Use `cn()` utility for conditional class merging

**Discovery:**
```bash
# Find all UI components
ls src/components/ui/

# View cn utility
cat src/utils/cn.ts
```

### TanStack Table

**Pattern**: Headless table library (v8) for data tables

**Discovery:**
```bash
# View table implementation
cat src/features/transactions/components/TransactionTable.tsx
```

Features:
- Column definitions with sorting
- Filtering
- Pagination
- Selection

### Form Validation

**Match OpenAPI spec** - Apply HTML5 validation (`maxLength`, `minLength`, `pattern`, `required`)

### Error Handling

- `ErrorBoundary.tsx` - Catches React crashes
- `ErrorBanner.tsx` - Displays API errors
- **[src/utils/errorMessages.ts](src/utils/errorMessages.ts)** - Maps 422 codes to messages (keep synced with OpenAPI)

### Centralized Configs

**CRITICAL: NEVER inline these**:
- **Animations**: Define in [src/lib/animations.ts](src/lib/animations.ts)
- **Dates**: Use only [src/utils/dates.ts](src/utils/dates.ts) (NEVER import `date-fns` directly)
  - LocalDate (YYYY-MM-DD): NO timezone
  - ISO 8601: HAS timezone

### UI/UX

- NO tooltips (don't work on mobile) - all info must be inline

## Path Aliases

Use `@/*` for imports instead of relative paths:

```typescript
import { Transaction } from '@/types/transaction';
import { apiClient } from '@/api/client';
```

Configured in:
- `tsconfig.json` - TypeScript resolution
- `vite.config.ts` - Vite bundling
- `vitest.config.ts` - Test resolution

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Commands

**Build and Run:**
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (port 3000)
npm run build        # Type-check + build for production
npm run preview      # Preview production build
```

**IMPORTANT**: NEVER run `npm run dev` automatically. User controls dev server.

**Code Quality:**
```bash
npm run lint:fix     # Auto-fix ESLint issues (ALWAYS use this)
npm run format       # Format with Prettier
```

**IMPORTANT**: Always use `npm run lint:fix` to auto-fix. Don't run `npm run lint` first - wastes time.

**Testing:**
```bash
npm test             # Run tests in watch mode
npm run test:ui      # Run tests with Vitest UI

# Single test file
npx vitest src/test/Button.test.tsx

# Test pattern
npx vitest --grep "renders correctly"
```

### Testing Setup

**Vitest** with jsdom environment:
- Setup: `src/test/setup.ts` (MSW server, jest-dom matchers)
- MSW handlers: `src/mocks/handlers.ts`
- Server: `src/mocks/server.ts`

### Environment Variables

Required (see `.env.example`):

- `VITE_API_BASE_URL` - API endpoint
  - Dev default: `/api` (routed through Session Gateway to `https://api.budgetanalyzer.localhost`)
  - Production: Full URL like `https://api.bleurubin.com`

- `VITE_USE_MOCK_DATA` - Enable mock data
  - `true` - Use static mocks
  - `false` - Make real API calls

## Code Quality

**Principles**: Production parity, explicit over clever, question complexity

**Style**: ESLint 9 (flat config) + Prettier (see config files)

**Key files**: `src/types/transaction.ts`, `src/types/apiError.ts`, `src/App.tsx` (routes)

## Discovery Commands

```bash
# View package scripts
cat package.json | jq '.scripts'

# Find all React components
find src -name "*.tsx" | grep -v test

# Find API endpoints
cat src/api/endpoints.ts

# View API client config
cat src/api/client.ts

# Check React Query hooks
find src -name "use*.ts" | grep -v test

# View Redux store
cat src/store/uiSlice.ts
```

## Notes for Claude Code

**CRITICAL - Prerequisites First**: Before implementing any plan or feature:
1. Check for prerequisites in documentation (e.g., "Prerequisites: service-common Enhancement")
2. If prerequisites are NOT satisfied, STOP immediately and inform the user
3. Do NOT attempt to hack around missing prerequisites - this leads to broken implementations that must be deleted
4. Complete prerequisites first, then return to the original task

**Critical patterns**:
- NO async/await in components - use React Query hooks with callbacks
- Always `useCallback` for function props
- useEffect ONLY for external systems (DOM, timers, subscriptions)
- NO IIFEs in JSX - extract to components/utilities

**Centralized configs** (NEVER inline):
- Animations: `src/lib/animations.ts`
- Dates: `src/utils/dates.ts`
- Error messages: `src/utils/errorMessages.ts` (sync with OpenAPI spec)

**Other**:
- NEVER disable ESLint rules without permission
- User controls dev server (`npm run dev`) manually
- Always use `npm run lint:fix` (auto-fixes)
