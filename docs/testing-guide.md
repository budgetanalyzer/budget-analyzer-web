# Testing Guide

A comprehensive guide to the testing setup and best practices for the Budget Analyzer application.

---

## Testing Stack

- **Test Runner:** Vitest (fast, Vite-native)
- **Testing Library:** React Testing Library (`@testing-library/react`) and
  `@testing-library/user-event`
- **Assertions:** Vitest matchers + jest-dom matchers
- **API Mocking:** MSW (Mock Service Worker)
- **Environment:** jsdom (simulates browser environment in Node)

---

## Running Tests

### Basic Commands

```bash
# Run tests in watch mode (development)
npm test

# Run tests once (CI/production)
npm test -- --run

# Run with UI interface
npm run test:ui

# Run a single test file
npx vitest src/utils/__tests__/parseSearchTerms.test.ts

# Run tests matching a pattern
npx vitest --grep "renders correctly"
```

---

## Test Setup Architecture

### Configuration Files

#### 1. vitest.config.ts

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/testing/setup.ts',
    // ... path aliases, css handling
  },
});
```

#### 2. src/testing/setup.ts

This file runs before all tests:

```typescript
import { expect, beforeAll, afterEach, afterAll } from 'vitest';
import '@testing-library/jest-dom';
import * as matchers from '@testing-library/jest-dom/matchers';
import { resetMockHandlerState } from '@/testing/mocks/handlers';
import { server } from '@/testing/mocks/server';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// MSW server lifecycle
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  resetMockHandlerState();
});
afterAll(() => server.close());
```

**What this does:**
- Adds jest-dom matchers like `.toBeInTheDocument()`
- Starts MSW server before any tests run
- Resets MSW handlers between tests (prevents test pollution)
- Closes MSW server after all tests complete

---

## Test Placement

Production-code tests live beside the code they verify in `__tests__`
directories. Shared test infrastructure lives under `src/testing/`.

Use this split consistently:

- `src/utils/parseSearchTerms.ts` -> `src/utils/__tests__/parseSearchTerms.test.ts`
- `src/hooks/useTransactions.ts` -> `src/hooks/__tests__/useTransactions.test.tsx`
- `src/testing/setup.ts` for global Vitest setup
- `src/testing/mocks/` for MSW handlers and server setup
- `src/testing/test-utils.tsx` for shared provider helpers

Do not add production-code tests under `src/testing/`. The old `src/test/`
directory is no longer used.

---

## MSW (Mock Service Worker)

MSW intercepts HTTP requests and returns mock responses **without actually hitting the network**.

### How MSW Works

```
Your Test
    ↓
Component makes API call (fetch/axios)
    ↓
MSW intercepts the request
    ↓
MSW returns mock response
    ↓
Component receives mock data
    ↓
Test assertions
```

### MSW Setup Files

#### src/testing/mocks/handlers.ts

Define mock API endpoints:

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/transactions', () => {
    return HttpResponse.json([
      {
        id: '1',
        accountId: 'acc1',
        bankName: 'Test Bank',
        date: '2024-01-01',
        amount: 100.5,
        type: 'debit',
        description: 'Test transaction',
      },
    ]);
  }),
];
```

#### src/testing/mocks/server.ts

Set up MSW for Node.js (tests):

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Why Use MSW

**Without MSW:**
- Tests can make real API calls and fail with network errors
- No backend running in test environment
- Unreliable, slow tests

**With MSW:**
- API calls intercepted and mocked
- Fast, reliable responses
- No network dependency

---

## Test Examples

### Example 1: Colocated Component Behavior Test

```typescript
// src/components/__tests__/BackButton.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { BackButton } from '@/components/BackButton';

function DetailPage() {
  return <BackButton />;
}

function ListPage() {
  return <Link to="/transactions/1">Open detail</Link>;
}

describe('BackButton', () => {
  it('uses browser history after in-app navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ListPage />} />
          <Route path="/transactions/:id" element={<DetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('link', { name: /Open detail/ }));
    await userEvent.click(screen.getByRole('button', { name: /Back/ }));

    expect(screen.getByRole('link', { name: /Open detail/ })).toBeInTheDocument();
  });
});
```

### Example 2: Testing Hooks with React Query

```typescript
// src/hooks/__tests__/useTransactions.test.tsx
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTransactions } from '@/hooks/useTransactions';
import { createTestQueryClient } from '@/testing/test-utils';
import type { ReactNode } from 'react';

describe('useTransactions', () => {
  function createWrapper() {
    const queryClient = createTestQueryClient();

    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  it('fetches transactions successfully', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

    // Initial state: loading
    expect(result.current.isLoading).toBe(true);

    // Wait for success
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Check data
    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
  });
});
```

