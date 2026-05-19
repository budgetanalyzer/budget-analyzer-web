import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useMissingCurrencies } from '@/hooks/useMissingCurrencies';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';

function createWrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useMissingCurrencies', () => {
  it('returns disabled currencies that still appear in transactions', async () => {
    server.use(
      http.get('/api/v1/currencies', () => {
        return HttpResponse.json([
          {
            id: 1,
            currencyCode: 'USD',
            providerSeriesId: 'DEXUSAL',
            enabled: true,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
          },
          {
            id: 2,
            currencyCode: 'EUR',
            providerSeriesId: 'DEXUSEU',
            enabled: false,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
          },
          {
            id: 3,
            currencyCode: 'CAD',
            providerSeriesId: 'DEXCAUS',
            enabled: false,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
          },
        ]);
      }),
      http.get('/api/v1/transactions', () => {
        return HttpResponse.json([
          {
            id: 1,
            accountId: 'checking-1',
            bankName: 'Test Bank',
            date: '2026-01-10',
            currencyIsoCode: 'EUR',
            amount: 12.5,
            type: 'DEBIT',
            description: 'Market',
            createdAt: '2026-01-10T00:00:00Z',
            updatedAt: '2026-01-10T00:00:00Z',
          },
          {
            id: 2,
            accountId: 'checking-1',
            bankName: 'Test Bank',
            date: '2026-01-11',
            currencyIsoCode: 'USD',
            amount: 100,
            type: 'CREDIT',
            description: 'Deposit',
            createdAt: '2026-01-11T00:00:00Z',
            updatedAt: '2026-01-11T00:00:00Z',
          },
        ]);
      }),
    );

    const { result } = renderHook(() => useMissingCurrencies(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current).toEqual(['EUR']));
  });

  it('returns an empty list while source queries have not loaded', () => {
    server.use(
      http.get('/api/v1/currencies', () => {
        return HttpResponse.json([]);
      }),
      http.get('/api/v1/transactions', () => {
        return HttpResponse.json([]);
      }),
    );

    const { result } = renderHook(() => useMissingCurrencies(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual([]);
  });
});
