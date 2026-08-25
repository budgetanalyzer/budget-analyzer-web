import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { viewApi } from '@/api/viewApi';
import { server } from '@/testing/mocks/server';
import { ApiError } from '@/types/apiError';
import type {
  CreateSavedViewRequest,
  SavedViewMetadata,
  UpdateSavedViewRequest,
  UpdateSavedViewTransactionsRequest,
} from '@/types/view';

const savedView: SavedViewMetadata = {
  id: 'view-1',
  name: 'January Groceries',
  transactionCount: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

describe('viewApi', () => {
  it('lists, reads, and deletes static saved views at the expected paths', async () => {
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

    await expect(viewApi.listViews()).resolves.toEqual([savedView]);
    await expect(viewApi.getView('view-1')).resolves.toEqual(savedView);
    await expect(viewApi.deleteView('view-1')).resolves.toBeUndefined();

    expect(calls).toEqual([
      { method: 'GET', path: '/api/v1/views' },
      { method: 'GET', path: '/api/v1/views/view-1' },
      { method: 'DELETE', path: '/api/v1/views/view-1' },
    ]);
  });

  it('retains top-level array validation for the list endpoint', async () => {
    server.use(
      http.get('/api/v1/views', () => {
        return HttpResponse.json({ items: [savedView] });
      }),
    );

    await expect(viewApi.listViews()).rejects.toMatchObject({
      status: 502,
      response: {
        type: 'INTERNAL_ERROR',
        code: 'INVALID_COLLECTION_RESPONSE',
      },
    });
  });

  it.each([
    { name: 'Empty view', transactionIds: [] },
    { name: 'Selected purchases', transactionIds: [7, 3] },
  ] satisfies CreateSavedViewRequest[])('posts the exact static create body', async (request) => {
    let capturedBody: unknown;

    server.use(
      http.post('/api/v1/views', async ({ request: interceptedRequest }) => {
        capturedBody = await interceptedRequest.json();
        return HttpResponse.json(
          { ...savedView, name: request.name, transactionCount: request.transactionIds.length },
          { status: 201 },
        );
      }),
    );

    await expect(viewApi.createView(request)).resolves.toMatchObject({ name: request.name });
    expect(capturedBody).toEqual(request);
  });

  it('patches a rename with name as the only field', async () => {
    const request: UpdateSavedViewRequest = { name: 'Renamed view' };
    let capturedMethod = '';
    let capturedBody: unknown;

    server.use(
      http.patch('/api/v1/views/:id', async ({ request: interceptedRequest, params }) => {
        expect(params.id).toBe('view-1');
        capturedMethod = interceptedRequest.method;
        capturedBody = await interceptedRequest.json();
        return HttpResponse.json({ ...savedView, name: request.name });
      }),
    );

    await expect(viewApi.updateView('view-1', request)).resolves.toMatchObject(request);
    expect(capturedMethod).toBe('PATCH');
    expect(capturedBody).toEqual({ name: 'Renamed view' });
  });

  it('gets ordered membership and patches the exact two-array delta body without a response', async () => {
    const delta: UpdateSavedViewTransactionsRequest = {
      addTransactionIds: [5, 9],
      removeTransactionIds: [2],
    };
    const calls: Array<{ method: string; path: string; body?: unknown }> = [];

    server.use(
      http.get('/api/v1/views/:id/transactions', ({ request, params }) => {
        expect(params.id).toBe('view-1');
        calls.push({ method: request.method, path: new URL(request.url).pathname });
        return HttpResponse.json({ transactionIds: [9, 5, 1] });
      }),
      http.patch('/api/v1/views/:id/transactions', async ({ request, params }) => {
        expect(params.id).toBe('view-1');
        calls.push({
          method: request.method,
          path: new URL(request.url).pathname,
          body: await request.json(),
        });
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(viewApi.getViewTransactions('view-1')).resolves.toEqual({
      transactionIds: [9, 5, 1],
    });
    await expect(viewApi.updateViewTransactions('view-1', delta)).resolves.toBeUndefined();

    expect(calls).toEqual([
      { method: 'GET', path: '/api/v1/views/view-1/transactions' },
      {
        method: 'PATCH',
        path: '/api/v1/views/view-1/transactions',
        body: delta,
      },
    ]);
  });

  it.each([
    {
      request: { addTransactionIds: [], removeTransactionIds: [] },
      message: 'A membership delta must add or remove at least one transaction ID.',
    },
    {
      request: { addTransactionIds: [1, 2], removeTransactionIds: [2] },
      message: 'A transaction ID cannot be added and removed in the same delta.',
    },
    {
      request: { addTransactionIds: [0], removeTransactionIds: [] },
      message: 'addTransactionIds must contain only positive integer transaction IDs.',
    },
    {
      request: { addTransactionIds: [], removeTransactionIds: [-1] },
      message: 'removeTransactionIds must contain only positive integer transaction IDs.',
    },
  ])('rejects an invalid membership delta before transport', async ({ request, message }) => {
    let requestCount = 0;
    server.use(
      http.patch('/api/v1/views/:id/transactions', () => {
        requestCount += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const result = viewApi.updateViewTransactions('view-1', request);

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: 400, message });
    expect(requestCount).toBe(0);
  });

  it('rejects non-positive create membership IDs before transport', async () => {
    let requestCount = 0;
    server.use(
      http.post('/api/v1/views', () => {
        requestCount += 1;
        return HttpResponse.json(savedView, { status: 201 });
      }),
    );

    const result = viewApi.createView({ name: 'Invalid', transactionIds: [1, 1.5] });

    await expect(result).rejects.toMatchObject({
      status: 400,
      message: 'transactionIds must contain only positive integer transaction IDs.',
    });
    expect(requestCount).toBe(0);
  });
});
