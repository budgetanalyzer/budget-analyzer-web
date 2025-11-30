# Testing Guide

A comprehensive guide to the testing setup and best practices for the Budget Analyzer application.

---

## Testing Stack

- **Test Runner:** Vitest (fast, Vite-native)
- **Testing Library:** React Testing Library (`@testing-library/react`)
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
npx vitest src/test/Button.test.tsx

# Run tests matching a pattern
npx vitest --grep "renders correctly"

# Run with coverage
npm test -- --coverage
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
    setupFiles: './src/test/setup.ts',
    // ... path aliases, css handling
  },
});
```

#### 2. src/test/setup.ts

This file runs before all tests:

```typescript
import { expect, beforeAll, afterEach, afterAll } from 'vitest';
import '@testing-library/jest-dom';
import * as matchers from '@testing-library/jest-dom/matchers';
import { server } from '../mocks/server';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// MSW server lifecycle
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

**What this does:**
- Adds jest-dom matchers like `.toBeInTheDocument()`
- Starts MSW server before any tests run
- Resets MSW handlers between tests (prevents test pollution)
- Closes MSW server after all tests complete

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

#### src/mocks/handlers.ts

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

#### src/mocks/server.ts

Set up MSW for Node.js (tests):

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Why MSW Fixed Your Tests

**Before MSW:**
- Tests made real API calls → failed with network errors
- No backend running in test environment
- Unreliable, slow tests

**After MSW:**
- API calls intercepted and mocked
- Fast, reliable responses
- No network dependency
- Tests pass! ✅

---

## Test Examples

### Example 1: Simple Component Test

```typescript
// src/test/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = vi.fn(); // Mock function
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Button disabled>Click me</Button>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

### Example 2: Testing Hooks with React Query

```typescript
// src/test/useTransactions.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTransactions } from '@/hooks/useTransactions';
import { ReactNode } from 'react';

describe('useTransactions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries in tests
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('fetches transactions successfully', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper });

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
import { fireEvent, userEvent } from '@testing-library/react';

// fireEvent (lower level)
fireEvent.click(button);
fireEvent.change(input, { target: { value: 'test' } });

// userEvent (recommended - simulates real user behavior)
await userEvent.click(button);
await userEvent.type(input, 'test');
await userEvent.clear(input);
```

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
import { server } from '@/mocks/server';
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
│   └── Button.tsx
├── test/
│   ├── setup.ts              # Global test setup
│   ├── Button.test.tsx       # Component tests
│   └── useTransactions.test.tsx  # Hook tests
└── mocks/
    ├── handlers.ts           # MSW handlers
    └── server.ts             # MSW server setup
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

## Suggested Improvements

Based on our earlier discussion, here are recommended additions to your test suite:

### 1. Add Handler for Single Transaction

```typescript
// Add to src/mocks/handlers.ts
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

### 2. Add Test Utilities

```typescript
// src/test/testUtils.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { ReactNode } from 'react';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: Infinity,
      },
    },
  });
}

export function AllTheProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </Provider>
  );
}
```

### 3. Add Error Scenario Tests

```typescript
// src/test/useTransactions.test.tsx
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

### 4. Add Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
      ],
    },
  },
});
```

---

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