import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  useBulkPinTransactions,
  useCreateView,
  useDeleteView,
  useUnexcludeTransaction,
  useUpdateView,
  useView,
  useViews,
  viewKeys,
} from '@/hooks/useViews';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';
import type { SavedView } from '@/types/view';

const savedView: SavedView = {
  id: 'view-1',
  name: 'January Groceries',
  criteria: {
    dateFrom: '2026-01-01',
    dateTo: '2026-01-31',
    searchText: 'market',
    type: 'DEBIT',
  },
  openEnded: false,
  pinnedCount: 1,
  excludedCount: 1,
  transactionCount: 12,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

function createWrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useViews', () => {
  it('stores saved views under the list query key', async () => {
    const queryClient = createTestQueryClient();

    server.use(
      http.get('/api/v1/views', () => {
        return HttpResponse.json([savedView]);
      }),
    );

    const { result } = renderHook(() => useViews(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(viewKeys.list())).toEqual([savedView]);
  });

  it('does not request saved-view detail when the id is empty', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v1/views/:id', () => {
        requestCount += 1;
        return HttpResponse.json(savedView);
      }),
    );

    const { result } = renderHook(() => useView(''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));

    expect(result.current.isPending).toBe(true);
    expect(requestCount).toBe(0);
  });

  it('surfaces saved-view list API errors', async () => {
    server.use(
      http.get('/api/v1/views', () => {
        return HttpResponse.json(
          { type: 'SERVICE_UNAVAILABLE', message: 'View service unavailable' },
          { status: 503 },
        );
      }),
    );

    const { result } = renderHook(() => useViews(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });

    expect(result.current.error?.status).toBe(503);
    expect(result.current.error?.message).toBe('View service unavailable');
  });
});

describe('saved-view mutation hooks', () => {
  it('invalidates the saved-view list after create and delete success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post('/api/v1/views', () => {
        return HttpResponse.json(savedView);
      }),
      http.delete('/api/v1/views/:id', () => {
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const createHook = renderHook(() => useCreateView(), {
      wrapper: createWrapper(queryClient),
    });
    const deleteHook = renderHook(() => useDeleteView(), {
      wrapper: createWrapper(queryClient),
    });

    await createHook.result.current.mutateAsync({
      name: 'January Groceries',
      criteria: { searchText: 'market' },
    });
    await deleteHook.result.current.mutateAsync('view-1');

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.list() });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('invalidates list and detail queries after update success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.put('/api/v1/views/:id', () => {
        return HttpResponse.json({ ...savedView, name: 'Updated Groceries' });
      }),
    );

    const { result } = renderHook(() => useUpdateView(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      id: 'view-1',
      request: { name: 'Updated Groceries' },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.list() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.detail('view-1') });
  });

  it('invalidates detail, membership, and list queries after transaction override mutations', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post('/api/v1/views/:id/pin', () => {
        return HttpResponse.json({ updatedCount: 2, notFoundIds: [] });
      }),
      http.delete('/api/v1/views/:id/exclude/:txnId', () => {
        return HttpResponse.json(savedView);
      }),
    );

    const bulkPinHook = renderHook(() => useBulkPinTransactions(), {
      wrapper: createWrapper(queryClient),
    });
    const unexcludeHook = renderHook(() => useUnexcludeTransaction(), {
      wrapper: createWrapper(queryClient),
    });

    await bulkPinHook.result.current.mutateAsync({ viewId: 'view-1', ids: [1, 2] });
    await unexcludeHook.result.current.mutateAsync({ viewId: 'view-1', txnId: 3 });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.detail('view-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.transactions('view-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.list() });
  });
});
