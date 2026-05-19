import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { statementFormatApi } from '@/api/statementFormatApi';
import { server } from '@/testing/mocks/server';
import type {
  CreateStatementFormatRequest,
  StatementFormat,
  UpdateStatementFormatRequest,
} from '@/types/statementFormat';

const csvFormat: StatementFormat = {
  id: 1,
  formatKey: 'capital-one-csv',
  displayName: 'Capital One CSV',
  formatType: 'CSV',
  bankName: 'Capital One',
  defaultCurrencyIsoCode: 'USD',
  dateHeader: 'Date',
  dateFormat: 'MM/dd/yyyy',
  descriptionHeader: 'Description',
  creditHeader: 'Credit',
  debitHeader: 'Debit',
  enabled: true,
};

describe('statementFormatApi', () => {
  it('lists statement formats', async () => {
    let capturedUrl: URL | undefined;

    server.use(
      http.get('/api/v1/statement-formats', ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json([csvFormat]);
      }),
    );

    const response = await statementFormatApi.listFormats();

    expect(capturedUrl?.pathname).toBe('/api/v1/statement-formats');
    expect(response).toEqual([csvFormat]);
  });

  it('requests a statement format by format key', async () => {
    let capturedUrl: URL | undefined;

    server.use(
      http.get('/api/v1/statement-formats/:formatKey', ({ request, params }) => {
        capturedUrl = new URL(request.url);
        expect(params.formatKey).toBe('capital-one-csv');
        return HttpResponse.json(csvFormat);
      }),
    );

    const response = await statementFormatApi.getFormat('capital-one-csv');

    expect(capturedUrl?.pathname).toBe('/api/v1/statement-formats/capital-one-csv');
    expect(response.formatKey).toBe('capital-one-csv');
  });

  it('posts create payloads and puts update payloads to the format resource', async () => {
    const createRequest: CreateStatementFormatRequest = {
      formatKey: 'amex-csv',
      displayName: 'Amex CSV',
      formatType: 'CSV',
      bankName: 'Amex',
      defaultCurrencyIsoCode: 'USD',
      dateHeader: 'Date',
      dateFormat: 'yyyy-MM-dd',
      descriptionHeader: 'Description',
      debitHeader: 'Amount',
    };
    const updateRequest: UpdateStatementFormatRequest = {
      displayName: 'Amex Export',
      enabled: false,
    };
    const capturedBodies: unknown[] = [];
    const capturedMethods: string[] = [];

    server.use(
      http.post('/api/v1/statement-formats', async ({ request }) => {
        capturedMethods.push(request.method);
        capturedBodies.push(await request.json());
        return HttpResponse.json({ ...csvFormat, ...createRequest, id: 2 });
      }),
      http.put('/api/v1/statement-formats/:formatKey', async ({ request, params }) => {
        expect(params.formatKey).toBe('amex-csv');
        capturedMethods.push(request.method);
        capturedBodies.push(await request.json());
        return HttpResponse.json({ ...csvFormat, ...createRequest, ...updateRequest, id: 2 });
      }),
    );

    await statementFormatApi.createFormat(createRequest);
    await statementFormatApi.updateFormat('amex-csv', updateRequest);

    expect(capturedMethods).toEqual(['POST', 'PUT']);
    expect(capturedBodies).toEqual([createRequest, updateRequest]);
  });
});
