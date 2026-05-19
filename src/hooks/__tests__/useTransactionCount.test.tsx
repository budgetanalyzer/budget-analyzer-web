import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useTransactionCount } from '@/hooks/useTransactionCount';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';

function createWrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useTransactionCount', () => {
  it('stores counts under the filter-specific transactionCount query key', async () => {
    const queryClient = createTestQueryClient();
    let currencyIsoCode: string | null = null;

    server.use(
      http.get('/api/v1/transactions/count', ({ request }) => {
        currencyIsoCode = new URL(request.url).searchParams.get('currencyIsoCode');
        return HttpResponse.json(7);
      }),
    );

    const filter = { currencyIsoCode: 'EUR' };
    const { result } = renderHook(() => useTransactionCount(filter), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(currencyIsoCode).toBe('EUR');
    expect(queryClient.getQueryData(['transactionCount', filter])).toBe(7);
  });

  it('does not request the count when disabled', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v1/transactions/count', () => {
        requestCount += 1;
        return HttpResponse.json(7);
      }),
    );

    const { result } = renderHook(() => useTransactionCount({ currencyIsoCode: 'EUR' }, false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));

    expect(result.current.isPending).toBe(true);
    expect(requestCount).toBe(0);
  });

  it('surfaces count API errors', async () => {
    server.use(
      http.get('/api/v1/transactions/count', () => {
        return HttpResponse.json(
          { type: 'SERVICE_UNAVAILABLE', message: 'Count service unavailable' },
          { status: 503 },
        );
      }),
    );

    const { result } = renderHook(() => useTransactionCount({ currencyIsoCode: 'EUR' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.status).toBe(503);
    expect(result.current.error?.message).toBe('Count service unavailable');
  });
});
