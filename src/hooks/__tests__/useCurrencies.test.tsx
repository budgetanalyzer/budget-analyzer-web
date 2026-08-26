import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateCurrency,
  useCurrencies,
  useExchangeRates,
  useExchangeRatesMap,
  useUpdateCurrency,
} from '@/hooks/useCurrencies';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';
import type { CurrencySeriesResponse } from '@/types/currency';
import type { Transaction } from '@/types/transaction';

const usdCurrency: CurrencySeriesResponse = {
  id: 1,
  currencyCode: 'USD',
  providerSeriesId: 'DEXUSAL',
  enabled: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

function currency(currencyCode: string, id: number): CurrencySeriesResponse {
  return {
    ...usdCurrency,
    id,
    currencyCode,
  };
}

function transaction(id: number, currencyIsoCode: string, date: string): Transaction {
  return {
    id,
    accountId: `account-${id}`,
    bankName: 'Test Bank',
    date,
    currencyIsoCode,
    amount: 10,
    type: 'DEBIT',
    description: `Transaction ${id}`,
    createdAt: `${date}T00:00:00Z`,
    updatedAt: `${date}T00:00:00Z`,
  };
}

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

describe('useExchangeRatesMap', () => {
  it('requests only needed currencies with inclusive complete-snapshot bounds', async () => {
    const queryClient = createTestQueryClient();
    const capturedUrls: URL[] = [];

    server.use(
      http.get('/api/v1/transactions', () =>
        HttpResponse.json([
          transaction(1, 'EUR', '2026-01-15'),
          transaction(2, 'USD', '2026-01-01'),
          transaction(3, 'JPY', '2026-01-31'),
        ]),
      ),
      http.get('/api/v1/currencies', () =>
        HttpResponse.json([currency('EUR', 2), currency('JPY', 3)]),
      ),
      http.get('/api/v1/exchange-rates', ({ request }) => {
        const url = new URL(request.url);
        const targetCurrency = url.searchParams.get('targetCurrency') ?? '';
        capturedUrls.push(url);
        return HttpResponse.json([
          {
            baseCurrency: 'USD',
            targetCurrency,
            date: '2026-01-15',
            publishedDate: '2026-01-15',
            rate: targetCurrency === 'EUR' ? 0.8 : 150,
          },
        ]);
      }),
    );

    const { result } = renderHook(() => useExchangeRatesMap({ displayCurrency: 'JPY' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.exchangeRatesData).toHaveLength(2));

    expect(capturedUrls.map((url) => url.searchParams.get('targetCurrency')).sort()).toEqual([
      'EUR',
      'JPY',
    ]);
    capturedUrls.forEach((url) => {
      expect(url.searchParams.get('startDate')).toBe('2026-01-01');
      expect(url.searchParams.get('endDate')).toBe('2026-01-31');
    });
    expect(
      queryClient.getQueryData(['exchangeRates', 'EUR', '2026-01-01', '2026-01-31']),
    ).toBeDefined();
    expect(result.current.pendingCurrencies).toEqual([]);
    expect(result.current.failedCurrencies).toEqual([]);
  });

  it('retains successful series and identifies a partially failed currency', async () => {
    server.use(
      http.get('/api/v1/transactions', () =>
        HttpResponse.json([
          transaction(1, 'EUR', '2026-02-01'),
          transaction(2, 'JPY', '2026-02-02'),
        ]),
      ),
      http.get('/api/v1/currencies', () =>
        HttpResponse.json([currency('EUR', 2), currency('JPY', 3)]),
      ),
      http.get('/api/v1/exchange-rates', ({ request }) => {
        const targetCurrency = new URL(request.url).searchParams.get('targetCurrency');
        if (targetCurrency === 'JPY') {
          return HttpResponse.json(
            { type: 'SERVICE_UNAVAILABLE', message: 'JPY rates unavailable' },
            { status: 503 },
          );
        }
        return HttpResponse.json([
          {
            baseCurrency: 'USD',
            targetCurrency: 'EUR',
            date: '2026-02-01',
            publishedDate: '2026-01-30',
            rate: 0.8,
          },
        ]);
      }),
    );

    const { result } = renderHook(() => useExchangeRatesMap({ displayCurrency: 'USD' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.failedCurrencies).toEqual(['JPY']), {
      timeout: 4000,
    });

    expect(result.current.exchangeRatesMap.get('2026-02-01')?.get('EUR')?.rate).toBe(0.8);
    expect(result.current.exchangeRatesData).toHaveLength(1);
    expect(result.current.pendingCurrencies).toEqual([]);
    expect(result.current.error).toMatchObject({ status: 503 });
  });

  it('reports an enabled currency with an empty successful series as pending', async () => {
    server.use(
      http.get('/api/v1/transactions', () =>
        HttpResponse.json([transaction(1, 'USD', '2026-03-01')]),
      ),
      http.get('/api/v1/currencies', () => HttpResponse.json([currency('EUR', 2)])),
      http.get('/api/v1/exchange-rates', () => HttpResponse.json([])),
    );

    const { result } = renderHook(() => useExchangeRatesMap({ displayCurrency: 'EUR' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.pendingCurrencies).toEqual(['EUR']));

    expect(result.current.failedCurrencies).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it('does not issue exchange-rate history queries for an empty snapshot', async () => {
    const queryClient = createTestQueryClient();
    let exchangeRateRequestCount = 0;

    server.use(
      http.get('/api/v1/transactions', () => HttpResponse.json([])),
      http.get('/api/v1/currencies', () => HttpResponse.json([])),
      http.get('/api/v1/exchange-rates', () => {
        exchangeRateRequestCount += 1;
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useExchangeRatesMap({ displayCurrency: 'EUR' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() =>
      expect(queryClient.getQueryState(['transactions'])?.status).toBe('success'),
    );

    expect(exchangeRateRequestCount).toBe(0);
    expect(result.current.exchangeRatesData).toEqual([]);
    expect(result.current.pendingCurrencies).toEqual([]);
    expect(result.current.failedCurrencies).toEqual([]);
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
