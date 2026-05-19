import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { viewApi } from '@/api/viewApi';
import { server } from '@/testing/mocks/server';
import type { CreateSavedViewRequest, SavedView, UpdateSavedViewRequest } from '@/types/view';

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

describe('viewApi', () => {
  it('lists, reads, and deletes saved views at the expected paths', async () => {
    const calls: Array<{ method: string; path: string }> = [];

    server.use(
      http.get('/api/v1/views', ({ request }) => {
        calls.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json([savedView]);
      }),
      http.get('/api/v1/views/:id', ({ request, params }) => {
        expect(params.id).toBe('view-1');
        calls.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json(savedView);
      }),
      http.delete('/api/v1/views/:id', ({ request, params }) => {
        expect(params.id).toBe('view-1');
        calls.push({ method: request.method, path: new URL(request.url).pathname });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await viewApi.listViews();
    await viewApi.getView('view-1');
    await viewApi.deleteView('view-1');

    expect(calls).toEqual([
      { method: 'GET', path: '/api/v1/views' },
      { method: 'GET', path: '/api/v1/views/view-1' },
      { method: 'DELETE', path: '/api/v1/views/view-1' },
    ]);
  });

  it('posts create payloads and puts update payloads to saved-view resources', async () => {
    const createRequest: CreateSavedViewRequest = {
      name: 'Groceries',
      criteria: { searchText: 'market', type: 'DEBIT' },
      openEnded: true,
    };
    const updateRequest: UpdateSavedViewRequest = {
      name: 'Updated Groceries',
      criteria: { searchText: 'store' },
      openEnded: false,
    };
    const capturedBodies: unknown[] = [];
    const capturedMethods: string[] = [];

    server.use(
      http.post('/api/v1/views', async ({ request }) => {
        capturedMethods.push(request.method);
        capturedBodies.push(await request.json());
        return HttpResponse.json({ ...savedView, ...createRequest });
      }),
      http.put('/api/v1/views/:id', async ({ request, params }) => {
        expect(params.id).toBe('view-1');
        capturedMethods.push(request.method);
        capturedBodies.push(await request.json());
        return HttpResponse.json({ ...savedView, ...updateRequest });
      }),
    );

    await viewApi.createView(createRequest);
    await viewApi.updateView('view-1', updateRequest);

    expect(capturedMethods).toEqual(['POST', 'PUT']);
    expect(capturedBodies).toEqual([createRequest, updateRequest]);
  });

  it('uses membership and transaction override endpoints with the correct methods and payloads', async () => {
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];

    server.use(
      http.get('/api/v1/views/:id/transactions', ({ request, params }) => {
        expect(params.id).toBe('view-1');
        calls.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json({ matched: [1], pinned: [2], excluded: [3] });
      }),
      http.post('/api/v1/views/:id/pin/:txnId', ({ request, params }) => {
        expect(params).toMatchObject({ id: 'view-1', txnId: '2' });
        calls.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json(savedView);
      }),
      http.post('/api/v1/views/:id/pin', async ({ request, params }) => {
        expect(params.id).toBe('view-1');
        calls.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body: await request.json(),
        });
        return HttpResponse.json({ updatedCount: 2, notFoundIds: [] });
      }),
      http.delete('/api/v1/views/:id/pin/:txnId', ({ request, params }) => {
        expect(params).toMatchObject({ id: 'view-1', txnId: '2' });
        calls.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json(savedView);
      }),
      http.post('/api/v1/views/:id/exclude/:txnId', ({ request, params }) => {
        expect(params).toMatchObject({ id: 'view-1', txnId: '3' });
        calls.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json(savedView);
      }),
      http.post('/api/v1/views/:id/exclude', async ({ request, params }) => {
        expect(params.id).toBe('view-1');
        calls.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body: await request.json(),
        });
        return HttpResponse.json({ updatedCount: 2, notFoundIds: [] });
      }),
      http.delete('/api/v1/views/:id/exclude/:txnId', ({ request, params }) => {
        expect(params).toMatchObject({ id: 'view-1', txnId: '3' });
        calls.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json(savedView);
      }),
    );

    await viewApi.getViewTransactions('view-1');
    await viewApi.pinTransaction('view-1', 2);
    await viewApi.bulkPinTransactions('view-1', [2, 4]);
    await viewApi.unpinTransaction('view-1', 2);
    await viewApi.excludeTransaction('view-1', 3);
    await viewApi.bulkExcludeTransactions('view-1', [3, 5]);
    await viewApi.unexcludeTransaction('view-1', 3);

    expect(calls).toEqual([
      { method: 'GET', path: '/api/v1/views/view-1/transactions' },
      { method: 'POST', path: '/api/v1/views/view-1/pin/2' },
      { method: 'POST', path: '/api/v1/views/view-1/pin', body: { ids: [2, 4] } },
      { method: 'DELETE', path: '/api/v1/views/view-1/pin/2' },
      { method: 'POST', path: '/api/v1/views/view-1/exclude/3' },
      { method: 'POST', path: '/api/v1/views/view-1/exclude', body: { ids: [3, 5] } },
      { method: 'DELETE', path: '/api/v1/views/view-1/exclude/3' },
    ]);
  });
});
