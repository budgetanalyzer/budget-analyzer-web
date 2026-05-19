import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { apiClient } from '@/api/client';
import { transactionApi } from '@/api/transactionApi';
import { BatchImportRequest, BatchImportTransactionRequest } from '@/types/transaction';

const baseTransaction: BatchImportTransactionRequest = {
  date: '2026-05-01',
  description: 'Coffee',
  amount: 4.5,
  type: 'DEBIT',
  category: 'Dining',
  bankName: 'Test Bank',
  currencyIsoCode: 'USD',
  accountId: 'checking-123',
};

const originalAdapter = apiClient.defaults.adapter;

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe('transactionApi.previewTransactions', () => {
  it('uploads the statement file as multipart form data', async () => {
    const file = new File(['date,description,amount'], 'statement.csv', { type: 'text/csv' });
    let capturedConfig: InternalAxiosRequestConfig | undefined;

    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      capturedConfig = config;

      return {
        data: {
          previewImportToken: 'preview-token-123',
          sourceFile: 'statement.csv',
          fileImport: null,
          transactions: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } satisfies AxiosResponse;
    });

    await transactionApi.previewTransactions(file, 'acme-csv', 'checking-123');

    expect(capturedConfig?.url).toBe(
      '/v1/transactions/preview?format=acme-csv&accountId=checking-123',
    );
    expect(capturedConfig?.headers.getContentType()).toContain('multipart/form-data');
    expect(capturedConfig?.data).toBeInstanceOf(FormData);
  });
});

describe('transactionApi.batchImportTransactions', () => {
  it('posts the preview import token with reviewed transactions', async () => {
    let capturedBody: unknown;

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 0,
          duplicatesImported: 0,
          transactions: [],
        });
      }),
    );

    const response = await transactionApi.batchImportTransactions({
      previewImportToken: 'preview-token-123',
      transactions: [baseTransaction],
    });

    expect(capturedBody).toEqual({
      previewImportToken: 'preview-token-123',
      transactions: [baseTransaction],
    });
    expect(response.duplicatesImported).toBe(0);
  });

  it('only sends allowDuplicate when requested and strips preview-only metadata', async () => {
    let capturedBody: unknown;

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          created: 1,
          duplicatesSkipped: 1,
          duplicatesImported: 1,
          transactions: [],
        });
      }),
    );

    const duplicatePreviewRow = {
      ...baseTransaction,
      duplicate: true,
      duplicateReason: 'EXISTING_TRANSACTION',
    };

    const request: BatchImportRequest = {
      previewImportToken: 'preview-token-456',
      transactions: [
        {
          ...duplicatePreviewRow,
          allowDuplicate: false,
        },
        {
          ...duplicatePreviewRow,
          description: 'Coffee duplicate',
          allowDuplicate: true,
        },
      ],
    };

    await transactionApi.batchImportTransactions(request);

    expect(capturedBody).toEqual({
      previewImportToken: 'preview-token-456',
      transactions: [
        baseTransaction,
        {
          ...baseTransaction,
          description: 'Coffee duplicate',
          allowDuplicate: true,
        },
      ],
    });
  });
});