**Key points:**
- `renderHook()` - For testing custom hooks
- `wrapper` - Provides React Query context
- `waitFor()` - Waits for async operations
- MSW returns mock data automatically

---

## Common Testing Patterns

### Pattern 1: Querying Elements

```typescript
import { render, screen } from '@testing-library/react';

render(<MyComponent />);

// By role (preferred - most accessible)
screen.getByRole('button', { name: /submit/i });
screen.getByRole('textbox', { name: /email/i });

// By label text
screen.getByLabelText('Email address');

// By placeholder
screen.getByPlaceholderText('Enter email...');

// By text content
screen.getByText('Hello World');

// By test ID (last resort)
screen.getByTestId('submit-button');
```

**Query variants:**
- `getBy*` - Throws error if not found (use for assertions)
- `queryBy*` - Returns null if not found (use for checking absence)
- `findBy*` - Async, waits for element (use for async rendering)

### Pattern 2: User Interactions

```typescript
import userEvent from '@testing-library/user-event';

await userEvent.click(button);
await userEvent.type(input, 'test');
await userEvent.clear(input);
```

Prefer `userEvent` for workflows users actually perform: clicking, typing,
selecting options, clearing fields, and keyboard navigation. Keep `fireEvent`
for lower-level events where `userEvent` is a poor fit, such as synthetic
window activity, timer-adjacent hooks, focused DOM events like backdrop clicks,
or rare library-specific keyboard workarounds.

### Pattern 3: Async Testing

```typescript
import { waitFor, waitForElementToBeRemoved } from '@testing-library/react';

// Wait for condition
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});

// Wait for element to appear
const element = await screen.findByText('Loaded');

// Wait for element to disappear
await waitForElementToBeRemoved(() => screen.queryByText('Loading...'));
```

### Pattern 4: Testing Error States

```typescript
it('displays error message on API failure', async () => {
  // Override MSW handler for this test only
  server.use(
    http.get('/api/transactions', () => {
      return HttpResponse.json(
        { error: 'Server error' },
        { status: 500 }
      );
    })
  );

  render(<TransactionsPage />);

  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

---

## Testing Best Practices

### ✅ DO: Test User Behavior

```typescript
// ✅ GOOD: Test what users see and do
import userEvent from '@testing-library/user-event';

