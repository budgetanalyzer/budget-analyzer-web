# CONTRIBUTING.md

# Contributing to Budget Analyzer Client

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Create a branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Run tests: `npm test`
6. Run linter: `npm run lint`
7. Format code: `npm run format`
8. Commit your changes
9. Push and create a pull request

## Code Style

### TypeScript

- Use TypeScript for all new files
- Avoid `any` types - use proper type definitions
- Prefer interfaces over types for object shapes
- Use enums for fixed sets of values

### React

- Use functional components with hooks
- Keep components small and focused
- Extract complex logic into custom hooks
- Prefer named exports over default exports

### Naming Conventions

- **Components**: PascalCase (e.g., `TransactionTable.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useTransactions.ts`)
- **Utilities**: camelCase (e.g., `formatCurrency`)
- **Types**: PascalCase (e.g., `Transaction`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)

### File Organization
```typescript
// 1. External imports
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal imports
import { Transaction } from '@/types/transaction';
import { Button } from '@/components/ui/Button';

// 3. Type definitions
interface Props {
  id: number;
}

// 4. Component
export function MyComponent({ id }: Props) {
  // Component logic
}
```

## Testing Guidelines

### What to Test

- **Components**: Rendering, user interactions, edge cases
- **Hooks**: Data fetching, state updates, error handling
- **Utilities**: Pure functions with various inputs

### Writing Tests
```typescript
describe('ComponentName', () => {
  it('should do something specific', () => {
    // Arrange
    const props = { ... };
    
    // Act
    render(<ComponentName {...props} />);
    
    // Assert
    expect(screen.getByText('...')).toBeInTheDocument();
  });
});
```

## Adding New Features

### 1. New API Endpoint
```typescript
// src/api/transactionApi.ts
export const transactionApi = {
  createTransaction: async (data: CreateTransactionDto): Promise<Transaction> => {
    const response = await apiClient.post<Transaction>('/transactions', data);
    return response.data;
  },
};
```

### 2. New Hook
```typescript
// src/hooks/useCreateTransaction.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: transactionApi.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
```

### 3. New Component
```typescript
// src/components/TransactionForm.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function TransactionForm() {
  // Component logic
}
```

### 4. Update Types
```typescript
// src/types/transaction.ts
export interface CreateTransactionDto {
  accountId: string;
  amount: number;
  // ...other fields
}
```

## Pull Request Process

1. **Title**: Use conventional commits format
   - `feat: Add transaction creation form`
   - `fix: Resolve table sorting issue`
   - `docs: Update README with deployment steps`

2. **Description**: Include
   - What changed
   - Why it changed
   - How to test it
   - Screenshots (if UI changes)

3. **Checks**: Ensure all pass
   - ✅ Tests pass
   - ✅ Linter passes
   - ✅ Build succeeds
   - ✅ No TypeScript errors

## Common Tasks

### Adding a New UI Component

1. Create component file in `src/components/ui/`
2. Follow existing patterns (forwardRef, className prop)
3. Add to exports if commonly used
4. Write tests

### Adding a New Page

1. Create page component in `src/pages/`
2. Add route in `src/App.tsx`
3. Add navigation link if needed
4. Test routing works

### Updating API Types

1. Update OpenAPI spec (backend)
2. Regenerate types or manually update `src/types/`
3. Update API client methods
4. Update components using the types

## Questions?

- Open an issue for bugs
- Start a discussion for feature requests
- Check existing issues before creating new ones