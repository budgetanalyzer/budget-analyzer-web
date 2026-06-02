import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateStatementFormat,
  useHideStatementFormat,
  useStatementFormat,
  useStatementFormats,
  useUnhideStatementFormat,
  useUpdateStatementFormat,
} from '@/hooks/useStatementFormats';
import { useSaveCsvWizardFormat } from '@/components/statement-formats/csv-wizard/hooks/useCsvStatementFormatWizard';
import {
  useAnalyzePdfWizardSample,
  usePreviewPdfWizardMapping,
  useSavePdfWizardFormat,
} from '@/components/statement-formats/pdf-wizard/hooks/usePdfStatementFormatWizard';
import { statementFormatApi } from '@/api/statementFormatApi';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';
import { ApiError } from '@/types/apiError';
import type { StatementFormat } from '@/types/statementFormat';

const csvFormat: StatementFormat = {
  id: 1,
  displayName: 'Capital One CSV',
  formatType: 'CSV',
  bankName: 'Capital One',
  defaultCurrencyIsoCode: 'USD',
  dateHeader: 'Date',
  dateFormat: 'MM/dd/yyyy',
  descriptionHeader: 'Description',
  debitHeader: 'Debit',
  enabled: true,
};

afterEach(() => {
  vi.restoreAllMocks();
});

function createWrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useStatementFormats', () => {
  it('stores statement formats under the default visible-list query key', async () => {
    const queryClient = createTestQueryClient();

    server.use(
      http.get('/api/v1/statement-formats', () => {
        return HttpResponse.json([csvFormat]);
      }),
    );

    const { result } = renderHook(() => useStatementFormats(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(
      queryClient.getQueryData(['statement-formats', 'list', { includeHidden: false }]),
    ).toEqual([csvFormat]);
  });

  it('stores includeHidden results under a separate list query key', async () => {
    const queryClient = createTestQueryClient();
    const hiddenFormat: StatementFormat = {
      ...csvFormat,
      id: 2,
      displayName: 'Hidden CSV',
      hidden: true,
    };
    const capturedSearchParams: string[] = [];

    server.use(
      http.get('/api/v1/statement-formats', ({ request }) => {
        capturedSearchParams.push(new URL(request.url).search);
        return HttpResponse.json([csvFormat, hiddenFormat]);
      }),
    );

    const { result } = renderHook(() => useStatementFormats({ includeHidden: true }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedSearchParams).toEqual(['?includeHidden=true']);
    expect(
      queryClient.getQueryData(['statement-formats', 'list', { includeHidden: true }]),
    ).toEqual([csvFormat, hiddenFormat]);
  });

  it('keeps normal and includeHidden list variants in distinct query cache entries', async () => {
    const queryClient = createTestQueryClient();
    const hiddenFormat: StatementFormat = {
      ...csvFormat,
      id: 2,
      displayName: 'Hidden CSV',
      hidden: true,
    };

    server.use(
      http.get('/api/v1/statement-formats', ({ request }) => {
        const url = new URL(request.url);

        return HttpResponse.json(
          url.searchParams.get('includeHidden') === 'true'
            ? [csvFormat, hiddenFormat]
            : [csvFormat],
        );
      }),
    );

    const { result: visibleResult } = renderHook(() => useStatementFormats(), {
      wrapper: createWrapper(queryClient),
    });
    const { result: managementResult } = renderHook(
      () => useStatementFormats({ includeHidden: true }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(visibleResult.current.isSuccess).toBe(true);
      expect(managementResult.current.isSuccess).toBe(true);
    });

    expect(
      queryClient.getQueryData(['statement-formats', 'list', { includeHidden: false }]),
    ).toEqual([csvFormat]);
    expect(
      queryClient.getQueryData(['statement-formats', 'list', { includeHidden: true }]),
    ).toEqual([csvFormat, hiddenFormat]);
  });

  it('does not request a statement format detail when the ID is missing', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v1/statement-formats/:id', () => {
        requestCount += 1;
        return HttpResponse.json(csvFormat);
      }),
    );

    const { result } = renderHook(() => useStatementFormat(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));

    expect(result.current.isPending).toBe(true);
    expect(requestCount).toBe(0);
  });

  it('surfaces statement-format API errors', async () => {
    server.use(
      http.get('/api/v1/statement-formats', () => {
        return HttpResponse.json(
          { type: 'SERVICE_UNAVAILABLE', message: 'Format service unavailable' },
          { status: 503 },
        );
      }),
    );

    const { result } = renderHook(() => useStatementFormats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });

    expect(result.current.error?.status).toBe(503);
    expect(result.current.error?.message).toBe('Format service unavailable');
  });
});

