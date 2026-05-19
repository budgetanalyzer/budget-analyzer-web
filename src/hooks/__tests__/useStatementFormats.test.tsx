import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateStatementFormat,
  useStatementFormat,
  useStatementFormats,
  useUpdateStatementFormat,
} from '@/hooks/useStatementFormats';
import { server } from '@/testing/mocks/server';
import { createTestQueryClient } from '@/testing/test-utils';
import type { StatementFormat } from '@/types/statementFormat';

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
  debitHeader: 'Debit',
  enabled: true,
};

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

  it('does not request a statement format detail when the key is empty', async () => {
    let requestCount = 0;

    server.use(
      http.get('/api/v1/statement-formats/:formatKey', () => {
        requestCount += 1;
        return HttpResponse.json(csvFormat);
      }),
    );

    const { result } = renderHook(() => useStatementFormat(''), {
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
        return HttpResponse.json({ ...csvFormat, id: 2, formatKey: 'amex-csv' });
      }),
    );

    const { result } = renderHook(() => useCreateStatementFormat(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      formatKey: 'amex-csv',
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
      http.put('/api/v1/statement-formats/:formatKey', () => {
        return HttpResponse.json({ ...csvFormat, displayName: 'Capital One Export' });
      }),
    );

    const { result } = renderHook(() => useUpdateStatementFormat(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      formatKey: 'capital-one-csv',
      data: { displayName: 'Capital One Export' },
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['statement-formats'] });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['statement-formats', 'detail', 'capital-one-csv'],
    });
  });
});
