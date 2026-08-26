import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { useBulkDeleteTransactions } from '@/hooks/useBulkDeleteTransactions';
import { viewKeys } from '@/queryKeys';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';

describe('useBulkDeleteTransactions', () => {
  it('invalidates saved views after deleting transactions', async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post('/api/v1/transactions/bulk-delete', () =>
        HttpResponse.json({ deletedCount: 2, notFoundIds: [] }),
      ),
    );

    const { result } = renderHook(() => useBulkDeleteTransactions(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await result.current.mutateAsync([1, 2]);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: viewKeys.all });
  });
});