it('allows user to filter transactions', async () => {
  render(<TransactionsPage />);

  const searchBox = screen.getByPlaceholderText('Search transactions...');
  await userEvent.type(searchBox, 'CREDIT');

  expect(screen.getByText('Total: 5 transactions')).toBeInTheDocument();
});
```

### ❌ DON'T: Test Implementation Details

```typescript
// ❌ BAD: Testing internal state
it('updates state when typing', () => {
  const { rerender } = render(<SearchBox />);
  expect(component.state.query).toBe(''); // Testing internal state
});
```

### ✅ DO: Use Semantic Queries

```typescript
// ✅ GOOD: Query by role/label (accessible)
screen.getByRole('button', { name: 'Submit' });
screen.getByLabelText('Email');
```

### ❌ DON'T: Rely on Test IDs

```typescript
// ❌ BAD: Test IDs as first choice
screen.getByTestId('submit-btn'); // Only use as last resort
```

### ✅ DO: Test Loading and Error States

```typescript
it('shows loading spinner', () => {
  render(<TransactionsPage />);
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

it('shows error message on failure', async () => {
  server.use(/* error handler */);
  render(<TransactionsPage />);
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

### ✅ DO: Clean Up Between Tests

```typescript
afterEach(() => {
  // MSW resets automatically via setup.ts
  // React Testing Library cleans up automatically

  // Manual cleanup if needed:
  vi.clearAllMocks();
  localStorage.clear();
});
```

---

## Mocking Strategies

### Mock Functions

```typescript
import { vi } from 'vitest';

// Create mock function
const mockFn = vi.fn();

// Mock with return value
const mockFn = vi.fn().mockReturnValue(42);

// Mock with implementation
const mockFn = vi.fn((x) => x * 2);

// Assertions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg');
expect(mockFn).toHaveBeenCalledTimes(2);
```

### Mock Modules

```typescript
// Mock entire module
vi.mock('@/api/transactionApi', () => ({
  transactionApi: {
    getTransactions: vi.fn().mockResolvedValue([]),
  },
}));

// Use in test
import { transactionApi } from '@/api/transactionApi';
expect(transactionApi.getTransactions).toHaveBeenCalled();
```

### Mock API with MSW (Preferred)

```typescript
// Override handler for specific test
import { server } from '@/testing/mocks/server';
import { http, HttpResponse } from 'msw';

it('handles 404 error', async () => {
  server.use(
    http.get('/api/transactions/:id', () => {
      return HttpResponse.json(
        { error: 'Not found' },
        { status: 404 }
      );
    })
  );

  // Test that uses this endpoint
});
```

---

## Test Organization

### File Structure

```
src/
├── components/
│   ├── BackButton.tsx
│   └── __tests__/
│       └── BackButton.test.tsx
├── testing/
│   ├── setup.ts              # Global test setup
│   ├── test-utils.tsx        # Shared provider render helpers
│   └── mocks/
│       ├── handlers.ts       # MSW handlers
│       └── server.ts         # MSW server setup
└── utils/
    ├── parseSearchTerms.ts
    └── __tests__/
        └── parseSearchTerms.test.ts
```

### Test Naming

```typescript
describe('ComponentName', () => {
  describe('feature/behavior', () => {
    it('should do something specific', () => {
      // Test
    });
  });
});
```

**Examples:**
```typescript
describe('TransactionTable', () => {
  describe('filtering', () => {
    it('filters rows when search query changes', () => {});
    it('shows empty state when no matches found', () => {});
  });

  describe('sorting', () => {
    it('sorts by amount when column header clicked', () => {});
  });
});
```

---

## Shared Test Utilities

Use `src/testing/test-utils.tsx` when a test needs React Query, Redux, or an
optional memory router. Prefer a local helper only when a page needs custom
route declarations or unusually specific provider wiring.

```typescript
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/testing/test-utils';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';

it('renders the transactions page', () => {
  const { queryClient, store } = renderWithProviders(<TransactionsPage />, {
    initialEntries: ['/transactions'],
  });

  expect(screen.getByText(/transactions/i)).toBeInTheDocument();
  queryClient.clear();
  expect(store.getState().ui.displayCurrency).toBe('USD');
});
```

`createTestQueryClient()` creates a Query Client with retries disabled.
`createTestStore()` creates a fresh Redux store for each test.
`renderWithProviders()` returns the normal Testing Library render result plus
the `queryClient` and `store` it used.
Pass `router: 'dom'` only for components that still import router hooks from
`react-router-dom`; the default router matches the app's `react-router` usage.

---

## Suggested Improvements

### 1. Add Handler for Single Transaction

```typescript
// Add to src/testing/mocks/handlers.ts
http.get('/api/transactions/:id', ({ params }) => {
  const { id } = params;
  return HttpResponse.json({
    id,
    accountId: 'acc1',
    bankName: 'Test Bank',
    date: '2024-01-01',
    amount: 100.5,
    type: 'debit',
    description: `Transaction ${id}`,
  });
}),
```

### 2. Add Error Scenario Tests

```typescript
// src/hooks/__tests__/useTransactions.test.tsx
it('handles API errors gracefully', async () => {
  server.use(
    http.get('/api/transactions', () => {
      return HttpResponse.json(
        { error: 'Server error' },
        { status: 500 }
      );
    })
  );

  const { result } = renderHook(() => useTransactions(), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBeDefined();
});
```

## Debugging Tests

### View Test Output

```bash
# Verbose output
npm test -- --reporter=verbose

# UI mode (interactive)
npm run test:ui
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Vitest Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test", "--", "--run"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Common Issues

**Issue: Tests fail with "window is not defined"**
- Solution: Check that `environment: 'jsdom'` is set in vitest.config.ts

**Issue: MSW not intercepting requests**
- Solution: Verify `server.listen()` is called in setup.ts
- Check handler paths match your API calls

**Issue: React Query tests timeout**
- Solution: Disable retries in test QueryClient

**Issue: Stale state between tests**
- Solution: Use `beforeEach()` to reset state/mocks

---

## Quick Reference

### Essential Testing Library Queries

| Method | Use Case | Example |
|--------|----------|---------|
| `getByRole` | Semantic elements | `getByRole('button')` |
| `getByLabelText` | Form inputs | `getByLabelText('Email')` |
| `getByText` | Text content | `getByText('Hello')` |
| `findBy*` | Async elements | `await findByText('Loaded')` |
| `queryBy*` | Check absence | `queryByText('Gone')` |

### Essential Assertions

```typescript
// jest-dom matchers (from setup.ts)
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toHaveTextContent('text');
expect(element).toBeDisabled();
expect(element).toHaveClass('active');

// Vitest matchers
expect(mockFn).toHaveBeenCalled();
expect(value).toBe(42);
expect(array).toEqual([1, 2, 3]);
expect(value).toBeTruthy();
```

---

## Further Reading

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW Documentation](https://mswjs.io/)
- [Testing React Query](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
- See also: `docs/state-architecture.md` for understanding what to test
