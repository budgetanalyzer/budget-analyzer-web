import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  useDeleteTransaction,
  useTransactions,
  useUpdateTransaction,
} from '@/hooks/useTransactions';
import { viewKeys } from '@/queryKeys';
import { createTestQueryClient } from '@/testing/test-utils';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { server } from '@/testing/mocks/server';

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

describe('transaction mutations', () => {
  it('invalidates saved views after deleting a transaction', async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteTransaction(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await result.current.mutateAsync(1);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: viewKeys.all });
  });

  it('does not invalidate static membership after updating a transaction', async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.patch('/api/v1/transactions/:id', () =>
        HttpResponse.json({
          id: 1,
          accountId: 'updated-account',
          bankName: 'Test Bank',
          date: '2026-01-02',
          currencyIsoCode: 'USD',
          amount: 100.5,
          type: 'DEBIT',
          description: 'Updated transaction',
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-03T00:00:00Z',
        }),
      ),
    );

    const { result } = renderHook(() => useUpdateTransaction(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await result.current.mutateAsync({ id: 1, data: { description: 'Updated transaction' } });

    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: viewKeys.all });
  });
});
