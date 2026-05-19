import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { currencyApi } from '@/api/currencyApi';
import { server } from '@/testing/mocks/server';
import type {
  CurrencySeriesCreateRequest,
  CurrencySeriesResponse,
  CurrencySeriesUpdateRequest,
} from '@/types/currency';

const usdCurrency: CurrencySeriesResponse = {
  id: 1,
  currencyCode: 'USD',
  providerSeriesId: 'DEXUSAL',
  enabled: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

describe('currencyApi', () => {
  it('requests currency lists with the enabledOnly query parameter', async () => {
    let capturedUrl: URL | undefined;

    server.use(
      http.get('/api/v1/currencies', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json([usdCurrency]);
      }),
    );

    const response = await currencyApi.getCurrencies(true);

    expect(capturedUrl?.pathname).toBe('/api/v1/currencies');
    expect(capturedUrl?.searchParams.get('enabledOnly')).toBe('true');
    expect(response).toEqual([usdCurrency]);
  });

  it('requests a currency by id', async () => {
    let capturedUrl: URL | undefined;

    server.use(
      http.get('/api/v1/currencies/:id', ({ request, params }) => {
        capturedUrl = new URL(request.url);
        expect(params.id).toBe('1');
        return HttpResponse.json(usdCurrency);
      }),
    );

    const response = await currencyApi.getCurrencyById(1);

    expect(capturedUrl?.pathname).toBe('/api/v1/currencies/1');
    expect(response.id).toBe(1);
  });

  it('posts create payloads and puts update payloads to the currency resource', async () => {
    const createRequest: CurrencySeriesCreateRequest = {
      currencyCode: 'EUR',
      providerSeriesId: 'DEXUSEU',
      enabled: true,
    };
    const updateRequest: CurrencySeriesUpdateRequest = { enabled: false };
    const capturedBodies: unknown[] = [];
    const capturedMethods: string[] = [];

    server.use(
      http.post('/api/v1/currencies', async ({ request }) => {
        capturedMethods.push(request.method);
        capturedBodies.push(await request.json());
        return HttpResponse.json({ ...usdCurrency, id: 2, currencyCode: 'EUR' });
      }),
      http.put('/api/v1/currencies/:id', async ({ request, params }) => {
        expect(params.id).toBe('2');
        capturedMethods.push(request.method);
        capturedBodies.push(await request.json());
        return HttpResponse.json({ ...usdCurrency, id: 2, currencyCode: 'EUR', enabled: false });
      }),
    );

    await currencyApi.createCurrency(createRequest);
    await currencyApi.updateCurrency(2, updateRequest);

    expect(capturedMethods).toEqual(['POST', 'PUT']);
    expect(capturedBodies).toEqual([createRequest, updateRequest]);
  });

  it('requests exchange rates with target currency and date bounds', async () => {
    let capturedUrl: URL | undefined;

    server.use(
      http.get('/api/v1/exchange-rates', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json([
          {
            baseCurrency: 'USD',
            targetCurrency: 'EUR',
            date: '2026-01-01',
            rate: 0.92,
          },
        ]);
      }),
    );

    const response = await currencyApi.getExchangeRates({
      targetCurrency: 'EUR',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(capturedUrl?.pathname).toBe('/api/v1/exchange-rates');
    expect(capturedUrl?.searchParams.get('targetCurrency')).toBe('EUR');
    expect(capturedUrl?.searchParams.get('startDate')).toBe('2026-01-01');
    expect(capturedUrl?.searchParams.get('endDate')).toBe('2026-01-31');
    expect(response[0].rate).toBe(0.92);
  });
});
