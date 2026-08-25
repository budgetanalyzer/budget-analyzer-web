import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { transactionSearchApi } from '@/api/transactionSearchApi';
import { server } from '@/testing/mocks/server';
import type { TransactionSearchQuery } from '@/types/transactionSearch';

const emptyPage = {
  content: [],
  metadata: {
    page: 0,
    size: 50,
    numberOfElements: 0,
    totalElements: 0,
    totalPages: 0,
    first: true,
    last: true,
  },
};

function query(overrides: Partial<TransactionSearchQuery>): TransactionSearchQuery {
  return {
    page: 0,
    size: 50,
    sort: ['date,DESC', 'id,DESC'],
    ...overrides,
  };
}

describe('transactionSearchApi.search', () => {
  it.each([
    {
      name: 'currency only',
      query: query({ currencyIsoCode: 'EUR' }),
      expected: { currencyIsoCode: 'EUR', minAmount: null, maxAmount: null },
    },
    {
      name: 'signed amount only',
      query: query({ minAmount: -20 }),
      expected: { currencyIsoCode: null, minAmount: '-20', maxAmount: null },
    },
    {
      name: 'combined currency and amount',
      query: query({ currencyIsoCode: 'JPY', minAmount: -20, maxAmount: 500 }),
      expected: { currencyIsoCode: 'JPY', minAmount: '-20', maxAmount: '500' },
    },
  ])(
    'preserves independent filters for $name requests',
    async ({ query: requestQuery, expected }) => {
      let requestUrl: URL | undefined;
      server.use(
        http.get('/api/v1/transactions/search', ({ request }) => {
          requestUrl = new URL(request.url);
          return HttpResponse.json(emptyPage);
        }),
      );

      await transactionSearchApi.search(requestQuery);

      expect(requestUrl?.searchParams.get('currencyIsoCode')).toBe(expected.currencyIsoCode);
      expect(requestUrl?.searchParams.get('minAmount')).toBe(expected.minAmount);
      expect(requestUrl?.searchParams.get('maxAmount')).toBe(expected.maxAmount);
      expect(requestUrl?.searchParams.getAll('sort')).toEqual(['date,DESC', 'id,DESC']);
      expect(requestUrl?.searchParams.get('page')).toBe('0');
      expect(requestUrl?.searchParams.get('size')).toBe('50');
    },
  );
});
