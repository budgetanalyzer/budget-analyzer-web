import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTransactions } from '@/hooks/useTransactions';
import { createTestQueryClient } from '@/testing/test-utils';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

describe('useTransactions', () => {
  function createWrapper() {
    const queryClient = createTestQueryClient();

    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  it('fetches transactions successfully with mock data', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBeGreaterThan(0);
  });

  it('returns transaction data with correct structure', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstTransaction = result.current.data![0];
    expect(firstTransaction).toHaveProperty('id');
    expect(firstTransaction).toHaveProperty('accountId');
    expect(firstTransaction).toHaveProperty('bankName');
    expect(firstTransaction).toHaveProperty('date');
    expect(firstTransaction).toHaveProperty('amount');
    expect(firstTransaction).toHaveProperty('type');
    expect(firstTransaction).toHaveProperty('description');
  });

  it('handles refetch correctly', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { refetch } = result.current;
    const refetchResult = await refetch();

    expect(refetchResult.isSuccess).toBe(true);
    expect(refetchResult.data).toBeDefined();
  });
});