describe('statement-format mutation hooks', () => {
  it('invalidates the statement-format list after create success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post('/api/v1/statement-formats', () => {
        return HttpResponse.json({ ...csvFormat, id: 2, displayName: 'Amex CSV' });
      }),
    );

    const { result } = renderHook(() => useCreateStatementFormat(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      displayName: 'Amex CSV',
      formatType: 'CSV',
      bankName: 'Amex',
      defaultCurrencyIsoCode: 'USD',
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['statement-formats'] });
  });

  it('invalidates list and detail queries after update success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.put('/api/v1/statement-formats/:id', () => {
        return HttpResponse.json({ ...csvFormat, displayName: 'Capital One Export' });
      }),
    );

    const { result } = renderHook(() => useUpdateStatementFormat(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      id: 1,
      data: { displayName: 'Capital One Export' },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['statement-formats'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['statement-formats', 'detail', 1],
    });
  });

  it('invalidates all statement-format queries after hide and unhide success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    server.use(
      http.post('/api/v1/statement-formats/:id/hide', ({ params }) => {
        expect(params.id).toBe('1');
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('/api/v1/statement-formats/:id/unhide', ({ params }) => {
        expect(params.id).toBe('1');
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result: hideResult } = renderHook(() => useHideStatementFormat(), {
      wrapper: createWrapper(queryClient),
    });
    const { result: unhideResult } = renderHook(() => useUnhideStatementFormat(), {
      wrapper: createWrapper(queryClient),
    });

    await hideResult.current.mutateAsync(1);
    await unhideResult.current.mutateAsync(1);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['statement-formats'] });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it('surfaces hide and unhide mutation API errors without swallowing messages', async () => {
    server.use(
      http.post('/api/v1/statement-formats/:id/hide', () => {
        return HttpResponse.json(
          { type: 'APPLICATION_ERROR', message: 'Cannot hide this format' },
          { status: 409 },
        );
      }),
      http.post('/api/v1/statement-formats/:id/unhide', () => {
        return HttpResponse.json(
          { type: 'FORBIDDEN', message: 'Missing statement format write permission' },
          { status: 403 },
        );
      }),
    );

    const { result: hideResult } = renderHook(() => useHideStatementFormat(), {
      wrapper: createWrapper(),
    });
    const { result: unhideResult } = renderHook(() => useUnhideStatementFormat(), {
      wrapper: createWrapper(),
    });

    await expect(hideResult.current.mutateAsync(1)).rejects.toMatchObject({
      status: 409,
      message: 'Cannot hide this format',
    });
    await expect(unhideResult.current.mutateAsync(1)).rejects.toMatchObject({
      status: 403,
      message: 'Missing statement format write permission',
    });
    await waitFor(() => {
      expect(hideResult.current.error).toBeInstanceOf(ApiError);
      expect(unhideResult.current.error).toBeInstanceOf(ApiError);
    });
  });

  it('invalidates the statement-format list after CSV wizard save success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const file = new File(['Date,Description,Amount'], 'sample.csv', { type: 'text/csv' });

    vi.spyOn(statementFormatApi, 'saveCsvWizardFormat').mockResolvedValueOnce({
      ...csvFormat,
      id: 99,
      displayName: 'Custom CSV',
      scope: 'USER',
    });

    const { result } = renderHook(() => useSaveCsvWizardFormat(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        file,
        request: {
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
        },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['statement-formats'] });
  });

  it('calls PDF wizard analyze and preview APIs with the current variables', async () => {
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });
    const analyzeSpy = vi.spyOn(statementFormatApi, 'analyzePdfSample').mockResolvedValueOnce({
      candidates: [],
      rejectionReasons: ['No transaction table found.'],
    });
    const previewSpy = vi.spyOn(statementFormatApi, 'previewPdfMapping').mockResolvedValueOnce({
      transactions: [],
      diagnostics: [],
    });

    const { result: analyzeResult } = renderHook(() => useAnalyzePdfWizardSample(), {
      wrapper: createWrapper(),
    });
    const { result: previewResult } = renderHook(() => usePreviewPdfWizardMapping(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await analyzeResult.current.mutateAsync(file);
      await previewResult.current.mutateAsync({
        file,
        request: {
          bankName: 'Example Bank',
          defaultCurrencyIsoCode: 'USD',
          headerMustContain: ['Date', 'Description', 'Amount'],
          minimumRows: 3,
          yearSource: 'EXPLICIT_DATE',
          mapping: {
            dateHeader: 'Date',
            dateFormat: 'MM/dd/uuuu',
            descriptionHeader: 'Description',
            amountMode: 'SIGNED_AMOUNT',
            amountHeader: 'Amount',
            negativeMeans: 'DEBIT',
          },
        },
      });
    });

    expect(analyzeSpy).toHaveBeenCalledWith(file);
    expect(previewSpy).toHaveBeenCalledWith(
      file,
      expect.objectContaining({
        bankName: 'Example Bank',
        yearSource: 'EXPLICIT_DATE',
      }),
    );
  });

  it('invalidates the statement-format list after PDF wizard save success', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const file = new File(['%PDF-1.7'], 'sample.pdf', { type: 'application/pdf' });

    vi.spyOn(statementFormatApi, 'savePdfWizardFormat').mockResolvedValueOnce({
      ...csvFormat,
      id: 100,
      displayName: 'Custom PDF',
      formatType: 'PDF',
      scope: 'USER',
    });

    const { result } = renderHook(() => useSavePdfWizardFormat(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        file,
        request: {
          displayName: 'Custom PDF',
          bankName: 'Example Bank',
          defaultCurrencyIsoCode: 'USD',
          headerMustContain: ['Date', 'Description', 'Amount'],
          minimumRows: 3,
          yearSource: 'EXPLICIT_DATE',
          mapping: {
            dateHeader: 'Date',
            dateFormat: 'MM/dd/uuuu',
            descriptionHeader: 'Description',
            amountMode: 'SIGNED_AMOUNT',
            amountHeader: 'Amount',
            negativeMeans: 'DEBIT',
          },
        },
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['statement-formats'] });
  });
});
