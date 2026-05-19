import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateCurrency,
  useCurrencies,
  useExchangeRates,
  useUpdateCurrency,
} from '@/hooks/useCurrencies';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';
import type { CurrencySeriesResponse } from '@/types/currency';

const usdCurrency: CurrencySeriesResponse = {
  id: 1,
  currencyCode: 'USD',
  providerSeriesId: 'DEXUSAL',
  enabled: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

function createWrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCurrencies', () => {
  it('stores enabled-only currency results under the enabled query key', async () => {
    const queryClient = createTestQueryClient();
    let enabledOnly: string | null = null;

    server.use(
      http.get('/api/v1/currencies', ({ request }) => {
        enabledOnly = new URL(request.url).searchParams.get('enabledOnly');
        return HttpResponse.json([usdCurrency]);
      }),
    );

    const { result } = renderHook(() => useCurrencies(true), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(enabledOnly).toBe('true');
    expect(queryClient.getQueryData(['currencies', true])).toEqual([usdCurrency]);
  });

  it('surfaces currency list API errors', async () => {
    server.use(
      http.get('/api/v1/currencies', () => {
        return HttpResponse.json(
          { type: 'SERVICE_UNAVAILABLE', message: 'Currency service unavailable' },
          { status: 503 },
        );
      }),
    );

    const { result } = renderHook(() => useCurrencies(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });

    expect(result.current.error?.status).toBe(503);
    expect(result.current.error?.message).toBe('Currency service unavailable');
  });
});

describe('useExchangeRates', () => {
  it('does not request exchange rates when disabled', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v1/exchange-rates', () => {
        requestCount += 1;
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(
      () => useExchangeRates({ targetCurrency: 'EUR', enabled: false }),
      {
        wrapper: createWrapper(),
      },
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));

    expect(result.current.isPending).toBe(true);
    expect(requestCount).toBe(0);
  });
});

describe('currency mutation hooks', () => {
  it('invalidates currency lists after create success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post('/api/v1/currencies', () => {
        return HttpResponse.json({ ...usdCurrency, id: 2, currencyCode: 'EUR' });
      }),
    );

    const { result } = renderHook(() => useCreateCurrency(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      currencyCode: 'EUR',
      providerSeriesId: 'DEXUSEU',
      enabled: true,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['currencies'] });
  });

  it('invalidates list, detail, and transaction-count queries after update success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.put('/api/v1/currencies/:id', () => {
        return HttpResponse.json({ ...usdCurrency, id: 2, currencyCode: 'EUR', enabled: false });
      }),
    );

    const { result } = renderHook(() => useUpdateCurrency(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({ id: 2, data: { enabled: false } });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['currencies'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['currencies', 'detail', 2] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['transactionCount'] });
  });
});
