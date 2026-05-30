import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateStatementFormat,
  useStatementFormat,
  useStatementFormats,
  useUpdateStatementFormat,
} from '@/hooks/useStatementFormats';
import { useSaveCsvWizardFormat } from '@/components/statement-formats/csv-wizard/hooks/useCsvStatementFormatWizard';
import { statementFormatApi } from '@/api/statementFormatApi';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';
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
  it('stores statement formats under the list query key', async () => {
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

    expect(queryClient.getQueryData(['statement-formats'])).toEqual([csvFormat]);
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
});
