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
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('fetches transactions successfully with mock data', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBeGreaterThan(0);
  });

  it('returns transaction data with correct structure', async () => {
    const { result } = renderHook(() => useTransactions(), { wrapper });

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
    const { result } = renderHook(() => useTransactions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { refetch } = result.current;
    const refetchResult = await refetch();

    expect(refetchResult.isSuccess).toBe(true);
    expect(refetchResult.data).toBeDefined();
  });
});