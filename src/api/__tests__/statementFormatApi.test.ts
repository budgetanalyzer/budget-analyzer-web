import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { http, HttpResponse } from 'msw';
import { statementFormatApi } from '@/api/statementFormatApi';
import { apiClient } from '@/api/client';
import { server } from '@/testing/mocks/server';
import type {
  CsvWizardMappingPreviewRequest,
  CsvWizardSaveRequest,
  CreateStatementFormatRequest,
  StatementFormat,
  UpdateStatementFormatRequest,
} from '@/types/statementFormat';

const csvFormat: StatementFormat = {
  id: 1,
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

const originalAdapter = apiClient.defaults.adapter;

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

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

  it('requests a statement format by ID', async () => {
    let capturedUrl: URL | undefined;

    server.use(
      http.get('/api/v1/statement-formats/:id', ({ request, params }) => {
        capturedUrl = new URL(request.url);
        expect(params.id).toBe('1');
        return HttpResponse.json(csvFormat);
      }),
    );

    const response = await statementFormatApi.getFormat(1);

    expect(capturedUrl?.pathname).toBe('/api/v1/statement-formats/1');
    expect(response.id).toBe(1);
  });

  it('posts create payloads and puts update payloads to the format resource', async () => {
    const createRequest: CreateStatementFormatRequest = {
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
      http.put('/api/v1/statement-formats/:id', async ({ request, params }) => {
        expect(params.id).toBe('2');
        capturedMethods.push(request.method);
        capturedBodies.push(await request.json());
        return HttpResponse.json({ ...csvFormat, ...createRequest, ...updateRequest, id: 2 });
      }),
    );

    await statementFormatApi.createFormat(createRequest);
    await statementFormatApi.updateFormat(2, updateRequest);

    expect(capturedMethods).toEqual(['POST', 'PUT']);
    expect(capturedBodies).toEqual([createRequest, updateRequest]);
  });

  it('posts multipart CSV wizard analyze requests', async () => {
    const file = new File(['Date,Description,Amount'], 'sample.csv', { type: 'text/csv' });
    let capturedConfig: InternalAxiosRequestConfig | undefined;

    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      capturedConfig = config;

      return {
        data: {
          headers: ['Date', 'Description', 'Amount'],
          sampleRows: [{ Date: '2026-05-01', Description: 'Coffee', Amount: '-4.50' }],
          inferredMapping: {
            dateColumn: 'Date',
            dateFormat: 'MM/dd/uuuu',
            descriptionColumn: 'Description',
            amountMode: 'SINGLE_AMOUNT_WITH_TYPE',
            amountColumn: 'Amount',
          },
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } satisfies AxiosResponse;
    });

    const response = await statementFormatApi.analyzeCsvSample(file);
    const formData = capturedConfig?.data as FormData;

    expect(capturedConfig?.url).toBe('/v1/statement-formats/csv-wizard/analyze');
    expect(capturedConfig?.headers.getContentType()).toContain('multipart/form-data');
    expect(formData).toBeInstanceOf(FormData);
    expect((formData.get('file') as File).name).toBe('sample.csv');
    expect(response.headers).toEqual(['Date', 'Description', 'Amount']);
  });

  it('posts multipart CSV wizard preview requests with a JSON request part', async () => {
    const file = new File(['Date,Description,Amount'], 'sample.csv', { type: 'text/csv' });
    const previewRequest: CsvWizardMappingPreviewRequest = {
      bankName: 'Example Bank',
      defaultCurrencyIsoCode: 'USD',
      accountId: 'checking-001',
      mapping: {
        dateColumn: 'Date',
        dateFormat: 'MM/dd/uuuu',
        descriptionColumn: 'Description',
        amountMode: 'SINGLE_AMOUNT_WITH_TYPE',
        amountColumn: 'Amount',
      },
    };
    let capturedConfig: InternalAxiosRequestConfig | undefined;

    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      capturedConfig = config;

      return {
        data: {
          transactions: [
            {
              date: '2026-05-01',
              description: 'Coffee',
              amount: 4.5,
              type: 'DEBIT',
              bankName: 'Example Bank',
              currencyIsoCode: 'USD',
              accountId: 'checking-001',
              duplicate: false,
            },
          ],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } satisfies AxiosResponse;
    });

    const response = await statementFormatApi.previewCsvMapping(file, previewRequest);
    const formData = capturedConfig?.data as FormData;
    const capturedRequestPart = formData.get('request') as Blob;

    expect(capturedConfig?.url).toBe('/v1/statement-formats/csv-wizard/preview');
    expect((formData.get('file') as File).name).toBe('sample.csv');
    expect(capturedRequestPart).toBeInstanceOf(Blob);
    expect(capturedRequestPart.type).toBe('application/json');
    expect(response.transactions).toHaveLength(1);
  });

  it('posts multipart CSV wizard save requests and returns the created format', async () => {
    const file = new File(['Date,Description,Amount'], 'sample.csv', { type: 'text/csv' });
    const saveRequest: CsvWizardSaveRequest = {
      displayName: 'Custom CSV',
      bankName: 'Example Bank',
      defaultCurrencyIsoCode: 'USD',
      mapping: {
        dateColumn: 'Date',
        dateFormat: 'MM/dd/uuuu',
        descriptionColumn: 'Description',
        amountMode: 'SINGLE_AMOUNT_WITH_TYPE',
        amountColumn: 'Amount',
      },
    };
    let capturedConfig: InternalAxiosRequestConfig | undefined;

    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      capturedConfig = config;

      return {
        data: {
          ...csvFormat,
          id: 99,
          displayName: 'Custom CSV',
          bankName: 'Example Bank',
          scope: 'USER',
        },
        status: 201,
        statusText: 'Created',
        headers: {},
        config,
      } satisfies AxiosResponse;
    });

    const response = await statementFormatApi.saveCsvWizardFormat(file, saveRequest);
    const formData = capturedConfig?.data as FormData;
    const capturedRequestPart = formData.get('request') as Blob;

    expect(capturedConfig?.url).toBe('/v1/statement-formats/csv-wizard/save');
    expect((formData.get('file') as File).name).toBe('sample.csv');
    expect(capturedRequestPart).toBeInstanceOf(Blob);
    expect(capturedRequestPart.type).toBe('application/json');
    expect(response).toEqual(
      expect.objectContaining({
        id: 99,
        displayName: 'Custom CSV',
        scope: 'USER',
      }),
    );
  });
});
