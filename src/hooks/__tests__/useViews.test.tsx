import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  createAddViewTransactionsRequest,
  createRemoveViewTransactionsRequest,
  useCreateView,
  useDeleteView,
  useUpdateView,
  useUpdateViewTransactions,
  useView,
  useViewMembership,
  useViewTransactions,
  useViews,
} from '@/hooks/useViews';
import { transactionKeys, viewKeys } from '@/queryKeys';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';
import type { Transaction } from '@/types/transaction';
import type { SavedViewMetadata } from '@/types/view';

const savedView: SavedViewMetadata = {
  id: 'view-1',
  name: 'January Groceries',
  transactionCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

function transaction(id: number): Transaction {
  return {
    id,
    accountId: 'checking',
    bankName: 'Example Bank',
    date: '2026-01-15',
    currencyIsoCode: 'USD',
    amount: id * 10,
    type: 'DEBIT',
    description: `Transaction ${id}`,
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
  };
}

function createWrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('static saved-view queries', () => {
  it('stores static metadata under the list query key', async () => {
    const queryClient = createTestQueryClient();
    server.use(http.get('/api/v1/views', () => HttpResponse.json([savedView])));

    const { result } = renderHook(useViews, { wrapper: createWrapper(queryClient) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(viewKeys.list())).toEqual([savedView]);
  });

  it('does not request detail or membership for an empty id', async () => {
    let requestCount = 0;
    server.use(
      http.get('/api/v1/views/:id', () => {
        requestCount += 1;
        return HttpResponse.json(savedView);
      }),
      http.get('/api/v1/views/:id/transactions', () => {
        requestCount += 1;
        return HttpResponse.json({ transactionIds: [] });
      }),
    );

    const { result } = renderHook(
      () => ({ detail: useView(''), membership: useViewMembership('') }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.detail.fetchStatus).toBe('idle'));

    expect(result.current.membership.fetchStatus).toBe('idle');
    expect(requestCount).toBe(0);
  });

  it('preserves membership order, skips stale ids, and makes zero individual requests', async () => {
    let individualRequestCount = 0;
    server.use(
      http.get('/api/v1/views/:id/transactions', () =>
        HttpResponse.json({ transactionIds: [3, 99, 1] }),
      ),
      http.get('/api/v1/transactions', () =>
        HttpResponse.json([transaction(1), transaction(2), transaction(3)]),
      ),
      http.get('/api/v1/transactions/:id', () => {
        individualRequestCount += 1;
        return HttpResponse.json(transaction(99));
      }),
    );

    const { result } = renderHook(() => useViewTransactions('view-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map(({ id }) => id)).toEqual([3, 1]);
    expect(result.current.allTransactions?.map(({ id }) => id)).toEqual([1, 2, 3]);
    expect(result.current.memberTransactionIds).toEqual([3, 99, 1]);
    expect(result.current.missingTransactionIds).toEqual([99]);
    expect(individualRequestCount).toBe(0);
  });

  it('combines membership errors with the complete-snapshot state', async () => {
    server.use(
      http.get('/api/v1/views/:id/transactions', () =>
        HttpResponse.json(
          { type: 'SERVICE_UNAVAILABLE', message: 'Membership unavailable' },
          { status: 503 },
        ),
      ),
      http.get('/api/v1/transactions', () => HttpResponse.json([transaction(1)])),
    );

    const { result } = renderHook(() => useViewTransactions('view-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });

    expect(result.current.data).toBeUndefined();
    expect(result.current.error?.message).toBe('Membership unavailable');
  });
});

describe('static saved-view mutations', () => {
  it('creates an empty collection and invalidates the list', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    let requestBody: unknown;
    server.use(
      http.post('/api/v1/views', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json({ ...savedView, transactionCount: 0 });
      }),
    );

    const { result } = renderHook(useCreateView, { wrapper: createWrapper(queryClient) });
    await result.current.mutateAsync({ name: 'Empty', transactionIds: [] });

    expect(requestBody).toEqual({ name: 'Empty', transactionIds: [] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.list() });
  });

  it('refreshes the complete snapshot after stale creation without retrying', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    let requestCount = 0;
    server.use(
      http.post('/api/v1/views', () => {
        requestCount += 1;
        return HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            message: 'Stale membership',
            code: 'SAVED_VIEW_MEMBERSHIP_STALE',
          },
          { status: 422 },
        );
      }),
    );

    const { result } = renderHook(useCreateView, { wrapper: createWrapper(queryClient) });
    await expect(
      result.current.mutateAsync({ name: 'Snapshot', transactionIds: [1, 2] }),
    ).rejects.toMatchObject({ response: { code: 'SAVED_VIEW_MEMBERSHIP_STALE' } });

    expect(requestCount).toBe(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: transactionKeys.list() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.list() });
  });

  it('renames with PATCH and invalidates list and detail', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    let method = '';
    let body: unknown;
    server.use(
      http.patch('/api/v1/views/:id', async ({ request }) => {
        method = request.method;
        body = await request.json();
        return HttpResponse.json({ ...savedView, name: 'Renamed' });
      }),
    );

    const { result } = renderHook(useUpdateView, { wrapper: createWrapper(queryClient) });
    await result.current.mutateAsync({ id: 'view-1', request: { name: 'Renamed' } });

    expect(method).toBe('PATCH');
    expect(body).toEqual({ name: 'Renamed' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.list() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.detail('view-1') });
  });

  it('removes unique positive IDs with both arrays and invalidates every membership resource', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    let requestBody: unknown;
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request, params }) => {
        expect(params.id).toBe('view-1');
        requestBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(useUpdateViewTransactions, {
      wrapper: createWrapper(queryClient),
    });
    const request = createRemoveViewTransactionsRequest([7, 7, 0, -2, 11.5, 3]);

    await expect(
      result.current.mutateAsync({ viewId: 'view-1', request }),
    ).resolves.toBeUndefined();

    expect(requestBody).toEqual({ addTransactionIds: [], removeTransactionIds: [7, 3] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.list() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.detail('view-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.membership('view-1') });
  });

  it('adds unique positive IDs with both arrays and refreshes stale addition resources', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    let requestBody: unknown;
    server.use(
      http.patch('/api/v1/views/:id/transactions', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            code: 'SAVED_VIEW_MEMBERSHIP_STALE',
            message: 'Snapshot changed',
          },
          { status: 422 },
        );
      }),
    );

    const { result } = renderHook(useUpdateViewTransactions, {
      wrapper: createWrapper(queryClient),
    });
    const request = createAddViewTransactionsRequest([7, 7, 0, -2, 11.5, 3]);

    await expect(result.current.mutateAsync({ viewId: 'view-1', request })).rejects.toMatchObject({
      response: { code: 'SAVED_VIEW_MEMBERSHIP_STALE' },
    });

    expect(requestBody).toEqual({ addTransactionIds: [7, 3], removeTransactionIds: [] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: transactionKeys.list() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.list() });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.detail('view-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.membership('view-1') });
  });

  it('treats an unknown removal as idempotent 204 success without inventing a count', async () => {
    server.use(
      http.patch('/api/v1/views/:id/transactions', () => new HttpResponse(null, { status: 204 })),
    );

    const { result } = renderHook(useUpdateViewTransactions, { wrapper: createWrapper() });
    const response = await result.current.mutateAsync({
      viewId: 'view-1',
      request: createRemoveViewTransactionsRequest([999]),
    });

    expect(response).toBeUndefined();
  });

  it('invalidates the list after delete', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    server.use(http.delete('/api/v1/views/:id', () => new HttpResponse(null, { status: 204 })));

    const { result } = renderHook(useDeleteView, { wrapper: createWrapper(queryClient) });
    await result.current.mutateAsync('view-1');

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: viewKeys.list() });
  });
});
