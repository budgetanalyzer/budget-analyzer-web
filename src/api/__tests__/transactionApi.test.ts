import { afterEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { http, HttpResponse } from 'msw';
import { server } from '@/testing/mocks/server';
import { apiClient } from '@/api/client';
import { transactionApi } from '@/api/transactionApi';
import type {
  BatchImportRequest,
  BatchImportResponse,
  BatchImportTransactionRequest,
} from '@/types/transaction';
import { ApiError } from '@/types/apiError';

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
  it('uploads statement files as ordered repeated multipart parts', async () => {
    const januaryFile = new File(['january'], 'january.csv', { type: 'text/csv' });
    const februaryFile = new File(['february'], 'february.pdf', {
      type: 'application/pdf',
    });
    let capturedConfig: InternalAxiosRequestConfig | undefined;

    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      capturedConfig = config;

      return {
        data: {
          files: [],
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } satisfies AxiosResponse;
    });

    await transactionApi.previewTransactions({
      files: [januaryFile, februaryFile],
      statementFormatId: 42,
      accountId: 'checking-123',
    });

    expect(capturedConfig?.url).toBe(
      '/v1/transactions/preview?statementFormatId=42&accountId=checking-123',
    );
    expect(capturedConfig?.headers.getContentType()).toContain('multipart/form-data');
    expect(capturedConfig?.timeout).toBe(60_000);
    expect(capturedConfig?.data).toBeInstanceOf(FormData);
    const uploadedFiles = (capturedConfig?.data as FormData).getAll('files');
    expect(uploadedFiles).toEqual([januaryFile, februaryFile]);
    expect((capturedConfig?.data as FormData).get('file')).toBeNull();
  });

  it.each([
    ['a single selected file', 1],
    ['a combined multi-file request', 2],
  ])('maps nginx 413 for %s to a deployment-neutral upload-limit error', async (_, fileCount) => {
    const files = Array.from(
      { length: fileCount },
      (__, index) => new File(['large statement'], `large-statement-${index}.csv`),
    );
    let caughtError: unknown;

    apiClient.defaults.adapter = vi.fn<AxiosAdapter>(async (config) => {
      const response = {
        data: '<html><body>413 Request Entity Too Large</body></html>',
        status: 413,
        statusText: 'Payload Too Large',
        headers: { 'Content-Type': 'text/html' },
        config,
      } satisfies AxiosResponse<string>;

      throw new AxiosError(
        'Request failed with status code 413',
        'ERR_BAD_REQUEST',
        config,
        {},
        response,
      );
    });

    try {
      await transactionApi.previewTransactions({ files, statementFormatId: 42 });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(caughtError).toMatchObject({
      name: 'ApiError',
      status: 413,
      message: 'The selected files exceed the upload size limit.',
      response: {
        type: 'INVALID_REQUEST',
        message: 'The selected files exceed the upload size limit.',
      },
    });
  });
});

describe('transactionApi.batchImportTransactions', () => {
  it('posts ordered preview file groups with their reviewed transactions', async () => {
    let capturedBody: unknown;
    const expectedResponse = {
      created: 1,
      duplicatesSkipped: 0,
      duplicatesImported: 0,
      files: [
        {
          sourceFile: 'january.csv',
          created: 1,
          duplicatesSkipped: 0,
          duplicatesImported: 0,
          transactions: [],
        },
        {
          sourceFile: 'february.csv',
          created: 0,
          duplicatesSkipped: 0,
          duplicatesImported: 0,
          transactions: [],
        },
      ],
    } satisfies BatchImportResponse;

    server.use(
      http.post('/api/v1/transactions/batch', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(expectedResponse);
      }),
    );

    const response = await transactionApi.batchImportTransactions({
      files: [
        {
          previewImportToken: 'january-token',
          transactions: [baseTransaction],
        },
        {
          previewImportToken: 'february-token',
          transactions: [],
        },
      ],
    });

    expect(capturedBody).toEqual({
      files: [
        {
          previewImportToken: 'january-token',
          transactions: [baseTransaction],
        },
        {
          previewImportToken: 'february-token',
          transactions: [],
        },
      ],
    });
    expect(response).toEqual(expectedResponse);
    expect(response.files.map((file) => file.sourceFile)).toEqual(['january.csv', 'february.csv']);
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
          files: [],
        });
      }),
    );

    const duplicatePreviewRow = {
      ...baseTransaction,
      duplicate: true,
      duplicateReason: 'EXISTING_TRANSACTION',
    };

    const request: BatchImportRequest = {
      files: [
        {
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
        },
      ],
    };

    await transactionApi.batchImportTransactions(request);

    expect(capturedBody).toEqual({
      files: [
        {
          previewImportToken: 'preview-token-456',
          transactions: [
            baseTransaction,
            {
              ...baseTransaction,
              description: 'Coffee duplicate',
              allowDuplicate: true,
            },
          ],
        },
      ],
    });
  });
});
